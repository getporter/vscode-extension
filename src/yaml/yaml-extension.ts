import * as vscode from 'vscode';
import { Errorable } from '../utils/errorable';

const VSCODE_YAML_EXTENSION_ID = 'redhat.vscode-yaml';

export interface YamlExtension {
    registerContributor(
        schema: string,
        requestSchema: (resource: string) => string | undefined,
        requestSchemaContent: (uri: string) => string | undefined
    ): void;
}

export async function activateYamlExtension(): Promise<Errorable<YamlExtension>> {
    const extension = vscode.extensions.getExtension(VSCODE_YAML_EXTENSION_ID);
    if (!extension) {
        return { succeeded: false, error: ['Please install \'YAML Support by Red Hat\' via the Extensions pane.'] };
    }

    const extensionAPI = await extension.activate();
    if (!extensionAPI || !extensionAPI.registerContributor) {
        return { succeeded: false, error: ['The installed Red Hat YAML extension doesn\'t support Porter intellisense. Please upgrade \'YAML Support by Red Hat\' via the Extensions pane.'] };
    }

    return { succeeded: true, result: extensionAPI };
}
