import * as vscode from 'vscode';
import levenshtein = require('js-levenshtein');

import { Linter } from './linter';
import * as ast from '../porter/ast';
import { flatten } from '../utils/array';

const MAX_TOLERANCE = 10;
const MAX_OFFERED_FIXES = 5;

class UndeclaredVariablesLinter implements Linter {
    async lint(document: vscode.TextDocument, manifest: ast.PorterManifestYAML): Promise<vscode.Diagnostic[]> {
        const diagnostics = lint(document, manifest);
        return Array.of(...diagnostics);
    }

    fixes(document: vscode.TextDocument, manifest: ast.PorterManifestYAML, diagnostics: vscode.Diagnostic[]): vscode.CodeAction[] {
        const fixables = diagnostics.filter((d) => d.code === DIAGNOSTIC_NO_DEFINITION);
        const actions = fixables.map((f) => fixes(f, document, manifest));
        return flatten(...actions);
    }
}

function* lint(document: vscode.TextDocument, manifest: ast.PorterManifestYAML): IterableIterator<vscode.Diagnostic> {
    const usable = Array.of(...usableVariables(manifest));
    for (const reference of references(manifest)) {
        const errorInfo = usageError(reference.text, reference.textRange.start.line, usable);
        if (errorInfo) {
            const [error, code] = errorInfo;
            const diagnostic = new vscode.Diagnostic(reference.textRange, error, vscode.DiagnosticSeverity.Error);
            diagnostic.code = code;
            yield diagnostic;
        }
    }
}

function references(manifest: ast.PorterManifestYAML): ast.PorterTemplateYAML[] {
    return manifest.templates.filter(isReference);
}

function isReference(template: ast.PorterTemplateYAML) {
    return template.text.startsWith('bundle.');
}

const DIAGNOSTIC_NO_DEFINITION = 'porter_no_definition';
const DIAGNOSTIC_DEFINITION_NOT_AVAILABLE = 'porter_definition_not_available';

function usageError(text: string, lineIndex: number, usable: UsableVariable[]): [string, string] | undefined {
    const definitions = usable.filter((v) => v.text === text);
    if (definitions.length === 0) {
        return [`Cannot find definition for ${text}`, DIAGNOSTIC_NO_DEFINITION];
    }
    if (!anyUsableAt(lineIndex, definitions)) {
        return [`Cannot use ${text} here - check where it is defined`, DIAGNOSTIC_DEFINITION_NOT_AVAILABLE];
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

function usableVariablesAt(manifest: ast.PorterManifestYAML, lineIndex: number): readonly UsableVariable[] {
    return Array.of(...usableVariables(manifest)).filter((v) => usableAt(lineIndex, v));
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

function fixes(diagnostic: vscode.Diagnostic, document: vscode.TextDocument, manifest: ast.PorterManifestYAML): readonly vscode.CodeAction[] {
    return proposeDeclarations(diagnostic, document, manifest, diagnostic.range.start);
}

function proposeDeclarations(diagnostic: vscode.Diagnostic, document: vscode.TextDocument, manifest: ast.PorterManifestYAML, position: vscode.Position): readonly vscode.CodeAction[] {
    const faultyText = document.getText(diagnostic.range);

    const candidates = usableVariablesAt(manifest, position.line)
                           .map((v) => ({ decl: v, score: levenshtein(v.text, faultyText) }))
                           .sort((v1, v2) => v1.score - v2.score);

    return candidates.filter((c) => c.score <= MAX_TOLERANCE)
                     .slice(0, MAX_OFFERED_FIXES)
                     .map((c) => substituteDeclarationAction(document, diagnostic.range, c.decl.text));
}

function substituteDeclarationAction(document: vscode.TextDocument, range: vscode.Range, proposed: string): vscode.CodeAction {
    const action = new vscode.CodeAction(`Change to ${proposed}`, vscode.CodeActionKind.QuickFix);
    action.edit = substituteDeclarationEdit(document, range, proposed);
    return action;
}

function substituteDeclarationEdit(document: vscode.TextDocument, range: vscode.Range, proposed: string): vscode.WorkspaceEdit {
    const edit = new vscode.WorkspaceEdit();
    edit.replace(document.uri, range, proposed);
    return edit;
}

export const UNDECLARED_VARIABLES_LINTER = new UndeclaredVariablesLinter();
