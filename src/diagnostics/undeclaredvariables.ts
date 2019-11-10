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
    for (const reference of references(manifest)) {
        const error = usageError(reference.text, reference.textRange.start.line, usable);
        if (error) {
            yield new vscode.Diagnostic(reference.textRange, error, vscode.DiagnosticSeverity.Error);
        }
    }
}

function references(manifest: ast.PorterManifestYAML): ast.PorterTemplateYAML[] {
    return manifest.templates.filter(isReference);
}

function isReference(template: ast.PorterTemplateYAML) {
    return template.text.startsWith('bundle.');
}

function usageError(text: string, lineIndex: number, usable: UsableVariable[]): string | undefined {
    const definitions = usable.filter((v) => v.text === text);
    if (definitions.length === 0) {
        return `Cannot find definition for ${text}`;
    }
    if (!anyUsableAt(lineIndex, definitions)) {
        return `Cannot use ${text} here - check where it is defined`;
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
