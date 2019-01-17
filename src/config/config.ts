import * as vscode from 'vscode';

const EXTENSION_CONFIG_KEY = "vscode-porter";

export function affectsExtensionConfiguration(change: vscode.ConfigurationChangeEvent) {
    return change.affectsConfiguration(EXTENSION_CONFIG_KEY);
}

export function porterPath(): string | undefined {
    return toolPath('porter');
}

export function toolPath(tool: string): string | undefined {
    return vscode.workspace.getConfiguration(EXTENSION_CONFIG_KEY)[`${tool}-path`];
}
