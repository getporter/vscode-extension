import { readFileSync } from 'fs';
import { EventEmitter } from "events";

import * as porter from '../porter/porter';
import { InstallInputs } from './session-parameters';
import { shell } from '../utils/shell';
import { Errorable } from '../utils/errorable';
import { CredentialSource } from '../porter/porter.objectmodel';

export interface VariableInfo {
    readonly name: string;
    readonly value: string;
}

export interface LazyVariableInfo {
    readonly name: string;
    readonly value: () => Promise<Errorable<string>>;
}

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
            this.step('stopOnEntry');
        } else {
            this.continue();
        }
    }

    public continue() {
        this.run(undefined);
    }

    public step(event = 'stopOnStep') {
        this.run(event);
    }

    public stack(startFrame: number, endFrame: number): any {
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

    private async evaluateCredential(source: CredentialSource): Promise<Errorable<string>> {
        return { succeeded: true, result: 'NOT REALLY DONE SORRY' };
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
        this.sendEvent('end');
        return undefined;
    }

    private fireEventsForLine(ln: number, stepEvent?: string): boolean {

        if (stepEvent && this.isFirstLineOfInstallStep(ln)) {
            // TODO: this.sendEvent('output', whatever_porter_output_from_the_previous_step, this.sourceFile, ln, 0);
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
