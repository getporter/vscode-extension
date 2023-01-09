import * as vscode from 'vscode';
import { CopyId } from '../../commands/copyId';
import { CommandResult } from '../../commands/result';
import { ViewLogs } from '../../commands/viewlogs';
import { ViewOutputs } from '../../commands/viewoutputs';

import * as porter from '../../porter/porter';
import { Installation, InstallationHistoryEntry } from '../../porter/porter.objectmodel';
import { Shell } from '../../utils/shell';
import { viewLogs } from '../../views/logs';
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

    async refresh(): Promise<CommandResult> {
        (await this.rootNodes()).forEach((element: InstallationExplorerTreeNode) => {
            this.onDidChangeEmitter.fire(element);
        });
        return CommandResult.Succeeded;
    }
}

class InstallationNode implements Node<InstallationExplorerTreeNode>, ViewOutputs {
    readonly kind = 'installation' as const;
    constructor(private readonly shell: Shell, private readonly installation: Installation) {}
    async getChildren(): Promise<InstallationExplorerTreeNode[]> {
        const installationDetail = await porter.getInstallationDetail(this.shell, this.installation.Name);
        if (!installationDetail.succeeded) {
            return [new ExplorerErrorNode(installationDetail.error[0])];
        }
        return installationDetail.result.History.map((e) => new InstallationHistoryEntryNode(this.shell, e));
    }
    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(this.installation.Name, vscode.TreeItemCollapsibleState.Collapsed);
        treeItem.contextValue = 'porter.installation porter.has-outputs';
        treeItem.tooltip = `Last action: ${this.installation.Action} (${this.installation.Status})\nat: ${displayTime(this.installation.Modified)}`;
        return treeItem;
    }

    async viewOutputs(): Promise<CommandResult> {
        const installationDetail = await porter.getInstallationDetail(this.shell, this.installation.Name);
        if (!installationDetail.succeeded) {
            await vscode.window.showErrorMessage(`Can't view outputs: ${installationDetail.error[0]}`);
            return CommandResult.Failed;
        }
        const title = `Porter Outputs - ${this.installation.Name}`;
        await viewOutputs(title, installationDetail.result.Outputs);
        return CommandResult.Succeeded;
    }
}

class InstallationHistoryEntryNode implements Node<InstallationExplorerTreeNode>, ViewLogs, CopyId {
    readonly kind = 'installation-history-entry' as const;
    constructor(private readonly shell: Shell, private readonly data: InstallationHistoryEntry) {}
    getChildren(): InstallationExplorerTreeNode[] | Promise<InstallationExplorerTreeNode[]> {
        return [];
    }
    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(`${this.data.Action} at ${displayTime(this.data.Timestamp)}`);
        treeItem.contextValue = 'porter.installation-history-entry porter.has-copiable-id';
        if (this.data.HasLogs) {
            treeItem.contextValue += ' porter.has-logs';
        }
        return treeItem;
    }

    async viewLogs(): Promise<CommandResult> {
        const logs = await porter.getClaimLogs(this.shell, this.data.ClaimID);
        if (!logs.succeeded) {
            await vscode.window.showErrorMessage(`Can't view logs: ${logs.error[0]}`);
            return CommandResult.Failed;
        }
        const title = `Porter Logs - ${this.data.ClaimID}`;
        await viewLogs(title, logs.result);
        return CommandResult.Succeeded;
    }

    async copyId(): Promise<CommandResult> {
        vscode.env.clipboard.writeText(this.data.ClaimID);
        return CommandResult.Succeeded;
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
