import * as vscode from 'vscode';

import * as ast from '../porter/ast';
import { usableVariablesAt } from '../porter/semanticmodel';

export function create(): vscode.CompletionItemProvider {
    return new PorterVariablesCompletionProvider();
}

export const COMPLETION_TRIGGERS = ['b', '.'] as const;

class PorterVariablesCompletionProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        const lineText = document.lineAt(position.line).text;
        const beforeText = lineText.substr(0, position.character);  // NOTE: includes the trigger character
        const templateStartIndex = beforeText.lastIndexOf('{{');
        if (templateStartIndex < 0) {
            return undefined;
        }

        const textToComplete = beforeText.substr(templateStartIndex + 2).trim();

        // Plan:
        // * Assemble all possible candidates (all usable variable texts)
        // * Bung in 'bundle' and 'bundle.{x for x in var_types where there_are_any}' at the top of the list
        // * Filter to the ones that start with the textToComplete
        //
        // This plan doesn't work because bundle.pa + accept bundle.parameters.foo => bundle.bundle.parameters.foo
        // So we also need to prune completed prefixes back to the last trigger character.

        const manifest = ast.parse(document.getText());
        if (!manifest) {
            return undefined;
        }

        const variables = usableVariablesAt(manifest, position.line).map((v) => v.text);
        const candidates = ['bundle', 'bundle.parameters', 'bundle.credentials', 'bundle.outputs'].concat(variables);  // TODO: remove categories that don't have any members
        const viableCandidates = candidates.filter((c) => c.startsWith(textToComplete))
                                           .map((c) => removeCompletedPrefixes(c, textToComplete));

        return viableCandidates.map((c) => new vscode.CompletionItem(c, vscode.CompletionItemKind.Reference));
    }
}

function removeCompletedPrefixes(completionText: string, textToComplete: string): string {
    // We know that completionText starts with textToComplete
    const separatorIndex = textToComplete.lastIndexOf('.');
    if (separatorIndex < 0) {
        return completionText;
    }
    return completionText.substr(separatorIndex + 1);
}
