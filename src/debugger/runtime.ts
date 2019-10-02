import { readFileSync } from 'fs';
import { EventEmitter } from "events";

export class PorterInstallRuntime extends EventEmitter {
    private sourceFilePath = '';

    public get sourceFile() {
        return this.sourceFilePath;
    }

    private sourceLines: string[] = [];
    private currentLine = 0;

    constructor() {
        super();
    }

    public start(porterFilePath: string, stopOnEntry: boolean) {

        this.loadSource(porterFilePath);
        this.currentLine = -1;

        if (stopOnEntry) {
            // we step once
            this.step(false, 'stopOnEntry');
        } else {
            // we just start to run until we hit a breakpoint or an exception
            this.continue();
        }
    }

    /**
     * Continue execution to the end/beginning.
     */
    public continue(reverse = false) {
        this.run(reverse, undefined);
    }

    /**
     * Step to the next/previous non empty line.
     */
    public step(reverse = false, event = 'stopOnStep') {
        this.run(reverse, event);
    }

    /**
     * Returns a fake 'stacktrace'
     */
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

    // /*
    //  * Set breakpoint in file with given line.
    //  */
    // public setBreakPoint(path: string, line: number) : MockBreakpoint {

    //     const bp = <MockBreakpoint> { verified: false, line, id: this._breakpointId++ };
    //     let bps = this._breakPoints.get(path);
    //     if (!bps) {
    //         bps = new Array<MockBreakpoint>();
    //         this._breakPoints.set(path, bps);
    //     }
    //     bps.push(bp);

    //     this.verifyBreakpoints(path);

    //     return bp;
    // }

    // /*
    //  * Clear breakpoint in file with given line.
    //  */
    // public clearBreakPoint(path: string, line: number) : MockBreakpoint | undefined {
    //     let bps = this._breakPoints.get(path);
    //     if (bps) {
    //         const index = bps.findIndex(bp => bp.line === line);
    //         if (index >= 0) {
    //             const bp = bps[index];
    //             bps.splice(index, 1);
    //             return bp;
    //         }
    //     }
    //     return undefined;
    // }

    // /*
    //  * Clear all breakpoints for file.
    //  */
    // public clearBreakpoints(path: string): void {
    //     this._breakPoints.delete(path);
    // }

    // /*
    //  * Set data breakpoint.
    //  */
    // public setDataBreakpoint(address: string): boolean {
    //     if (address) {
    //         this._breakAddresses.add(address);
    //         return true;
    //     }
    //     return false;
    // }

    // /*
    //  * Clear all data breakpoints.
    //  */
    // public clearAllDataBreakpoints(): void {
    //     this._breakAddresses.clear();
    // }

    // private methods

    private loadSource(file: string) {
        if (this.sourceFilePath !== file) {
            this.sourceFilePath = file;
            this.sourceLines = readFileSync(this.sourceFilePath).toString().split('\n');
        }
    }

    /**
     * Run through the file.
     * If stepEvent is specified only run a single step and emit the stepEvent.
     */
    private run(reverse = false, stepEvent?: string) {
        if (reverse) {
            for (let ln = this.currentLine-1; ln >= 0; ln--) {
                if (this.fireEventsForLine(ln, stepEvent)) {
                    this.currentLine = ln;
                    return undefined;  // TODO: what should go here?  In template it was just 'return;'
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
        return undefined;  // TODO: okay?  In template just fell out the bottom
    }

    // private verifyBreakpoints(path: string) : void {
    //     let bps = this._breakPoints.get(path);
    //     if (bps) {
    //         this.loadSource(path);
    //         bps.forEach(bp => {
    //             if (!bp.verified && bp.line < this.sourceLines.length) {
    //                 const srcLine = this.sourceLines[bp.line].trim();

    //                 // if a line is empty or starts with '+' we don't allow to set a breakpoint but move the breakpoint down
    //                 if (srcLine.length === 0 || srcLine.indexOf('+') === 0) {
    //                     bp.line++;
    //                 }
    //                 // if a line starts with '-' we don't allow to set a breakpoint but move the breakpoint up
    //                 if (srcLine.indexOf('-') === 0) {
    //                     bp.line--;
    //                 }
    //                 // don't set 'verified' to true if the line contains the word 'lazy'
    //                 // in this case the breakpoint will be verified 'lazy' after hitting it once.
    //                 if (srcLine.indexOf('lazy') < 0) {
    //                     bp.verified = true;
    //                     this.sendEvent('breakpointValidated', bp);
    //                 }
    //             }
    //         });
    //     }
    // }

    /**
     * Fire events if line has a breakpoint or the word 'exception' is found.
     * Returns true is execution needs to stop.
     */
    private fireEventsForLine(ln: number, stepEvent?: string): boolean {

        const line = this.sourceLines[ln].trim();

        // if 'log(...)' found in source -> send argument to debug console
        // const matches = /log\((.*)\)/.exec(line);
        // if (matches && matches.length === 2) {
        //     this.sendEvent('output', matches[1], this.sourceFilePath, ln, matches.index);
        // }

        // // if a word in a line matches a data breakpoint, fire a 'dataBreakpoint' event
        // const words = line.split(" ");
        // for (let word of words) {
        //     if (this._breakAddresses.has(word)) {
        //         this.sendEvent('stopOnDataBreakpoint');
        //         return true;
        //     }
        // }

        // // if word 'exception' found in source -> throw exception
        // if (line.indexOf('exception') >= 0) {
        //     this.sendEvent('stopOnException');
        //     return true;
        // }

        // // is there a breakpoint?
        // const breakpoints = this._breakPoints.get(this.sourceFilePath);
        // if (breakpoints) {
        //     const bps = breakpoints.filter(bp => bp.line === ln);
        //     if (bps.length > 0) {

        //         // send 'stopped' event
        //         this.sendEvent('stopOnBreakpoint');

        //         // the following shows the use of 'breakpoint' events to update properties of a breakpoint in the UI
        //         // if breakpoint is not yet verified, verify it now and send a 'breakpoint' update event
        //         if (!bps[0].verified) {
        //             bps[0].verified = true;
        //             this.sendEvent('breakpointValidated', bps[0]);
        //         }
        //         return true;
        //     }
        // }

        // non-empty line
        if (stepEvent && line.length > 0) {
            this.sendEvent(stepEvent);
            return true;
        }

        // nothing interesting found -> continue
        return false;
    }

    private sendEvent(event: string, ... args: any[]) {
        setImmediate((_) => {
            this.emit(event, ...args);
        });
    }

}
