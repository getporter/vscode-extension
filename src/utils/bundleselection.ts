import * as path from 'path';
import * as cnab from 'cnabjs';

import * as porter from '../porter/porter';
import { cantHappen } from './never';
import { Errorable, failed } from './errorable';
import { shell } from './shell';
import { fs } from './fs';

export interface PorterFolder {
    readonly kind: 'porter-folder';
    readonly folderPath: string;
}

export interface RegistryTag {
    readonly kind: 'registry-tag';
    readonly tag: string;
}

export type BundleSelection = PorterFolder | RegistryTag;

export function folderSelection(folderPath: string): BundleSelection {
    return {
        kind: 'porter-folder',
        folderPath: folderPath
    };
}

export function displayName(bundlePick: BundleSelection): string {
    if (bundlePick.kind === 'porter-folder') {
        return path.basename(bundlePick.folderPath);
    } else if (bundlePick.kind === 'registry-tag') {
        return bundlePick.tag;
    }
    return cantHappen(bundlePick);
}

export async function manifest(bundlePick: BundleSelection): Promise<Errorable<cnab.Bundle>> {
    if (bundlePick.kind === 'porter-folder') {
        const buildResult = await porter.build(shell, bundlePick.folderPath);  // TODO: incremental
        if (failed(buildResult)) {
            return buildResult;
        }
        const cnabManifestPath = path.join(bundlePick.folderPath, '.cnab', 'bundle.json');
        const cnabManifestJSON = await fs.readFile(cnabManifestPath, { encoding: 'utf8' });  // TODO: we should probably move this into cnabjs at some point
        return { succeeded: true, result: JSON.parse(cnabManifestJSON) };
    } else if (bundlePick.kind === 'registry-tag') {
        return { succeeded: false, error: ['Registry bundles are not yet supported'] };
    }
    return cantHappen(bundlePick);
}

const SAFE_NAME_ILLEGAL_CHARACTERS = /[^A-Za-z0-9_-]/g;

export function suggestName(bundlePick: BundleSelection): string {
    if (bundlePick.kind === 'porter-folder') {
        const containingDir = path.basename(bundlePick.folderPath);
        return safeName(containingDir);
    } else if (bundlePick.kind === 'registry-tag') {
        return safeName(nameFromTag(bundlePick.tag));
    }
    return cantHappen(bundlePick);
}

function nameFromTag(tag: string): string {
    const versionedBits = tag.split(':');
    const namespacedBits = versionedBits[0].split('/');
    return namespacedBits[namespacedBits.length - 1];
}

function safeName(source: string): string {
    return source.replace(SAFE_NAME_ILLEGAL_CHARACTERS, '-');
}
