import * as vscode from 'vscode';
import { Linter } from './linter';
import * as ast from '../porter/ast';

class UndeclaredVariablesLinter implements Linter {
    async lint(document: vscode.TextDocument, manifest: ast.PorterManifestYAML): Promise<vscode.Diagnostic[]> {
        const diagnostics = lint(document, manifest);
        return Array.of(...diagnostics);
    }
}

function* lint(document: vscode.TextDocument, manifest: ast.PorterManifestYAML) {
}

export const UNDECLARED_VARIABLES_LINTER = new UndeclaredVariablesLinter();
