import { readFileSync } from 'fs';
import { EventEmitter } from "events";

import * as porter from '../porter/porter';
import { InstallInputs, VariableInfo, LazyVariableInfo, EVENT_STOP_ON_ENTRY, EVENT_STOP_ON_STEP, EVENT_END, PorterBreakpoint, EVENT_BREAKPOINT_VALIDATED, EVENT_STOP_ON_BREAKPOINT } from './session-protocol';
import { shell } from '../utils/shell';
import { Errorable } from '../utils/errorable';
import { CredentialSource, isValue, isEnv, isCommand, isPath } from '../porter/porter.objectmodel';
import { fs } from '../utils/fs';
import * as ast from './ast';
import { flatten } from '../utils/array';
import { PathMapList } from '../utils/pathmap';

export class PorterInstallRuntime extends EventEmitter {
    private sourceFilePath = '';
    private sourceYAML: ast.PorterManifestYAML | undefined = undefined;
    private actionInputs: InstallInputs | undefined = undefined;
    private readonly actionName = 'install';

    private readonly breakpoints = new PathMapList<PorterBreakpoint>();
    private breakpointId = 1;

    private action: ast.PorterActionYAML | undefined = undefined;

    public get sourceFile() {
        return this.sourceFilePath;
    }

    private sourceLines: string[] = [];
    private currentLine = 0;

    constructor() {
        super();
    }

    public start(porterFilePath: string, stopOnEntry: boolean, actionInputs: InstallInputs) {

        this.loadSource(porterFilePath);
        this.currentLine = -1;

        this.verifyBreakpoints(this.sourceFilePath);

        this.actionInputs = actionInputs;

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

    public setBreakpoint(path: string, line: number): PorterBreakpoint {
        const bp = { verified: false, line, id: this.breakpointId++ };
        this.breakpoints.append(path, bp);
        this.verifyBreakpoints(path);
        return bp;
    }

    public clearBreakpoint(path: string, line: number): void {
        const fileBreakpoints = this.breakpoints.get(path);
        if (fileBreakpoints) {
            const index = fileBreakpoints.findIndex((bp) => bp.line === line);
            if (index >= 0) {
                fileBreakpoints.splice(index, 1);
            }
        }
    }

    public clearBreakpoints(path: string): void {
        this.breakpoints.delete(path);
    }

    private verifyBreakpoints(path: string): void {
        this.loadSource(path);  // we have to do this because it may not have been done yet (it is efficient because cached)
        if (!this.action) {
            return;
        }

        const bps = this.breakpoints.get(path);
        if (bps) {
            bps.forEach((bp) => this.verifyBreakpoint(bp));
        }
    }

    private verifyBreakpoint(bp: PorterBreakpoint): void {
        if (!bp.verified && bp.line < this.sourceLines.length) {
            const stepsBeforeBP = this.action!.steps.filter((s) => s.startLine <= bp.line);
            if (stepsBeforeBP.length === 0) {
                return;
            }
            const step = stepsBeforeBP[stepsBeforeBP.length - 1];
            if (step) {
                bp.line = step.startLine;
                bp.verified = true;
                this.sendEvent(EVENT_BREAKPOINT_VALIDATED, bp);
            }
        }
    }

    public getParameters(): VariableInfo[] {
        const inputs = this.actionInputs || { parameters: {} };
        const parameters = inputs.parameters || {};
        const parameterVariables = Object.entries(parameters).map(([k, v]) => ({ name: k, value: `${v}` }));
        return parameterVariables;
    }

    private credentials: LazyVariableInfo[] | undefined = undefined;

    public async getCredentials(): Promise<LazyVariableInfo[]> {
        if (this.credentials !== undefined)  {
            return this.credentials;
        }
        if (this.actionInputs && this.actionInputs.credentialSet) {
            const credentials = await porter.getCredentials(shell, this.actionInputs.credentialSet);
            if (credentials.succeeded) {
                this.credentials = credentials.result.credentials.map((c) => ({ name: c.name, value: () => this.evaluateCredential(c.source) }));
                return this.credentials;
            }
        }
        return [];
    }

    public async getOutputs(): Promise<LazyVariableInfo[]> {
        if (!this.action) {
            return [];
        }

        const stepsBeforeNow = this.action.steps.filter((s) => s.startLine < this.currentLine);
        const outputsBeforeNow = flatten(...stepsBeforeNow.map((s) => s.outputs));

        return outputsBeforeNow.map((o) => ({
            name: o.name,
            value: async () => ({ succeeded: true, result: `(value of output ${o.name} TBD)` })
        }));
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
            const sourceText = readFileSync(this.sourceFilePath).toString();
            this.sourceLines = sourceText.split('\n');
            this.sourceYAML = ast.parse(sourceText);
            this.action = this.sourceYAML ? this.sourceYAML.actions.find((a) => a.name === this.actionName) : undefined;
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

        const fileBreakpoints = this.breakpoints.get(this.sourceFilePath);
        if (fileBreakpoints) {
            const lineBreakpoints = fileBreakpoints.filter((bp) => bp.line === ln);
            if (lineBreakpoints.length > 0) {
                this.sendEvent(EVENT_STOP_ON_BREAKPOINT);

                if (!lineBreakpoints[0].verified) {
                    lineBreakpoints[0].verified = true;
                    this.sendEvent(EVENT_BREAKPOINT_VALIDATED, lineBreakpoints[0]);
                }

                return true;
            }
        }

        if (stepEvent && this.isFirstLineOfActionStep(ln)) {
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

    private isFirstLineOfActionStep(ln: number): boolean {
        if (!this.action) {
            return false;
        }

        return this.action.steps.some((s) => s.startLine === ln);
    }
}
