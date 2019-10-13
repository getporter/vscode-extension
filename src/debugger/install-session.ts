import {
    Logger, logger,
    LoggingDebugSession,
    TerminatedEvent, StoppedEvent, OutputEvent,
    Scope, Source, StackFrame, Thread, Handles
} from 'vscode-debugadapter';
import { DebugProtocol } from 'vscode-debugprotocol';
import { basename } from 'path';
import { PorterInstallRuntime } from './runtime';
import { InstallInputs } from './session-parameters';

const { Subject } = require('await-notify');

interface LaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
    'porter-file': string;
    stopOnEntry?: boolean;
    installInputs: InstallInputs;
}

const FAKE_THREAD_ID = 1;

export class PorterInstallDebugSession extends LoggingDebugSession {
    private readonly runtime: PorterInstallRuntime;
    private readonly configurationDone = new Subject();
    private readonly variableHandles = new Handles<string>();

    constructor() {
        super();

        this.setDebuggerLinesStartAt1(false);
        this.setDebuggerColumnsStartAt1(false);

        this.runtime = new PorterInstallRuntime();

        this.runtime.on('stopOnEntry', () => {
            this.sendEvent(new StoppedEvent('entry', FAKE_THREAD_ID));
        });
        this.runtime.on('stopOnStep', () => {
            this.sendEvent(new StoppedEvent('step', FAKE_THREAD_ID));
        });
        this.runtime.on('output', (text: string, filePath: string, line: number, column: number) => {
            const e: DebugProtocol.OutputEvent = new OutputEvent(`${text}\n`);
            e.body.source = this.createSource(filePath);
            e.body.line = this.convertDebuggerLineToClient(line);
            e.body.column = this.convertDebuggerColumnToClient(column);
            this.sendEvent(e);
        });
        this.runtime.on('end', () => {
            this.sendEvent(new TerminatedEvent());
        });
    }

    protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {
        response.body = response.body || {};
        response.body.supportsConfigurationDoneRequest = true;

        // make VS Code to use 'evaluate' when hovering over source
        // TODO: what does this mean?
        response.body.supportsEvaluateForHovers = true;

        response.body.supportsStepBack = false;
        response.body.supportsDataBreakpoints = false;
        response.body.supportsCompletionsRequest = false;
        // response.body.completionTriggerCharacters = [ ".", "[" ];

        // TODO: should this be a thing?
        response.body.supportsCancelRequest = true;

        response.body.supportsBreakpointLocationsRequest = false;

        this.sendResponse(response);
    }

    protected configurationDoneRequest(response: DebugProtocol.ConfigurationDoneResponse, args: DebugProtocol.ConfigurationDoneArguments): void {
        super.configurationDoneRequest(response, args);

        // notify the launchRequest that configuration has finished
        this.configurationDone.notify();
    }

    protected async launchRequest(response: DebugProtocol.LaunchResponse, args: LaunchRequestArguments) {

        // logger.setup(args.trace ? Logger.LogLevel.Verbose : Logger.LogLevel.Stop, false);
        logger.setup(Logger.LogLevel.Stop, false);

        await this.configurationDone.wait(1000);
        this.runtime.start(args['porter-file'], !!args.stopOnEntry, args.installInputs);

        this.sendResponse(response);
    }

    protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {
        response.body = {
            threads: [
                new Thread(FAKE_THREAD_ID, `Thread ${FAKE_THREAD_ID}`)
            ]
        };
        this.sendResponse(response);
    }

    protected stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments): void {
        const startFrame = typeof args.startFrame === 'number' ? args.startFrame : 0;
        const maxLevels = typeof args.levels === 'number' ? args.levels : 1000;
        const endFrame = startFrame + maxLevels;

        const stack = this.runtime.stack(startFrame, endFrame);

        response.body = {
            stackFrames: stack.frames.map((f: any) => new StackFrame(f.index, f.name, this.createSource(f.file), this.convertDebuggerLineToClient(f.line))),
            totalFrames: stack.count
        };
        this.sendResponse(response);
    }

    protected scopesRequest(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments): void {
        response.body = {
            scopes: [
                new Scope("Parameters", this.variableHandles.create("parameters"), false),
                new Scope("Step Outputs", this.variableHandles.create("step-outputs"), false),
            ]
        };
        this.sendResponse(response);
    }

    protected variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments, request?: DebugProtocol.Request): void {
        const handle = this.variableHandles.get(args.variablesReference);
        if (handle === 'parameters') {
            const variables = this.runtime.getParameters();
            response.body = {
                variables: variables.map((v) => ({ name: v.name, value: v.value, variablesReference: 0}))
            };
        } else if (handle === 'step-outputs') {
            response.body = {
                // TODO: do it
                variables: [{ name: 'NOT DONE YET', value: "I TOLD YOU IT WASN'T DONE YET", variablesReference: 0 }]
            };
        }
        this.sendResponse(response);
    }

    protected evaluateRequest(response: DebugProtocol.EvaluateResponse, args: DebugProtocol.EvaluateArguments): void {
        // TODO: this will need attention
        if (args.expression && args.expression.startsWith('bundle.parameters.')) {
            const parameterName = args.expression.substring('bundle.parameters.'.length);
            const variables = this.runtime.getParameters();
            const variable = variables.find((v) => v.name === parameterName);
            if (variable) {
                response.body = { result: variable.value, variablesReference: 0 };
            } else {
                response.success = false;
                response.message = `${args.expression} not defined`;
            }
        } else {
            response.success = false;
            response.message = `${args.expression} not defined`;
        }
        this.sendResponse(response);
    }

    protected continueRequest(response: DebugProtocol.ContinueResponse, args: DebugProtocol.ContinueArguments): void {
        this.runtime.continue();
        this.sendResponse(response);
    }

    protected nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments): void {
        this.runtime.step();
        this.sendResponse(response);
    }

    private createSource(filePath: string): Source {
        return new Source(basename(filePath), this.convertDebuggerPathToClient(filePath), undefined, undefined, 'porter-adapter-data');
    }
}
