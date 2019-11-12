import * as vscode from 'vscode';

import * as ast from '../porter/ast';
import { Linter } from './linter';
import { UNDECLARED_VARIABLES_LINTER } from './undeclaredvariables';

export const linters: readonly Linter[] = [
    UNDECLARED_VARIABLES_LINTER,
];

export function initialise() {
    const diagnostics = vscode.languages.createDiagnosticCollection('Porter');
    const lintDocument = lintTo(diagnostics);

    vscode.workspace.onDidOpenTextDocument(lintDocument);
    vscode.workspace.onDidChangeTextDocument((e) => lintDocument(e.document));  // TODO: we could use the change hint
    vscode.workspace.onDidSaveTextDocument(lintDocument);
    vscode.workspace.onDidCloseTextDocument((d) => diagnostics.delete(d.uri));
    vscode.workspace.textDocuments.forEach(lintDocument);
}

function lintTo(reporter: vscode.DiagnosticCollection): (document: vscode.TextDocument) => Promise<void> {
    return (document) => lintDocumentTo(document, reporter);
}

async function lintDocumentTo(document: vscode.TextDocument, reporter: vscode.DiagnosticCollection): Promise<void> {
    // Is it a Porter manifest?
    if (!isLintable(document)) {
        return;
    }
    const manifest = ast.parse(document.getText());
    if (!manifest) {
        return;
    }
    const linterPromises = linters.map((l) => l.lint(document, manifest));
    const linterResults = await Promise.all(linterPromises);
    const diagnostics = ([] as vscode.Diagnostic[]).concat(...linterResults);
    reporter.set(document.uri, diagnostics);
}

function isLintable(document: vscode.TextDocument): boolean {
    return document.uri.fsPath.endsWith('porter.yaml');
}
