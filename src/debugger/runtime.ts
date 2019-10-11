import { readFileSync } from 'fs';
import { EventEmitter } from "events";
import { InstallInputs } from './session-parameters';

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
            this.step(false, 'stopOnEntry');
        } else {
            this.continue();
        }
    }

    public continue(reverse = false) {
        this.run(reverse, undefined);
    }

    public step(reverse = false, event = 'stopOnStep') {
        this.run(reverse, event);
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

    private loadSource(file: string) {
        if (this.sourceFilePath !== file) {
            this.sourceFilePath = file;
            this.sourceLines = readFileSync(this.sourceFilePath).toString().split('\n');
        }
    }

    private run(reverse = false, stepEvent?: string) {
        if (reverse) {
            for (let ln = this.currentLine-1; ln >= 0; ln--) {
                if (this.fireEventsForLine(ln, stepEvent)) {
                    this.currentLine = ln;
                    return undefined;
                }
            }
            // no more lines: stop at first line
            this.currentLine = 0;
            this.sendEvent('stopOnEntry');
        } else {
            for (let ln = this.currentLine+1; ln < this.sourceLines.length; ln++) {
                if (this.fireEventsForLine(ln, stepEvent)) {
                    this.currentLine = ln;
                    return true;
                }
            }
            // no more lines: run to end
            this.sendEvent('end');
        }
        return undefined;
    }

    private fireEventsForLine(ln: number, stepEvent?: string): boolean {

        const line = this.sourceLines[ln].trim();

        if (stepEvent && line.length > 0 && /* TODO: NOT REALLY NOT REALLY AT ALL */ this.testytestytesttest(line)) {
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

    // TODO: this is for proof of concept and not a real thing
    testytestytesttest(line: string) {
        const parameters = this.installInputs!.parameters || {};
        for (const pval of Object.values(parameters)) {
            if (line.indexOf(pval) >= 0) {
                return true;
            }
        }
        return false;
    }
}
