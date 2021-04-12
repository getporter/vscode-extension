import * as vscode from "vscode";
import { Node } from "./node";

export class ExplorerErrorNode implements Node {
    readonly kind = 'error' as const;
    constructor(private readonly tooltip: string) {}
    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem("Error", vscode.TreeItemCollapsibleState.None);
        treeItem.tooltip = this.tooltip;
        return treeItem;
    }
}
