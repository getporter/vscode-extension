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
    const usable = Array.of(...usableVariables(manifest));
    for (let lineIndex = 0; lineIndex < document.lineCount; ++lineIndex) {
        const line = document.lineAt(lineIndex).text;
        for (const reference of references(line)) {
            const error = usageError(reference, lineIndex, usable);
            if (error) {
                const range = new vscode.Range(lineIndex, reference.startIndex, lineIndex, reference.endIndex);
                yield new vscode.Diagnostic(range, error, vscode.DiagnosticSeverity.Error);
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

function usageError(reference: Reference, lineIndex: number, usable: UsableVariable[]): string | undefined {
    const definitions = usable.filter((v) => v.text === reference.text);
    if (definitions.length === 0) {
        return `Cannot find definition for ${reference.text}`;
    }
    if (!anyUsableAt(lineIndex, definitions)) {
        return `Cannot use ${reference.text} here - check where it is defined`;
    }
    return undefined;
}

function anyUsableAt(lineIndex: number, usable: UsableVariable[]): boolean {
    return usable.some((v) => usableAt(lineIndex, v));
}

function usableAt(lineIndex: number, variable: UsableVariable): boolean {
    if (variable.usableFromLine && variable.usableToLine) {
        return variable.usableFromLine <= lineIndex && lineIndex <= variable.usableToLine;
    }
    return true;
}

interface UsableVariable {
    readonly text: string;
    readonly usableFromLine?: number;
    readonly usableToLine?: number;
}

function* usableVariables(manifest: ast.PorterManifestYAML): IterableIterator<UsableVariable> {
    if (manifest.parameters) {
        for (const e of manifest.parameters.entries) {
            yield { text: `bundle.parameters.${e.name}` };
        }
    }

    if (manifest.credentials) {
        for (const e of manifest.credentials.entries) {
            yield { text: `bundle.credentials.${e.name}` };
        }
    }

    for (const a of manifest.actions) {
        for (const s of a.steps) {
            for (const o of s.outputs) {
                yield { text: `bundle.outputs.${o.name}`, usableFromLine: s.endLine, usableToLine: a.endLine };
            }
        }
    }
}

export const UNDECLARED_VARIABLES_LINTER = new UndeclaredVariablesLinter();
