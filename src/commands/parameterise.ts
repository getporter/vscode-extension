import * as vscode from 'vscode';

import * as ast from '../porter/ast';
import { findPorterManifestDocument } from '../utils/manifestselection';
import { CommandResult } from './result';

export async function parameteriseSelection(): Promise<CommandResult> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('This command requires an open text editor');
        return CommandResult.Failed;
    }

    const selection = editor.selection;
    if (selection.isEmpty) {
        vscode.window.showErrorMessage('This command requires you to select some text first');
        return CommandResult.Failed;
    }

    const selectionRange = new vscode.Range(selection.start, selection.end);

    const sourceText = editor.document.getText(selection);
    if (sourceText.trim().length === 0) {
        vscode.window.showErrorMessage('This command requires you to select some text first');
        return CommandResult.Failed;
    }

    const activeDocument = editor.document;

    const porterManifestDocument = await findPorterManifestDocument(activeDocument);
    if (!porterManifestDocument) {
        vscode.window.showErrorMessage('This command requires a folder containing a porter.yaml file');
        return CommandResult.Failed;
    }

    const manifest = ast.parse(porterManifestDocument.getText());
    if (!manifest) {
        vscode.window.showErrorMessage('This command requires the porter.yaml file to be valid; yours currently has errors');
        return CommandResult.Failed;
    }

    const wsedit = makeParameterisationEdits(activeDocument, porterManifestDocument, manifest, selectionRange, sourceText);

    const edited = await vscode.workspace.applyEdit(wsedit);
    if (!edited) {
        vscode.window.showErrorMessage('Unable to extract the selection to a parameter');
        return CommandResult.Failed;
    }

    // TODO: consider switching to porter.yaml and putting the cursor on the new parameter
    // (or we could use an insertSnippet though that doesn't coordinate with changes to the
    // source document if we make them)

    return CommandResult.Succeeded;
}

function makeParameterisationEdits(sourceDocument: vscode.TextDocument, porterManifest: vscode.TextDocument, manifest: ast.PorterManifestYAML, sourceRange: vscode.Range, sourceText: string): vscode.WorkspaceEdit {
    const edit = new vscode.WorkspaceEdit();

    const name = safeName(sourceText);

    const parameterDefinitionText = `  - name: ${name}\n    default: ${sourceText}\n    description: Replaces '${sourceText}' in original\n`;
    if (manifest.parameters) {
        // insert the text after the section (or, for now, as the top line of the section)
        const position = new vscode.Position(manifest.parameters.startLine + 1, 0);
        edit.insert(porterManifest.uri, position, parameterDefinitionText);
    } else {
        // prefix with `parameters:\n` and stick it any old where
        const parametersSectionText = `\nparameters:\n${parameterDefinitionText}`;
        const position = endPosition(porterManifest);
        edit.insert(porterManifest.uri, position, parametersSectionText);
    }

    if (sourceDocument === porterManifest) {
        const willReplaceEntireValue = isEntireValue(sourceDocument, sourceRange);  // e.g. foo: {{ bundle.parameters.bar }} would be invalid - has to be foo: "{{ bundle.parameters.bar }}"
        edit.replace(sourceDocument.uri, sourceRange, parameterReference(name, willReplaceEntireValue));
    }

    return edit;
}

function endPosition(document: vscode.TextDocument): vscode.Position {
    const lastLineIndex = document.lineCount - 1;
    const lastLine = document.lineAt(lastLineIndex);
    return lastLine.range.end;
}

function safeName(s: string): string {
    const words = s.replace(/[^a-zA-Z0-9]/g, ' ').trim().split(' ');
    const camelised = camelise(words);
    return camelised;
}

function camelise(words: readonly string[]): string {
    if (!words || words.length === 0) {
        return 'parameter';
    }
    const lowercased = words.filter((w) => w.length > 0).map((w) => w.toLowerCase());
    const titlecased = lowercased.map((w) => titlecase(w));
    return lowercased[0] + titlecased.slice(1).join('');
}

function titlecase(s: string): string {
    return s[0].toUpperCase() + s.substring(1);
}

function parameterReference(name: string, isReferenceEntireYAMLValue: boolean): string {
    const reference = `{{ bundle.parameters.${name} }}`;
    if (isReferenceEntireYAMLValue) {
        return `"${reference}"`;
    }
    return reference;
}

function isEntireValue(document: vscode.TextDocument, range: vscode.Range): boolean {
    const line = document.lineAt(range.start.line).text;
    const lineBefore = line.substr(0, range.start.character).trim();
    // This is pretty rough and heuristic.  We could bring out the full YAML parser
    // to get a better indicator, but it's probably not worth it given that the user
    // can easily edit problems away if we get it wrong.
    return (lineBefore.endsWith(':') || lineBefore.endsWith('-'));
}
