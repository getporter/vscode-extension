import * as yaml from 'yaml-ast-parser';
import { YAMLSequence, YAMLNode } from 'yaml-ast-parser';
import '../utils/array';
import { definedOf } from '../utils/array';
import { Range, Position } from 'vscode';

export interface PorterManifestYAML {
    readonly parameters: PorterDefinitionsYAML | undefined;
    readonly credentials: PorterDefinitionsYAML | undefined;
    readonly actions: ReadonlyArray<PorterActionYAML>;
    readonly templates: ReadonlyArray<PorterTemplateYAML>;
}

export interface PorterDefinitionsYAML {
    readonly startLine: number;
    readonly entries: ReadonlyArray<PorterDefinitionYAML>;
}

export interface PorterDefinitionYAML {
    readonly name: string;
    readonly nameRange: Range;
}

export interface PorterTemplateYAML {
    readonly text: string;
    readonly textRange: Range;
    readonly templateRange: Range;
}

export interface PorterActionYAML {
    readonly name: string;
    readonly startLine: number;
    readonly endLine: number;
    readonly steps: ReadonlyArray<PorterStepYAML>;
}

export interface PorterStepYAML {
    readonly startLine: number;
    readonly endLine: number;
    readonly outputs: ReadonlyArray<PorterDefinitionYAML>;
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
        const parametersMapping = mappings.find((m) => m.key && m.key.value === 'parameters');
        const credentialsMapping = mappings.find((m) => m.key && m.key.value === 'credentials');
        const actionMappings = mappings.filter((m) => m.key && m.value && m.value.kind === yaml.Kind.SEQ && nonStepArrays.indexOf(m.key.value) < 0);  // TODO: better heuristics?
        const templates = this.parseTemplates(ast);

        return {
            parameters: this.asDefinitionsAST(parametersMapping),
            credentials: this.asDefinitionsAST(credentialsMapping),
            actions: actionMappings.map((m) => this.asActionAST(m)),
            templates: templates
        };
    }

    private asDefinitionsAST(m: yaml.YAMLMapping | undefined): PorterDefinitionsYAML | undefined {
        if (!m) {
            return undefined;
        }
        return {
            startLine: this.lineOf(m.startPosition),
            entries: this.asDefinitionASTs(m.value)
        };
    }

    private asDefinitionASTs(value: yaml.YAMLNode): readonly PorterDefinitionYAML[] {
        if (value.kind !== yaml.Kind.SEQ) {
            return [];
        }
        const node = value as yaml.YAMLSequence;
        const definitionNodes = node.items;
        const definitionCandidates = definitionNodes.filter((n) => n.kind === yaml.Kind.MAP)
                                                    .map((n) => n as yaml.YamlMap);
        return definitionCandidates.choose((m) => this.asDefinitionAST(m));
    }

    private asActionAST(m: yaml.YAMLMapping): PorterActionYAML {
        const actionName = m.key.value;
        const lineSpan = this.lineSpanOf(m);
        const steps = (m.value as yaml.YAMLSequence).items;
        const stepMappings = steps.filter((s) => s.kind === yaml.Kind.MAP).map((s) => s as yaml.YamlMap);
        const steppaz = stepMappings.map((sm) => this.asStepAST(sm));
        return {
            name: actionName,
            startLine: lineSpan.startLine,
            endLine: lineSpan.endLine,
            steps: definedOf(...steppaz)
        };
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
        const stepLineSpan = this.lineSpanOf(step);
        const stepDataMappings = (stepData as yaml.YamlMap).mappings;
        const outputSection = stepDataMappings.find((dm) => dm.key.value === 'outputs');
        if (!outputSection) {
            return {
                outputs: [],
                ...stepLineSpan
            };
        }
        if (outputSection.value.kind !== yaml.Kind.SEQ) {
            return undefined;
        }
        const outputEntries = (outputSection.value as YAMLSequence).items.filter((o) => o.kind === yaml.Kind.MAP).map((o) => o as yaml.YamlMap);
        return {
            outputs: definedOf(...outputEntries.map((o) => this.asDefinitionAST(o))),
            ...stepLineSpan
        };
    }

    private asDefinitionAST(o: yaml.YamlMap): PorterDefinitionYAML | undefined {
        const nameMapping = o.mappings.find((m) => m.key.value === 'name');
        if (!nameMapping) {
            return undefined;
        }
        return { name: nameMapping.value.value, nameRange: this.rangeOf(nameMapping) };
    }

    private parseTemplates(root: yaml.YAMLNode): PorterTemplateYAML[] {
        const templates = Array.of<TemplateLayout>();
        const acquirer = new TemplateAcquirer(templates);
        acquirer.visitAny(root);
        return templates.map((l) => ({
            text: l.text,
            textRange: this.toDocumentRange(l.textRange),
            templateRange: this.toDocumentRange(l.fullRange)
        }));
    }

    private lineOf(position: number): number {
        for (let ln = 0; ln < this.lineStartPositions.length; ++ln) {
            if (position < this.lineStartPositions[ln]) {
                return ln - 1;
            }
        }
        return this.lineStartPositions.length;
    }

    private lineSpanOf(node: YAMLNode) {
        const [start, end] = this.trimmedRangeOf(node);
        return {
            startLine: this.lineOf(start),
            endLine: this.lineOf(end)
        };
    }

    private rangeOf(node: YAMLNode): Range {
        const range = this.trimmedRangeOf(node);
        return this.toDocumentRange(range);
    }

    private toDocumentRange([start, end]: [number, number]): Range {
        return new Range(
            this.positionOf(start),
            this.positionOf(end)
        );
    }

    private positionOf(position: number): Position {
        const lineIndex = this.lineOf(position);
        const lineStart = this.lineStartPositions[lineIndex];
        return new Position(lineIndex, position - lineStart);
    }

    private trimmedRangeOf(node: YAMLNode): [number, number] {
        const start = node.startPosition;  // TODO: can we assume there is no leading whitespace?
        const end = node.endPosition;
        const nodeText = this.yamlText.substring(start, end);
        const wsStart = nodeText.length - nodeText.trimLeft().length;
        const wsEnd = nodeText.length - nodeText.trimRight().length;
        return [start + wsStart, end - wsEnd];
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

abstract class YAMLVisitor {
    visitAny(node: yaml.YAMLNode): void {
        if (!node) {
            return;
        }
        switch (node.kind) {
            case yaml.Kind.ANCHOR_REF:
            case yaml.Kind.INCLUDE_REF:
                return;
            case yaml.Kind.MAP:
                this.visitMap(node as yaml.YamlMap);
                return;
            case yaml.Kind.MAPPING:
                this.visitMapping(node as yaml.YAMLMapping);
                return;
            case yaml.Kind.SCALAR:
                this.visitScalar(node as yaml.YAMLScalar);
                return;
            case yaml.Kind.SEQ:
                this.visitSequence(node as yaml.YAMLSequence);
                return;
        }
    }
    abstract visitMap(node: yaml.YamlMap): void;
    abstract visitMapping(node: yaml.YAMLMapping): void;
    abstract visitScalar(node: yaml.YAMLScalar): void;
    abstract visitSequence(node: yaml.YAMLSequence): void;
}

interface TemplateLayout {
    readonly text: string;
    readonly textRange: [number, number];
    readonly fullRange: [number, number];
}

class TemplateAcquirer extends YAMLVisitor {
    constructor(private readonly templates: TemplateLayout[]) {
        super();
    }
    visitMap(node: yaml.YamlMap): void {
        for (const mapping of node.mappings) {
            this.visitMapping(mapping);
        }
    }
    visitMapping(node: yaml.YAMLMapping): void {
        this.visitScalar(node.key);
        this.visitAny(node.value);
    }
    visitScalar(node: yaml.YAMLScalar): void {
        const text = node.rawValue || node.value;
        if (!text) {
            return;
        }

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

            const templateText = text.substring(openingBraceIndex + 2, closingBraceIndex).trim();
            const templateStartPosition = node.startPosition + openingBraceIndex;
            const templateEndPosition = node.startPosition + closingBraceIndex;
            const textStartIndex = text.indexOf(templateText, openingBraceIndex);
            const textStartPosition = node.startPosition + textStartIndex;
            const textEndPosition = textStartPosition + templateText.length;

            this.templates.push({
                text: templateText,
                textRange: [textStartPosition, textEndPosition],
                fullRange: [templateStartPosition, templateEndPosition]
            });

            searchedTo = closingBraceIndex;
        }
    }
    visitSequence(node: yaml.YAMLSequence): void {
        for (const item of node.items) {
            this.visitAny(item);
        }
    }
}
