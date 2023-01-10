import * as vscode from 'vscode';
import { InstallationOutput } from '../porter/porter.objectmodel';

export async function viewOutputs(title: string, outputs: ReadonlyArray<InstallationOutput>) {
    const markdown = renderMarkdown(title, outputs);
    const mdhtml = await vscode.commands.executeCommand<string>('markdown.api.render', markdown);
    if (!mdhtml) {
        await vscode.window.showErrorMessage("Can't show outputs: internal rendering error");
        return;
    }

    const html = `<html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none';"><head><body>${mdhtml}</body></html>`;

    const webview = vscode.window.createWebviewPanel('porter-installation-outputs-view', title, vscode.ViewColumn.Active, { enableFindWidget: true });
    webview.webview.html = html;
    webview.reveal();
}

function renderMarkdown(title: string, outputs: ReadonlyArray<InstallationOutput>): string {
    return [
        `## ${title}`,
        '| Name | Type | Value |',
        '|------|------|-------|',
        ...outputs.map(renderOutput)
    ].join('\n');
}

function renderOutput(output: InstallationOutput): string {
    const valueLines = output.value.split('\n');
    return [
        `| ${output.name} | ${output.type} | ${valueLines[0]} |`,
        ...valueLines.slice(1).map((l) => `| | | ${l} |`)
    ].join('\n');
}
