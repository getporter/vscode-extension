import * as vscode from 'vscode';

export interface Node {
    getTreeItem(): vscode.TreeItem | Promise<vscode.TreeItem>;
}
