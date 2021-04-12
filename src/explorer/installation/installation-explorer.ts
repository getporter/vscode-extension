import * as vscode from 'vscode';

import * as porter from '../../porter/porter';
import { Shell } from '../../utils/shell';
import { ExplorerErrorNode } from '../errornode';
import { Node } from '../node';

export class InstallationExplorer implements vscode.TreeDataProvider<InstallationExplorerTreeNode> {
    private readonly onDidChangeEmitter = new vscode.EventEmitter<InstallationExplorerTreeNode>();
    public readonly onDidChangeTreeData = this.onDidChangeEmitter.event;

    constructor(private readonly shell: Shell) { }

    getTreeItem(element: InstallationExplorerTreeNode): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element.getTreeItem();
    }

    getChildren(element?: InstallationExplorerTreeNode): vscode.ProviderResult<InstallationExplorerTreeNode[]> {
        if (element) {
            return [];
        } else {
            return this.rootNodes();
        }
    }

    async rootNodes(): Promise<InstallationExplorerTreeNode[]> {
        const installations = await porter.listInstallations(this.shell);
        if (!installations.succeeded) {
            return [new ExplorerErrorNode(installations.error[0])];
        }
        return installations.result.map((i) => new InstallationNode(i.Name));
    }
}

class InstallationNode implements Node {
    readonly kind = 'installation' as const;
    constructor(private readonly name: string) {}
    getTreeItem(): vscode.TreeItem {
        return new vscode.TreeItem(this.name);
    }
}

export type InstallationExplorerTreeNode =
    InstallationNode |
    ExplorerErrorNode;
