import * as vscode from 'vscode';

import { linters } from './diagnostics';
import * as ast from '../porter/ast';
import { flatten } from '../utils/array';

export function create(): vscode.CodeActionProvider {
    return new PorterCodeActionProvider();
}

class PorterCodeActionProvider implements vscode.CodeActionProvider {
    provideCodeActions(document: vscode.TextDocument, range: vscode.Range | vscode.Selection, context: vscode.CodeActionContext, token: vscode.CancellationToken): vscode.ProviderResult<(vscode.Command | vscode.CodeAction)[]> {
        // TODO: it would be really good if we could cache some of this info inside the Diagnostic, because
        // it seems like we are repeating calculations...
        if (!isLintable(document)) {
            return [];
        }

        const manifest = ast.parse(document.getText());
        if (!manifest) {
            return [];
        }

        const actions = linters.map((l) => l.fixes(document, manifest, context.diagnostics));
        return flatten(...actions);
    }
}

function isLintable(document: vscode.TextDocument): boolean {
    return document.uri.fsPath.endsWith('porter.yaml');
}
