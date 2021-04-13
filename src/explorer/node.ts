import * as vscode from 'vscode';

export interface Node<T> {
    getChildren(): T[] | Promise<T[]>;
    getTreeItem(): vscode.TreeItem | Promise<vscode.TreeItem>;
}
