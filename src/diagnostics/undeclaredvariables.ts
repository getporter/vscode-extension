import * as vscode from 'vscode';
import { Linter } from './linter';
import * as ast from '../porter/ast';

class UndeclaredVariablesLinter implements Linter {
    async lint(document: vscode.TextDocument, manifest: ast.PorterManifestYAML): Promise<vscode.Diagnostic[]> {
        const diagnostics = lint(document, manifest);
        return Array.of(...diagnostics);
    }
}

function* lint(document: vscode.TextDocument, manifest: ast.PorterManifestYAML): IterableIterator<vscode.Diagnostic> {
    for (let lineIndex = 0; lineIndex < document.lineCount; ++lineIndex) {
        const line = document.lineAt(lineIndex).text;
        for (const reference of references(line)) {
            if (undeclared(reference)) {
                const range = new vscode.Range(lineIndex, reference.startIndex, lineIndex, reference.endIndex);
                yield new vscode.Diagnostic(range, `Cannot find declaration for '${reference.text}'`, vscode.DiagnosticSeverity.Error);
            }
        }
    }
}

interface Reference {
    readonly startIndex: number;
    readonly endIndex: number;
    readonly text: string;
}

function* references(text: string): IterableIterator<Reference> {
    // TODO: check if commented out

    let searchedTo = 0;
    while (true) {
        const openingBraceIndex = text.indexOf('{{', searchedTo);

        if (openingBraceIndex < 0) {
            return;
        }

        const closingBraceIndex = text.indexOf('}}', openingBraceIndex);

        if (closingBraceIndex < 0) {
            return;
        }

        const candidateText = text.substring(openingBraceIndex + 2, closingBraceIndex).trim();
        const textStartIndex = text.indexOf(candidateText, openingBraceIndex);

        if (candidateText.startsWith('bundle.')) {
            yield {
                startIndex: textStartIndex,
                endIndex: textStartIndex + candidateText.length,
                text: candidateText
            };
        }

        searchedTo = closingBraceIndex;
    }
}

function undeclared(reference: Reference): boolean {
    return true;
}

export const UNDECLARED_VARIABLES_LINTER = new UndeclaredVariablesLinter();
