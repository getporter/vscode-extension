import * as vscode from 'vscode';
import * as ast from '../porter/ast';

export function create(): vscode.DefinitionProvider {
    return new PorterDefinitionProvider();
}

class PorterDefinitionProvider implements vscode.DefinitionProvider {
    provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Location | vscode.Location[] | vscode.LocationLink[]> {
        // Plan:
        // * Look around position for the nearest pair of matching {{ }} braces
        // * If the contents of the braces, trimmed, is *only* 'bundle.<pattern-tba>', we have a candidate reference
        // * Parse the pattern:
        //    * If parameter, locate it in the parameters section
        //    * If credential, locate it in the credentials section
        //    * If output, locate the step which defines it, then locate the output in the outputs section
        //  * If not found, return undefined; otherwise return the location

        const line = document.lineAt(position.line);  // Assume references do not break across lines because COME ON PEOPLE
        // const before = line.text.substring(0, position.character);
        // const after = line.text.substring(position.character);
        // TODO: should it work if you are on the braces themselves?  If so need to smart this up
        const openingBraceIndex = line.text.lastIndexOf('{{', position.character);
        const closingBraceIndex = line.text.indexOf('}}', position.character);

        if (openingBraceIndex < 0 || closingBraceIndex < 0) {
            return undefined;
        }

        const fullSourceText = line.text.substring(openingBraceIndex + 2, closingBraceIndex);
        const sourceText = fullSourceText.trim();

        const reference = parseReference(sourceText);
        if (!reference) {
            return undefined;
        }

        const manifest = ast.parse(document.getText());
        if (!manifest) {
            return undefined;
        }

        const location = locationIn(manifest, reference, position);
        if (!location) {
            return undefined;
        }

        return new vscode.Location(document.uri, location);
    }
}

interface Reference {
    readonly kind: 'parameter' | 'credential' | 'output';
    readonly name: string;
}

function parseReference(text: string): Reference | undefined {
    const bits = text.trim().split('.');
    if (bits.length !== 3) {
        return undefined;
    }
    if (bits[0] !== 'bundle') {
        return undefined;
    }
    const kind = asReferenceKind(bits[1]);
    if (!kind) {
        return undefined;
    }
    const name = bits[2];
    return { kind, name };
}

function asReferenceKind(text: string): 'parameter' | 'credential' | 'output' | undefined {
    switch (text) {
        case 'parameters': return 'parameter';
        case 'credentials': return 'credential';
        case 'outputs': return 'output';
        default: return undefined;
    }
}

function locationIn(manifest: ast.PorterManifestYAML, reference: Reference, referencePosition: vscode.Position): vscode.Range | undefined {
    if (reference.kind === 'output') {
        const step = stepContaining(manifest, referencePosition);
        if (!step) {
            return undefined;
        }
        const definition = step.outputs.find((s) => s.name === reference.name);
        if (!definition) {
            return undefined;
        }
        return new vscode.Range();
    }

    const definitions = reference.kind === 'parameter' ? manifest.parameters : manifest.credentials;
    if (!definitions) {
        return undefined;
    }
    return find_the_name_in_the_section;
}

function stepContaining(manifest: ast.PorterManifestYAML, position: vscode.Position): ast.PorterStepYAML | undefined {

}
