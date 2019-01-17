import * as vscode from 'vscode';

import { Errorable, failed } from './errorable';

export async function selectWorkspaceFolder(placeHolder?: string): Promise<vscode.WorkspaceFolder | undefined> {
    const folders = vscode.workspace.workspaceFolders;

    if (!folders || folders.length === 0) {
        vscode.window.showErrorMessage("This command requires an open folder");
        return undefined;
    }

    if (folders.length === 1) {
        return folders[0];
    }

    return await vscode.window.showWorkspaceFolderPick({ placeHolder: placeHolder });
}

export async function selectQuickPick<T extends vscode.QuickPickItem>(items: T[], options?: vscode.QuickPickOptions): Promise<T | undefined> {
    if (items.length === 1) {
        return items[0];
    }
    return await vscode.window.showQuickPick(items, options);
}

export async function longRunning<T>(title: string, action: () => Promise<T>): Promise<T> {
    const options = {
        location: vscode.ProgressLocation.Notification,
        title: title
    };
    return await vscode.window.withProgress(options, (_) => action());
}

export async function showPorterResult<T>(command: string, resource: string | ((r: T) => string), porterResult: Errorable<T>): Promise<void> {
    if (failed(porterResult)) {
        // The invocation infrastructure adds blurb about what command failed, and
        // Porter's CLI parser adds 'Error:'. We don't need that here because we're
        // going to prepend our own blurb.
        const message = trimPrefix(porterResult.error[0], `porter ${command} error: Error:`).trim();
        await vscode.window.showErrorMessage(`Porter ${command} failed: ${message}`);
    } else {
        const resourceText = resource instanceof Function ? resource(porterResult.result) : resource;
        await vscode.window.showInformationMessage(`Porter ${command} complete for ${resourceText}`);
    }
}

function trimPrefix(text: string, prefix: string): string {
    if (text.startsWith(prefix)) {
        return text.substring(prefix.length);
    }
    return text;
}

export async function confirm(text: string, confirmLabel: string): Promise<boolean> {
    const choice = await vscode.window.showWarningMessage(text, confirmLabel, 'Cancel');
    return choice === confirmLabel;
}
