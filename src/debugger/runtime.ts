import { readFileSync } from 'fs';
import { EventEmitter } from "events";

export class PorterInstallRuntime extends EventEmitter {
    private sourceFilePath = '';
    private porterInputs = '';

    public get sourceFile() {
        return this.sourceFilePath;
    }

    private sourceLines: string[] = [];
    private currentLine = 0;

    constructor() {
        super();
    }

    public start(porterFilePath: string, stopOnEntry: boolean, porterInputs: string) {

        this.loadSource(porterFilePath);
        this.currentLine = -1;

        this.porterInputs = porterInputs;

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

        // for exploration purposes, stop on each line that contains the 'porterInputs' value
        // THIS IS NOT REAL
        if (stepEvent && line.length > 0 && line.indexOf(this.porterInputs) > 0) {
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

}
