import * as vscode from 'vscode';

export class PorterInstallConfigurationProvider implements vscode.DebugConfigurationProvider {

    resolveDebugConfiguration(folder: vscode.WorkspaceFolder | undefined, config: vscode.DebugConfiguration, token?: vscode.CancellationToken): vscode.ProviderResult<vscode.DebugConfiguration> {

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
            return vscode.window.showInformationMessage("Cannot find a Porter file to debug").then((_) => {
                return undefined;	// abort launch
            });
        }

        return config;
    }
}
