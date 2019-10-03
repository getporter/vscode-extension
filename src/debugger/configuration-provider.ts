import * as vscode from 'vscode';

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
            config.stopOnEntry = true;
        }
    }

    if (!config['porter-file']) {
        await vscode.window.showInformationMessage("Cannot find a Porter file to debug");
        return undefined;	// abort launch
    }

    const porterInputs = await vscode.window.showInputBox({ prompt: "Enter parameters and credentials (no, this is not a real UI)" });
    if (!porterInputs) {
        return undefined;
    }

    config.porterInputs = porterInputs;

    return config;
}
