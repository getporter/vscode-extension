import * as yaml from 'yaml-ast-parser';
import { YAMLSequence } from 'yaml-ast-parser';
import { definedOf } from '../utils/array';

export interface PorterManifestYAML {
    readonly actions: ReadonlyArray<PorterActionYAML>;
}

export interface PorterActionYAML {
    readonly name: string;
    readonly startLine: number;
    readonly steps: ReadonlyArray<PorterStepYAML>;
}

export interface PorterStepYAML {
    readonly startLine: number;
    readonly endLine: number;
    readonly outputs: ReadonlyArray<PorterOutputYAML>;
}

export interface PorterOutputYAML {
    readonly name: string;
}

const nonStepArrays = ['mixins', 'parameters', 'credentials'];

export function parse(yamlText: string): PorterManifestYAML | undefined {
    return new PorterManifestASTParser(yamlText).parse();
}

class PorterManifestASTParser {
    private readonly lineStartPositions: ReadonlyArray<number>;

    constructor(private readonly yamlText: string) {
        this.lineStartPositions = lineStartPositions(yamlText);
    }

    public parse(): PorterManifestYAML | undefined {
        const ast = safeLoadOrGTFO(this.yamlText);
        if (!ast) {
            return undefined;
        }

        if (ast.kind !== yaml.Kind.MAP) {
            return undefined;
        }

        const mappings = (ast as yaml.YamlMap).mappings;
        const actionMappings = mappings.filter((m) => m.key && m.value && m.value.kind === yaml.Kind.SEQ && nonStepArrays.indexOf(m.key.value) < 0);  // TODO: better heuristics?

        return {
            actions: actionMappings.map((m) => this.asActionAST(m))
        };
    }

    private asActionAST(m: yaml.YAMLMapping): PorterActionYAML {
        const actionName = m.key.value;
        const steps = (m.value as yaml.YAMLSequence).items;
        const stepMappings = steps.filter((s) => s.kind === yaml.Kind.MAP).map((s) => s as yaml.YamlMap);
        const steppaz = stepMappings.map((sm) => this.asStepAST(sm));
        return { name: actionName, startLine: this.lineOf(m.startPosition), steps: definedOf(...steppaz) };
    }

    private asStepAST(step: yaml.YamlMap): PorterStepYAML | undefined {
        const stepMap = step.mappings;
        if (stepMap.length !== 1) {
            return undefined;
        }
        const stepData = stepMap[0].value;
        if (stepData.kind !== yaml.Kind.MAP) {
            return undefined;
        }
        const stepDataMappings = (stepData as yaml.YamlMap).mappings;
        const outputSection = stepDataMappings.find((dm) => dm.key.value === 'outputs');
        if (!outputSection) {
            return {
                startLine: this.lineOf(step.startPosition),
                endLine: this.lineOf(step.endPosition),
                outputs: []
            };
        }
        if (outputSection.value.kind !== yaml.Kind.SEQ) {
            return undefined;
        }
        const outputEntries = (outputSection.value as YAMLSequence).items.filter((o) => o.kind === yaml.Kind.MAP).map((o) => o as yaml.YamlMap);
        return {
            startLine: this.lineOf(step.startPosition),
            endLine: this.lineOf(step.endPosition),
            outputs: definedOf(...outputEntries.map((o) => this.asOutputAST(o)))
        };
    }

    private asOutputAST(o: yaml.YamlMap): PorterOutputYAML | undefined {
        const nameMapping = o.mappings.find((m) => m.key.value === 'name');
        if (!nameMapping) {
            return undefined;
        }
        return { name: nameMapping.value.value };
    }

    private lineOf(position: number): number {
        for (let ln = 0; ln < this.lineStartPositions.length; ++ln) {
            if (position < this.lineStartPositions[ln]) {
                return ln - 1;
            }
        }
        return this.lineStartPositions.length;
    }
}

function safeLoadOrGTFO(yamlText: string): yaml.YAMLNode | undefined {
    try {
        return yaml.safeLoad(yamlText);
    } catch {
        return undefined;
    }
}

function lineStartPositions(text: string): ReadonlyArray<number> {
    const positions = Array.of<number>();
    for (const pos of lineStartPositionsImpl(text)) {
        positions.push(pos);
    }
    return positions;
}

function* lineStartPositionsImpl(text: string) {
    const lines = text.split('\n');
    let pos = 0;
    for (const line of lines) {
        yield pos;
        pos += line.length + 1;
    }
}
