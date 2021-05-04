import * as vscode from 'vscode';

export async function viewLogs(title: string, logs: ReadonlyArray<string>) {
    const markdown = renderMarkdown(title, logs);
    const mdhtml = await vscode.commands.executeCommand<string>('markdown.api.render', markdown);
    if (!mdhtml) {
        await vscode.window.showErrorMessage("Can't show outputs: internal rendering error");
        return;
    }

    const html = `<html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none';"><head><body>${mdhtml}</body></html>`;

    const webview = vscode.window.createWebviewPanel('porter-installation-logs-view', title, vscode.ViewColumn.Active, { enableFindWidget: true });
    webview.webview.html = html;
    webview.reveal();
}

function renderMarkdown(title: string, logs: ReadonlyArray<string>): string {
    return [
        `## ${title}`,
        // tslint:disable-next-line: prefer-template
        '```\n' + logs.join('\n') + '\n```'
    ].join('\n');
}
