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

const PORTER_OUTPUT_CHANNEL = vscode.window.createOutputChannel('Porter');

export async function activate(context: vscode.ExtensionContext) {
    const definitionProvider = definitionprovider.create();
    const referenceProvider = referenceprovider.create();
    const variablesCompletionProvider = variablescompletionprovider.create();
    const codeActionProvider = codeactionprovider.create();

    const debugConfigurationProvider = new PorterInstallConfigurationProvider();
    const debugFactory = new PorterInstallDebugAdapterDescriptorFactory();

    const porterManifestSelector = { language: 'yaml', scheme: 'file', pattern: '**/porter.yaml' };

    const subscriptions = [
        vscode.commands.registerCommand('porter.createProject', createProject),
        vscode.commands.registerCommand('porter.build', build),
        vscode.commands.registerCommand('porter.install', install),
        vscode.commands.registerCommand('porter.insertHelmChart', insertHelmChart),
        vscode.commands.registerTextEditorCommand('porter.moveStepUp', moveStepUp),
        vscode.commands.registerTextEditorCommand('porter.moveStepDown', moveStepDown),
        vscode.commands.registerCommand('porter.parameterise', parameteriseSelection),
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

async function createProject(): Promise<void> {
    const folder = await selectWorkspaceFolder("Choose folder to create project in");
    if (!folder) {
        return;
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
    } else {
        await vscode.window.showErrorMessage(`Unable to scaffold new Porter project in ${rootPath}: ${createResult.error[0]}`);
    }
}

async function build(): Promise<void> {
    const folder = await selectWorkspaceFolder("Choose folder to build");
    if (!folder) {
        return;
    }

    const folderPath = folder.uri.fsPath;
    const buildResult = await longRunning(`Porter building ${folderPath}`,
        () => porter.build(shell.shell, folderPath)
    );

    await showPorterResult('build', folderPath, buildResult);
}

async function install(): Promise<void> {
    const folder = await selectWorkspaceFolder("Choose folder to install");
    if (!folder) {
        return;
    }

    const bundlePick = folderSelection(folder.uri.fsPath);
    const suggestedName = suggestName(bundlePick);
    const name = await vscode.window.showInputBox({ prompt: `Install bundle in ${displayName(bundlePick)} as...`, value: suggestedName });
    if (!name) {
        return;
    }

    const bundleManifestResult = await longRunning('Loading bundle...', () => manifest(bundlePick));
    if (failed(bundleManifestResult)) {
        await vscode.window.showErrorMessage(`Failed to load bundle: ${bundleManifestResult.error[0]}`);
        return;
    }

    const bundleManifest = bundleManifestResult.result;

    const credentialSet = await promptForCredentials(bundleManifest, shell.shell, 'Credential set to install bundle with');
    if (credentialSet.cancelled) {
        return;
    }

    const parameters = await promptForParameters(bundlePick, bundleManifest, 'install', 'Install', 'Enter installation parameters');
    if (parameters.cancelled) {
        return;
    }

    const folderPath = folder.uri.fsPath;
    const installResult = await longRunning(`Porter installing ${displayName(bundlePick)} as ${name}`,
        () => porter.install(shell.shell, folderPath, name, parameters.value, credentialSet.value)
    );

    if (succeeded(installResult)) {
        showInOutputTitled(`Installed ${displayName(bundlePick)} as ${name}`, installResult.result);
    }
    await showPorterResult('install', name, installResult);
}

function showInOutputTitled(title: string, body: string): void {
    PORTER_OUTPUT_CHANNEL.appendLine('');
    PORTER_OUTPUT_CHANNEL.appendLine(title);
    PORTER_OUTPUT_CHANNEL.appendLine('-'.repeat(title.length));
    PORTER_OUTPUT_CHANNEL.appendLine('');
    PORTER_OUTPUT_CHANNEL.appendLine(body);
    PORTER_OUTPUT_CHANNEL.show();
}
