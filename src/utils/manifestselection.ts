import * as path from 'path';
import * as vscode from 'vscode';

import './array';
import { fs } from '../utils/fs';

export async function findPorterManifestDirectory(): Promise<string | undefined> {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.uri.fsPath.indexOf('porter.yaml') >= 0) {
        return path.dirname(editor.document.uri.fsPath);
    }

    const folders = await porterFolders();

    if (!folders || folders.length === 0) {
        return undefined;
    }

    return folders[0];
}

export async function findPorterManifestDocument(activeDocument: vscode.TextDocument): Promise<vscode.TextDocument | undefined> {
    if (activeDocument.uri.fsPath.includes('porter.yaml')) {
        return activeDocument;
    }

    const folders = await porterFolders();
    if (!folders || folders.length === 0) {
        return undefined;
    }

    const containingFolder = folders.find((f) => activeDocument.uri.fsPath.startsWith(f));
    const bestFolder = containingFolder || folders[0];

    return vscode.workspace.openTextDocument(path.join(bestFolder, 'porter.yaml'));
}

async function porterFolders(): Promise<readonly string[]> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        return [];
    }

    const matches = folders.filter(async (f: { uri: { fsPath: string; }; }) => await fs.exists(path.join(f.uri.fsPath, 'porter.yaml')));
    return matches.map((f: { uri: { fsPath: any; }; }) => f.uri.fsPath);
}
