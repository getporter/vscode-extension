import * as vscode from 'vscode';

import * as ast from '../porter/ast';

interface HelmRepoChart {
    readonly nodeCategory: 'helm-explorer-node';
    readonly kind: 1;
    readonly name: string;
    readonly id: string;
}

interface HelmRepoChartVersion {
    readonly nodeCategory: 'helm-explorer-node';
    readonly kind: 2;
    readonly name: string;
    readonly id: string;
    readonly version: string;
}

type HelmRepoEntry = HelmRepoChart | HelmRepoChartVersion;

export async function insertHelmChart(target?: any): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('This command requires an open editor containing the porter.yaml to insert into');
        return;
    }
    const document = editor.document;
    if (!document.uri.fsPath.toLowerCase().endsWith('porter.yaml')) {
        vscode.window.showErrorMessage('This command requires an open editor containing the porter.yaml to insert into');
        return;
    }
    const manifest = ast.parse(document.getText());
    if (!manifest) {
        vscode.window.showErrorMessage('Unable to parse open porter.yaml file: please fix any errors and try again');
        return;
    }
    const installAction = manifest.actions.find((a) => a.name === 'install') || syntheticAction(editor, 'install');

    if (!target) {
        // TODO: prompt or prevent
        vscode.window.showErrorMessage('This command requires you to select a chart or chart version in a Helm repo');
        return;
    }
    if (target.nodeCategory !== 'helm-explorer-node') {
        vscode.window.showErrorMessage('This command applies only to charts or chart versions in Helm repos');
        return;
    }

    // TODO: we need a version-safe API on the k8s side
    const repoEntry = target as HelmRepoEntry;

    // TODO: we should actually insert this as a snippet so as to position
    // the cursor for replacement
    const needToCreateAction = (installAction === undefined);
    const stepYAML = makeStepYAML(repoEntry, needToCreateAction);
    const snippet = new vscode.SnippetString(stepYAML);
    const insertLine = findInsertLine(editor, installAction);
    editor.insertSnippet(snippet, new vscode.Position(insertLine, 0));
}

function makeStepYAML(repoEntry: HelmRepoEntry, createAction: boolean): string {
    const versionYAML = makeVersionYAML(repoEntry);
    const actionYAML = createAction ? 'install:\n' : '';

    const yaml = `${actionYAML}  - helm:
      chart: ${repoEntry.id}
      name: \${1:${repoEntry.id}}
      description: \${2:Install Helm chart ${repoEntry.id}}${versionYAML}`;

    return yaml + '\n';
}

function makeVersionYAML(repoEntry: HelmRepoEntry): string {
    if (repoEntry.kind === 2) {
        return `\n      version: ${repoEntry.version}`;  // TODO: CRLF line break?
    }
    return '';
}

function findInsertLine(editor: vscode.TextEditor, action: ast.PorterActionYAML | undefined): number {
    // Are we in an install step?  If so, insert after that step.
    // Otherwise, if there is an install step, insert after all install steps,
    // otherwise end of document.
    if (!action) {
        return editor.document.lineCount;
    }
    if (action.steps.length === 0) {
        return action.startLine + 1;
    }

    const cursorPosition = editor.selection.active;
    const cursorLine = cursorPosition.line;
    const cursorStepIndex = containingStepIndex(action.steps, cursorLine);

    // case of outside the action or in the last step of the action
    if (cursorStepIndex === undefined || cursorStepIndex === action.steps.length - 1) {
        const lastStepLine = Math.max(...action.steps.map((s) => s.endLine));
        return lastStepLine + 1;
    }

    const insertLine = action.steps[cursorStepIndex + 1].startLine;
    return insertLine;
}

function containingStepIndex(steps: ReadonlyArray<ast.PorterStepYAML>, line: number): number | undefined {
    const index = steps.findIndex((s) => s.startLine <= line && line <= s.endLine);
    return (index < 0) ? undefined : index;
}

function findLine(document: vscode.TextDocument, line: string): number | undefined {
    for (let i = 0; i < document.lineCount; ++i) {
        const lineText = document.lineAt(i).text.trim();
        if (lineText === line) {
            return i;
        }
    }
    return undefined;
}

function syntheticAction(editor: vscode.TextEditor, actionName: string): ast.PorterActionYAML | undefined {
    // if the action has no steps then it may not be parsed as an action
    const unparsedActionLine = findLine(editor.document, `${actionName}:`);
    if (unparsedActionLine !== undefined) {
        return { name: actionName, startLine: unparsedActionLine, endLine: unparsedActionLine, steps: [] };
    }
    return undefined;
}
