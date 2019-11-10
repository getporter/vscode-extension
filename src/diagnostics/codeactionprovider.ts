import * as vscode from 'vscode';
import levenshtein = require('js-levenshtein');

import * as ast from '../porter/ast';
import { DIAGNOSTIC_NO_DEFINITION } from './undeclaredvariables';

export function create(): vscode.CodeActionProvider {
    return new PorterCodeActionProvider();
}

class PorterCodeActionProvider implements vscode.CodeActionProvider {
    provideCodeActions(document: vscode.TextDocument, range: vscode.Range | vscode.Selection, context: vscode.CodeActionContext, token: vscode.CancellationToken): vscode.ProviderResult<(vscode.Command | vscode.CodeAction)[]> {
        // TODO: it would be really good if we could cache some of this info inside the Diagnostic, because
        // it seems like we are repeating calculations...
        const actions = Array.of<vscode.CodeAction>();
        context.diagnostics
               .filter((d) => d.code === DIAGNOSTIC_NO_DEFINITION)
               .map((d) => proposeDeclarations(d, document, range.start))
               .forEach((a) => actions.push(...a));
        return actions;
    }
}

const MAX_TOLERANCE = 10;
const MAX_OFFERED_FIXES = 5;

function proposeDeclarations(diagnostic: vscode.Diagnostic, document: vscode.TextDocument, position: vscode.Position): readonly vscode.CodeAction[] {
    const faultyText = document.getText(diagnostic.range);

    const manifest = ast.parse(document.getText());
    if (!manifest) {
        return [];
    }

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

function usableVariablesAt(manifest: ast.PorterManifestYAML, lineIndex: number): readonly UsableVariable[] {
    return Array.of(...usableVariables(manifest)).filter((v) => usableAt(lineIndex, v));
}

// TODO: THIS IS COPIED FROM undeclaredvariables.ts

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

// TODO: ^^ LET'S JOIN THEM TOGETHER ^^
