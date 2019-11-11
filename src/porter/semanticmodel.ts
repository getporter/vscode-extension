import * as ast from './ast';

export interface UsableVariable {
    readonly text: string;
    readonly usableFromLine?: number;
    readonly usableToLine?: number;
}

export function anyUsableAt(lineIndex: number, usable: UsableVariable[]): boolean {
    return usable.some((v) => usableAt(lineIndex, v));
}

export function usableAt(lineIndex: number, variable: UsableVariable): boolean {
    if (variable.usableFromLine && variable.usableToLine) {
        return variable.usableFromLine <= lineIndex && lineIndex <= variable.usableToLine;
    }
    return true;
}

export function usableVariablesAt(manifest: ast.PorterManifestYAML, lineIndex: number): readonly UsableVariable[] {
    return Array.of(...usableVariables(manifest)).filter((v) => usableAt(lineIndex, v));
}

export function* usableVariables(manifest: ast.PorterManifestYAML): IterableIterator<UsableVariable> {
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
