import * as vscode from 'vscode';

import * as ast from '../porter/ast';
import { findAll } from '../utils/string';
import '../utils/array';

export function create(): vscode.ReferenceProvider {
    return new PorterReferenceProvider();
}

class PorterReferenceProvider implements vscode.ReferenceProvider {
    provideReferences(document: vscode.TextDocument, position: vscode.Position, context: vscode.ReferenceContext, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Location[]> {
        // The plan:
        //
        // * Work out what the heck we are on - a parameter def, a credential def, an output def
        // * Compose the appropriate reference string e.g. bundle.parameters.whatever
        // * Search for that string in:
        //   - for parameters or credentials, all of porter.yaml
        //   - for outputs, only the action where the output is defined
        // * When encountered, confirm that it is braced (and ideally not commented!) and therefore truly a reference
        // * Add it to the list
        //
        // For param or cred defs that are mapped to env vars, finding uses of those env vars in the
        // workspace would be SUPER DUPER COOL, but also PHENOMENALLY DIFFICULT.

        const documentText = document.getText();

        const manifest = ast.parse(documentText);
        if (!manifest) {
            return undefined;
        }

        const definition = definitionAt(manifest, position);
        if (!definition) {
            return undefined;
        }

        const referenceString = referenceText(definition);
        const referenceCandidateIndexes = findAll(documentText, referenceString);
        const referenceRanges = referenceCandidateIndexes.choose((i) => referenceRange(documentText, i, referenceString))
                                                         .map(([start, end]) => new vscode.Range(document.positionAt(start), document.positionAt(end)));

        return referenceRanges.map((r) => new vscode.Location(document.uri, r));
    }
}

interface GlobalDefinition {
    readonly kind: 'parameter' | 'credential';
    readonly name: string;
}

interface ActionScopeDefinition {
    readonly kind: 'output';
    readonly name: string;
    readonly scope: ast.PorterActionYAML;
}

type Definition = GlobalDefinition | ActionScopeDefinition;

function definitionAt(manifest: ast.PorterManifestYAML, position: vscode.Position): Definition | undefined {
    if (manifest.parameters) {
        for (const e of manifest.parameters.entries) {
            if (e.nameRange.contains(position)) {
                return { kind: 'parameter', name: e.name };
            }
        }
    }

    if (manifest.credentials) {
        for (const e of manifest.credentials.entries) {
            if (e.nameRange.contains(position)) {
                return { kind: 'credential', name: e.name };
            }
        }
    }

    for (const a of manifest.actions) {
        for (const s of a.steps) {
            for (const o of s.outputs) {
                if (o.nameRange.contains(position)) {
                    return { kind: 'output', name: o.name, scope: a };
                }
            }
        }
    }

    return undefined;
}

function referenceText(definition: Definition): string {
    return `bundle.${referenceKindText(definition)}.${definition.name}`;
}

function referenceKindText(definition: Definition): string {
    switch (definition.kind) {
        case 'parameter': return 'parameters';
        case 'credential': return 'credentials';
        case 'output': return 'outputs';
    }
}

function referenceRange(text: string, candidateIndex: number, candidateText: string): [number, number] | undefined {
    // We know the candidateText starts at candidateIndex
    const openingBraceIndex = text.lastIndexOf('{{', candidateIndex);
    const closingBraceIndex = text.indexOf('}}', candidateIndex);

    if (openingBraceIndex < 0 || closingBraceIndex < 0) {
        return undefined;
    }

    const fullCandidateText = text.substring(openingBraceIndex + 2, closingBraceIndex);
    if (fullCandidateText.trim() !== candidateText) {
        return undefined;  // There's something else in the braces: it's not a reference
    }

    // TODO: check if it's commented out

    return [candidateIndex, candidateIndex + candidateText.length];
}
