'use strict';

import * as vscode from 'vscode';

import * as porter from './porter/porter';
import { selectWorkspaceFolder, longRunning, showPorterResult } from './utils/host';
import { succeeded } from './utils/errorable';
import * as shell from './utils/shell';
import { registerYamlSchema } from './yaml/yaml-schema';

export async function activate(context: vscode.ExtensionContext) {
    const subscriptions = [
        vscode.commands.registerCommand('porter.createProject', createProject),
        vscode.commands.registerCommand('porter.build', build),
    ];

    context.subscriptions.push(...subscriptions);

    await registerYamlSchema();
}

export function deactivate() {
}

async function createProject(): Promise<void> {
    const folder = await selectWorkspaceFolder("Choose folder to create project in");
    if (!folder) {
        return;
    }

    // TODO: check if we already have a porter.yaml or cnab directory, and confirm overwrite

    const rootPath = folder.uri.fsPath;
    const createResult = await porter.create(shell.shell, rootPath);

    if (succeeded(createResult)) {
        if (createResult.result) {
            const fileToOpen = vscode.Uri.file(createResult.result);
            const document = await vscode.workspace.openTextDocument(fileToOpen);
            await vscode.window.showTextDocument(document);
        }
    } else {
        await vscode.window.showErrorMessage(`Unable to scaffold new Porter project in ${rootPath}: ${createResult.error[0]}`);
    }
}

async function build(): Promise<void> {
    const folder = await selectWorkspaceFolder("Choose folder to build");
    if (!folder) {
        return;
    }

    const folderPath = folder.uri.fsPath;
    const buildResult = await longRunning(`Porter building ${folderPath}`,
        () => porter.build(shell.shell, folderPath)
    );

    await showPorterResult('build', folderPath, buildResult);
}
