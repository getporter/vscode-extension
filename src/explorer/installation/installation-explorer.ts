import * as vscode from 'vscode';

import * as porter from '../../porter/porter';
import { Installation } from '../../porter/porter.objectmodel';
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
        return installations.result.map((i) => new InstallationNode(i));
    }
}

class InstallationNode implements Node {
    readonly kind = 'installation' as const;
    constructor(private readonly installation: Installation) {}
    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(this.installation.Name);
        treeItem.tooltip = `Last action: ${this.installation.Action} (${this.installation.Status})\nat: ${displayTime(this.installation.Modified)}`;
        return treeItem;
    }
}

export type InstallationExplorerTreeNode =
    InstallationNode |
    ExplorerErrorNode;

function displayTime(timeString: string): string {
    const time = new Date(timeString);
    return `${time.toLocaleDateString()} ${time.toLocaleTimeString()}`;  // TODO: this is a bit rubbish
}
