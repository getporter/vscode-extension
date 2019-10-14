import * as path from 'path';
import * as vscode from 'vscode';

import { InstallInputs } from './session-parameters';
import { folderSelection, suggestName, displayName, manifest } from '../utils/bundleselection';
import { formatHyphenated } from '../utils/date';
import { longRunning } from '../utils/host';
import { failed } from '../utils/errorable';
import { promptForCredentials } from '../utils/credentials';
import * as shell from '../utils/shell';
import { promptForParameters } from '../utils/parameters';

export class PorterInstallConfigurationProvider implements vscode.DebugConfigurationProvider {

    resolveDebugConfiguration(folder: vscode.WorkspaceFolder | undefined, config: vscode.DebugConfiguration, token?: vscode.CancellationToken): vscode.ProviderResult<vscode.DebugConfiguration> {
        return resolveDebugConfiguration(folder, config, token);
    }
}

async function resolveDebugConfiguration(folder: vscode.WorkspaceFolder | undefined, config: vscode.DebugConfiguration, token?: vscode.CancellationToken): Promise<vscode.DebugConfiguration | undefined> {

    // if launch.json is missing or empty
    if (!config.type && !config.request && !config.name) {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === 'yaml' && editor.document.uri.fsPath.indexOf('porter.yaml') >= 0) {
            config.type = 'porter';
            config.name = 'Launch';
            config.request = 'launch';
            config['porter-file'] = '${file}';
        }
    }

    const folderPath = path.dirname(vscode.window.activeTextEditor!.document.uri.fsPath);

    if (!config['porter-file'] || !folderPath) {
        await vscode.window.showInformationMessage("Cannot find a Porter file to debug");
        return undefined;	// abort launch
    }

    // TODO: deduplicate with install command

    const bundlePick = folderSelection(folderPath);
    const suggestedName = suggestName(bundlePick) + debugSuffix();
    const name = await vscode.window.showInputBox({ prompt: `Install bundle in ${displayName(bundlePick)} as...`, value: suggestedName });
    if (!name) {
        return;
    }

    if (!config.installInputs) {
        const bundleManifestResult = await longRunning('Loading bundle...', () => manifest(bundlePick));
        if (failed(bundleManifestResult)) {
            await vscode.window.showErrorMessage(`Failed to load bundle: ${bundleManifestResult.error[0]}`);
            return;
        }

        const bundleManifest = bundleManifestResult.result;

        const credentialSet = await promptForCredentials(bundleManifest, shell.shell, 'Credential set to install bundle with');
        if (credentialSet.cancelled) {
            return;
        }

        const parameters = await promptForParameters(bundlePick, bundleManifest, 'install', 'Install', 'Enter installation parameters');
        if (parameters.cancelled) {
            return;
        }

        const installInputs: InstallInputs = { parameters: parameters.value, credentialSet: credentialSet.value };

        config.installInputs = installInputs;
    }

    config.stopOnEntry = true;

    return config;
}

function debugSuffix(): string {
    const timestamp = new Date();
    return `-debug-${formatHyphenated(timestamp)}`;
}
