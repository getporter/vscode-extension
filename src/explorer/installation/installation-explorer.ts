import * as vscode from 'vscode';

import * as porter from '../../porter/porter';
import { Installation, InstallationHistoryEntry } from '../../porter/porter.objectmodel';
import { Shell } from '../../utils/shell';
import { viewOutputs } from '../../views/outputs';
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
            return element.getChildren();
        } else {
            return this.rootNodes();
        }
    }

    async rootNodes(): Promise<InstallationExplorerTreeNode[]> {
        const installations = await porter.listInstallations(this.shell);
        if (!installations.succeeded) {
            return [new ExplorerErrorNode(installations.error[0])];
        }
        return installations.result.map((i) => new InstallationNode(this.shell, i));
    }
}

class InstallationNode implements Node<InstallationExplorerTreeNode> {
    readonly kind = 'installation' as const;
    constructor(private readonly shell: Shell, private readonly installation: Installation) {}
    async getChildren(): Promise<InstallationExplorerTreeNode[]> {
        const installationDetail = await porter.getInstallationDetail(this.shell, this.installation.Name);
        if (!installationDetail.succeeded) {
            return [new ExplorerErrorNode(installationDetail.error[0])];
        }
        return installationDetail.result.History.map((e) => new InstallationHistoryEntryNode(e));
    }
    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(this.installation.Name, vscode.TreeItemCollapsibleState.Collapsed);
        treeItem.contextValue = 'porter.installation';
        treeItem.tooltip = `Last action: ${this.installation.Action} (${this.installation.Status})\nat: ${displayTime(this.installation.Modified)}`;
        return treeItem;
    }

    async viewOutputs() {
        const installationDetail = await porter.getInstallationDetail(this.shell, this.installation.Name);
        if (!installationDetail.succeeded) {
            await vscode.window.showErrorMessage(`Can't view outputs: ${installationDetail.error[0]}`);
            return;
        }
        const title = `Porter Outputs - ${this.installation.Name}`;
        await viewOutputs(title, installationDetail.result.Outputs);
    }
}

class InstallationHistoryEntryNode implements Node<InstallationExplorerTreeNode> {
    readonly kind = 'installation-history-entry' as const;
    constructor(private readonly data: InstallationHistoryEntry) {}
    getChildren(): InstallationExplorerTreeNode[] | Promise<InstallationExplorerTreeNode[]> {
        return [];
    }
    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(`${this.data.Action} at ${displayTime(this.data.Timestamp)} (${this.data.ClaimID})`);
        treeItem.contextValue = 'porter.installation-history-entry';
        return treeItem;
    }
}

export type InstallationExplorerTreeNode =
    InstallationNode |
    InstallationHistoryEntryNode |
    ExplorerErrorNode;

function displayTime(timeString: string): string {
    const time = new Date(timeString);
    return `${time.toLocaleDateString()} ${time.toLocaleTimeString()}`;  // TODO: this is a bit rubbish
}
