import * as vscode from 'vscode';

import * as ast from '../porter/ast';
import { findPorterManifestDocument } from '../utils/manifestselection';

export async function parameteriseSelection(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        await vscode.window.showErrorMessage('This command requires an open text editor');
        return;
    }

    const selection = editor.selection;
    if (selection.start.isEqual(selection.end)) {
        await vscode.window.showErrorMessage('This command requires you to select some text first');
        return;
    }

    const activeDocument = editor.document;

    const porterManifestDocument = await findPorterManifestDocument(activeDocument);
    if (!porterManifestDocument) {
        await vscode.window.showErrorMessage('This command requires a folder containing a porter.yaml file');
        return;
    }

    const manifest = ast.parse(porterManifestDocument.getText());
    if (!manifest) {
        await vscode.window.showErrorMessage('This command requires the porter.yaml file to be valid; yours currently has errors');
        return;
    }

    const text = editor.document.getText(selection);

    const wsedit = makeParameterisationEdits(porterManifestDocument, manifest, text);

    const edited = await vscode.workspace.applyEdit(wsedit);
    if (!edited) {
        await vscode.window.showErrorMessage('Unable to extract the selection to a parameter');
        return;
    }

    // TODO: consider switching to porter.yaml and putting the cursor on the new parameter
    // (or we could use an insertSnippet though that doesn't coordinate with changes to the
    // source document if we make them)
}

function makeParameterisationEdits(porterManifest: vscode.TextDocument, manifest: ast.PorterManifestYAML, sourceText: string): vscode.WorkspaceEdit {
    const edit = new vscode.WorkspaceEdit();

    const name = safeName(sourceText);

    const parameterDefinitionText = `  - name: ${name}\n    default: ${sourceText}\n    description: TO BE WORKED OUT\n`;
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

    // TODO: if the active document is porter.yaml, replace the selected text with {{ bundle.paraneters.${name} }}

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
