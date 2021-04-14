'use strict';

import * as vscode from 'vscode';

import * as porter from './porter/porter';
import { selectWorkspaceFolder, longRunning, showPorterResult } from './utils/host';
import { succeeded, failed } from './utils/errorable';
import * as shell from './utils/shell';
import { registerYamlSchema, updateYamlSchema } from './yaml/yaml-schema';
import { promptForCredentials } from './utils/credentials';
import { suggestName, folderSelection, displayName, manifest } from './utils/bundleselection';
import { promptForParameters } from './utils/parameters';
import { PorterInstallConfigurationProvider } from './debugger/configuration-provider';
import { PorterInstallDebugAdapterDescriptorFactory } from './debugger/descriptor-factory';
import { insertHelmChart } from './commands/inserthelmchart';
import { moveStepUp, moveStepDown } from './commands/movestep';
import { parameteriseSelection } from './commands/parameterise';
import * as definitionprovider from './navigation/definitionprovider';
import * as referenceprovider from './navigation/referenceprovider';
import * as diagnostics from './diagnostics/diagnostics';
import * as codeactionprovider from './diagnostics/codeactionprovider';
import * as variablescompletionprovider from './completion/variablescompletion';
import { PORTER_OUTPUT_CHANNEL } from './utils/logging';
import { Reporter } from './telemetry/telemetry';
import * as telemetry from './telemetry/telemetry-helper';
import { CommandResult, commandResultOf } from './commands/result';
import { InstallationExplorer } from './explorer/installation/installation-explorer';
import { viewOutputs } from './commands/viewoutputs';
import { viewLogs } from './commands/viewlogs';
import { copyId } from './commands/copyId';

export async function activate(context: vscode.ExtensionContext) {
    const definitionProvider = definitionprovider.create();
    const referenceProvider = referenceprovider.create();
    const variablesCompletionProvider = variablescompletionprovider.create();
    const codeActionProvider = codeactionprovider.create();

    const installationExplorer = new InstallationExplorer(shell.shell);

    const debugConfigurationProvider = new PorterInstallConfigurationProvider();
    const debugFactory = new PorterInstallDebugAdapterDescriptorFactory();

    const porterManifestSelector = { language: 'yaml', scheme: 'file', pattern: '**/porter.yaml' };

    const subscriptions = [
        registerTelemetry(context),
        registerCommand('porter.createProject', createProject),
        registerCommand('porter.build', build),
        registerCommand('porter.install', install),
        registerCommand('porter.insertHelmChart', insertHelmChart),
        registerTextEditorCommand('porter.moveStepUp', moveStepUp),
        registerTextEditorCommand('porter.moveStepDown', moveStepDown),
        registerCommand('porter.parameterise', parameteriseSelection),
        registerCommand('porter.viewOutputs', viewOutputs),
        registerCommand('porter.viewLogs', viewLogs),
        registerCommand('porter.copyId', copyId),
        registerCommand('porter.refreshInstallationExplorer', () => installationExplorer.refresh()),
        vscode.window.registerTreeDataProvider('porter.installations', installationExplorer),
        vscode.languages.registerDefinitionProvider(porterManifestSelector, definitionProvider),
        vscode.languages.registerReferenceProvider(porterManifestSelector, referenceProvider),
        vscode.languages.registerCompletionItemProvider(porterManifestSelector, variablesCompletionProvider, ...variablescompletionprovider.COMPLETION_TRIGGERS),
        vscode.languages.registerCodeActionsProvider(porterManifestSelector, codeActionProvider, { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }),
        vscode.debug.registerDebugConfigurationProvider('porter', debugConfigurationProvider),
        vscode.debug.registerDebugAdapterDescriptorFactory('porter', debugFactory),
        debugFactory
    ];

    context.subscriptions.push(...subscriptions);

    diagnostics.initialise();

    await registerYamlSchema(context);
    updateYamlSchema(context);  // runs in background - do not wait for this to finish activation
}

export function deactivate() {
}

function registerTelemetry(context: vscode.ExtensionContext): vscode.Disposable {
    return new Reporter(context);
}

function registerCommand(command: string, callback: (...args: any[]) => CommandResult | Promise<CommandResult>): vscode.Disposable {
    const wrappedCallback = telemetry.telemetriseCommand(command, callback);
    return vscode.commands.registerCommand(command, wrappedCallback);
}

function registerTextEditorCommand(command: string, callback: (textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit, ...args: any[]) => CommandResult | Promise<CommandResult>): vscode.Disposable {
    const wrappedCallback = telemetry.telemetriseTextEditorCommand(command, callback);
    return vscode.commands.registerTextEditorCommand(command, wrappedCallback);
}

async function createProject(): Promise<CommandResult> {
    const folder = await selectWorkspaceFolder("Choose folder to create project in");
    if (!folder) {
        return CommandResult.Cancelled;
    }

    // TODO: check if we already have a porter.yaml or cnab directory, and confirm overwrite

    const rootPath = folder.uri.fsPath;
    const createResult = await porter.create(shell.shell, rootPath);

    if (succeeded(createResult)) {
        if (createResult.result) {
            const fileToOpen = vscode.Uri.file(createResult.result);
            const document = await vscode.workspace.openTextDocument(fileToOpen);
            await vscode.window.showTextDocument(document);
        }
        return CommandResult.Succeeded;
    } else {
        vscode.window.showErrorMessage(`Unable to scaffold new Porter project in ${rootPath}: ${createResult.error[0]}`);
        return CommandResult.Failed;
    }
}

async function build(): Promise<CommandResult> {
    const folder = await selectWorkspaceFolder("Choose folder to build");
    if (!folder) {
        return CommandResult.Cancelled;
    }

    const folderPath = folder.uri.fsPath;
    const buildResult = await longRunning(`Porter building ${folderPath}`,
        () => porter.build(shell.shell, folderPath)
    );

    showPorterResult('build', folderPath, buildResult);
    return commandResultOf(buildResult);
}

async function install(): Promise<CommandResult> {
    const folder = await selectWorkspaceFolder("Choose folder to install");
    if (!folder) {
        return CommandResult.Cancelled;
    }

    const bundlePick = folderSelection(folder.uri.fsPath);
    const suggestedName = suggestName(bundlePick);
    const name = await vscode.window.showInputBox({ prompt: `Install bundle in ${displayName(bundlePick)} as...`, value: suggestedName });
    if (!name) {
        return CommandResult.Cancelled;
    }

    const bundleManifestResult = await longRunning('Loading bundle...', () => manifest(bundlePick));
    if (failed(bundleManifestResult)) {
        vscode.window.showErrorMessage(`Failed to load bundle: ${bundleManifestResult.error[0]}`);
        return CommandResult.Failed;
    }

    const bundleManifest = bundleManifestResult.result;

    const credentialSet = await promptForCredentials(bundleManifest, shell.shell, 'Credential set to install bundle with');
    if (credentialSet.cancelled) {
        return CommandResult.Cancelled;
    }

    const parameters = await promptForParameters(bundlePick, bundleManifest, 'install', 'Install', 'Enter installation parameters');
    if (parameters.cancelled) {
        return CommandResult.Cancelled;
    }

    const folderPath = folder.uri.fsPath;
    const installResult = await longRunning(`Porter installing ${displayName(bundlePick)} as ${name}`,
        () => porter.install(shell.shell, folderPath, name, parameters.value, credentialSet.value)
    );

    if (succeeded(installResult)) {
        showInOutputTitled(`Installed ${displayName(bundlePick)} as ${name}`, installResult.result);
    }
    showPorterResult('install', name, installResult);
    return commandResultOf(installResult);
}

function showInOutputTitled(title: string, body: string): void {
    PORTER_OUTPUT_CHANNEL.appendLine('');
    PORTER_OUTPUT_CHANNEL.appendLine(title);
    PORTER_OUTPUT_CHANNEL.appendLine('-'.repeat(title.length));
    PORTER_OUTPUT_CHANNEL.appendLine('');
    PORTER_OUTPUT_CHANNEL.appendLine(body);
    PORTER_OUTPUT_CHANNEL.show();
}
