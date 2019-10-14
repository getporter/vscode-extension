import { readFileSync } from 'fs';
import { EventEmitter } from "events";

import * as porter from '../porter/porter';
import { InstallInputs, VariableInfo, LazyVariableInfo, EVENT_STOP_ON_ENTRY, EVENT_STOP_ON_STEP, EVENT_END } from './session-protocol';
import { shell } from '../utils/shell';
import { Errorable } from '../utils/errorable';
import { CredentialSource, isValue, isEnv, isCommand, isPath } from '../porter/porter.objectmodel';
import { fs } from '../utils/fs';

export class PorterInstallRuntime extends EventEmitter {
    private sourceFilePath = '';
    private installInputs: InstallInputs | undefined = undefined;

    public get sourceFile() {
        return this.sourceFilePath;
    }

    private sourceLines: string[] = [];
    private currentLine = 0;

    constructor() {
        super();
    }

    public start(porterFilePath: string, stopOnEntry: boolean, installInputs: InstallInputs) {

        this.loadSource(porterFilePath);
        this.currentLine = -1;

        this.installInputs = installInputs;

        if (stopOnEntry) {
            this.step(EVENT_STOP_ON_ENTRY);
        } else {
            this.continue();
        }
    }

    public continue() {
        this.run(undefined);
    }

    public step(event = EVENT_STOP_ON_STEP) {
        this.run(event);
    }

    public stack(startFrame: number, endFrame: number) {
        const frame = {
            index: startFrame,
            name: "Porter",
            file: this.sourceFilePath,
            line: this.currentLine
        };
        return {
            frames: [frame],
            count: 1
        };
    }

    public getBreakpoints(path: string, line: number): number[] {
        return [];
    }

    public getParameters(): VariableInfo[] {
        const inputs = this.installInputs || { parameters: {} };
        const parameters = inputs.parameters || {};
        const parameterVariables = Object.entries(parameters).map(([k, v]) => ({ name: k, value: `${v}` }));
        return parameterVariables;
    }

    private credentials: LazyVariableInfo[] | undefined = undefined;

    public async getCredentials(): Promise<LazyVariableInfo[]> {
        if (this.credentials !== undefined)  {
            return this.credentials;
        }
        if (this.installInputs && this.installInputs.credentialSet) {
            const credentials = await porter.getCredentials(shell, this.installInputs.credentialSet);
            if (credentials.succeeded) {
                this.credentials = credentials.result.credentials.map((c) => ({ name: c.name, value: () => this.evaluateCredential(c.source) }));
                return this.credentials;
            }
        }
        return [];
    }

    public async getOutputs(): Promise<LazyVariableInfo[]> {
        // TODO: don't lie Ivan it's not polite
        // TODO: also don't parse YAML yourself Ivan you'll just get everything filthy
        const outputs = Array.of<LazyVariableInfo>();
        let inOutputsArray = false;
        let outputsIndentLevel = 0;
        for (let ln = 0; ln <= this.currentLine; ++ln) {
            const line = this.sourceLines[ln];
            if (inOutputsArray) {
                if (indentSize(line) <= outputsIndentLevel) {
                    inOutputsArray = false;
                    outputsIndentLevel = 0;
                } else if (line.includes('name:')) {
                    // We has it, we has the output*
                    // *conditions apply which I ignore for now
                    const outputName = dequote(line.substring(line.indexOf('name:') + 'name:'.length).trim());
                    outputs.push({
                        name: outputName,
                        value: async () => ({ succeeded: true, result: `(value of output ${outputName} TBD)` })
                    });
                }
            } else if (line.trim() === 'outputs:') {
                inOutputsArray = true;
                outputsIndentLevel = indentSize(line);
            }
        }
        return outputs;
    }

    private async evaluateCredential(source: CredentialSource): Promise<Errorable<string>> {
        if (isValue(source)) {
            return { succeeded: true, result: source.value };
        } else if (isEnv(source)) {
            const value = process.env[source.env];
            if (value) {
                return { succeeded: true, result: value };
            } else {
                return { succeeded: false, error: [`No environment variable ${source.env}`] };
            }
        } else if (isPath(source)) {
            try {
                const fileContent = await fs.readFile(source.path, 'utf8');
                return { succeeded: true, result: fileContent };
            } catch (err) {
                return { succeeded: false, error: [`Error reading file ${source.path}: ${err}`] };
            }
        } else if (isCommand(source)) {
            const sr = await shell.exec(source.command);
            if (sr.succeeded) {
                if (sr.result.code === 0) {
                    return { succeeded: true, result: sr.result.stdout };
                } else {
                    return { succeeded: false, error: [`Shell command '${source.command}' failed: ${sr.result.stderr}`] };
                }
            } else {
                return { succeeded: false, error: [`Failed to run shell command '${source.command}'`] };
            }
        } else {
            const key = source ? Object.keys(source)[0] : undefined;
            return { succeeded: false, error: [`Cannot evaluate credential type '${key || '(unknown)'}'`] };
        }
    }

    private loadSource(file: string) {
        if (this.sourceFilePath !== file) {
            this.sourceFilePath = file;
            this.sourceLines = readFileSync(this.sourceFilePath).toString().split('\n');
        }
    }

    private run(stepEvent?: string) {
        for (let ln = this.currentLine+1; ln < this.sourceLines.length; ln++) {
            if (this.fireEventsForLine(ln, stepEvent)) {
                this.currentLine = ln;
                return true;
            }
        }
        // no more lines: run to end
        this.sendEvent(EVENT_END);
        return undefined;
    }

    private fireEventsForLine(ln: number, stepEvent?: string): boolean {

        if (stepEvent && this.isFirstLineOfInstallStep(ln)) {
            // TODO: this.sendEvent(EVENT_OUTPUT, whatever_porter_output_from_the_previous_step, this.sourceFile, ln, 0);
            this.sendEvent(stepEvent);
            return true;
        }

        // skip uninteresting lines
        return false;
    }

    private sendEvent(event: string, ... args: any[]) {
        setImmediate((_) => {
            this.emit(event, ...args);
        });
    }

    private isFirstLineOfInstallStep(ln: number): boolean {
        // TODO: use a real YAML parser
        const currentLine = this.sourceLines[ln];
        if (!currentLine.trim().startsWith('-')) {
            return false;
        }
        const currentIndent = indentSize(currentLine);
        for (let prevLn = ln - 1; prevLn >= 0; --prevLn) {
            const prevText = this.sourceLines[prevLn];
            if (prevText.trim().startsWith(`#`)) {
                continue;
            }
            const indent = indentSize(prevText);
            if (indent < currentIndent) {
                return prevText.startsWith('install:');
            }
        }
        return false;
    }
}

function indentSize(s: string): number {
    // TODO: I know but just leave it for now okay
    if (s.startsWith(' ')) {
        return 1 + indentSize(s.substring(1));
    }
    return 0;
}

function dequote(s: string): string {
    // TODO: Yes I know about this one too it will go away when I use a proper parser okay
    if (s.startsWith('"') || s.startsWith("'")) {
        return dequote(s.substr(1));
    }
    if (s.endsWith('"') || s.endsWith("'")) {
        return dequote(s.substr(0, s.length - 1));
    }
    return s;
}
