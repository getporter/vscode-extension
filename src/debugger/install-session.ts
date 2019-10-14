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

const PARAMETERS_HANDLE = 'parameters';
const CREDENTIALS_HANDLE = 'credentials';
const STEP_OUTPUTS_HANDLE = 'step-outputs';

const REF_EXPRESSION_PREFIX = 'bundle.';
const PARAMETER_REF_KEY = 'parameters';
const CREDENTIAL_REF_KEY = 'credentials';
const STEP_OUTPUT_REF_KEY = 'outputs';
const ALL_REF_KEYS = [PARAMETER_REF_KEY, CREDENTIAL_REF_KEY, STEP_OUTPUT_REF_KEY] as const;
const PARAMETER_REF_PREFIX = `${REF_EXPRESSION_PREFIX}${PARAMETER_REF_KEY}.`;
const CREDENTIAL_REF_PREFIX = `${REF_EXPRESSION_PREFIX}${CREDENTIAL_REF_KEY}.`;
const STEP_OUTPUT_REF_PREFIX = `${REF_EXPRESSION_PREFIX}${STEP_OUTPUT_REF_KEY}.`;

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

        response.body.supportsEvaluateForHovers = true;

        response.body.supportsStepBack = false;
        response.body.supportsDataBreakpoints = false;
        response.body.supportsCompletionsRequest = true;
        response.body.completionTriggerCharacters = [ "." ];

        response.body.supportsCancelRequest = false;

        response.body.supportsBreakpointLocationsRequest = false;

        this.sendResponse(response);
    }

    protected configurationDoneRequest(response: DebugProtocol.ConfigurationDoneResponse, args: DebugProtocol.ConfigurationDoneArguments): void {
        super.configurationDoneRequest(response, args);

        // notify the launchRequest that configuration has finished
        this.configurationDone.notify();
    }

    protected async launchRequest(response: DebugProtocol.LaunchResponse, args: LaunchRequestArguments) {
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
            stackFrames: stack.frames.map((f) => new StackFrame(f.index, f.name, this.createSource(f.file), this.convertDebuggerLineToClient(f.line))),
            totalFrames: stack.count
        };
        this.sendResponse(response);
    }

    protected scopesRequest(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments): void {
        response.body = {
            scopes: [
                new Scope("Parameters", this.variableHandles.create(PARAMETERS_HANDLE), false),
                new Scope("Credentials", this.variableHandles.create(CREDENTIALS_HANDLE), false),
                new Scope("Step Outputs", this.variableHandles.create(STEP_OUTPUTS_HANDLE), false),
            ]
        };
        this.sendResponse(response);
    }

    protected async variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments, request?: DebugProtocol.Request): Promise<void> {
        const handle = this.variableHandles.get(args.variablesReference);
        if (handle === PARAMETERS_HANDLE) {
            const variables = this.runtime.getParameters();
            response.body = {
                variables: variables.map((v) => ({ name: v.name, value: v.value, variablesReference: 0}))
            };
        } else if (handle === CREDENTIALS_HANDLE) {
            const variables = await this.runtime.getCredentials();
            const retPromises = variables.map(async (v) => ({ name: v.name, value: await v.value() }));
            const retValues = await Promise.all(retPromises);
            response.body = {
                variables: retValues.map((v) => ({ name: v.name, value: v.value.succeeded ? v.value.result : (`evaluation failed: ${v.value.error[0]}`), variablesReference: 0}))
            };
        } else if (handle === STEP_OUTPUTS_HANDLE) {
            response.body = {
                // TODO: do it
                variables: [{ name: 'NOT DONE YET', value: "I TOLD YOU IT WASN'T DONE YET", variablesReference: 0 }]
            };
        }
        this.sendResponse(response);
    }

    protected async evaluateRequest(response: DebugProtocol.EvaluateResponse, args: DebugProtocol.EvaluateArguments): Promise<void> {
        // TODO: this will need attention
        // NOTE: if we return response.success = false, then no hover tip is shown.  So unfortunately
        // we have to return a body containing an error message.
        if (args.expression && args.expression.startsWith(PARAMETER_REF_PREFIX)) {
            const parameterName = args.expression.substring(PARAMETER_REF_PREFIX.length);
            const variables = this.runtime.getParameters();
            const variable = variables.find((v) => v.name === parameterName);
            if (variable) {
                response.body = { result: variable.value, variablesReference: 0 };
            } else {
                response.body = { result: `${args.expression} not defined`, variablesReference: 0 };
            }
        } else if (args.expression && args.expression.startsWith(CREDENTIAL_REF_PREFIX)) {
            const credentialName = args.expression.substring(CREDENTIAL_REF_PREFIX.length);
            const credentials = await this.runtime.getCredentials();
            const credential = credentials.find((v) => v.name === credentialName);
            if (credential) {
                const credentialValue = await credential.value();
                if (credentialValue.succeeded) {
                    response.body = { result: credentialValue.result, variablesReference: 0 };
                } else {
                    response.body = { result: `evaluation failed: ${credentialValue.error[0]}`, variablesReference: 0 };
                }
            } else {
                response.body = { result: `${args.expression} not defined`, variablesReference: 0 };
            }
        } else if (args.expression && args.expression.startsWith(STEP_OUTPUT_REF_PREFIX)) {
            // TODO: do it
            response.body = { result: `NOT DONE YET`, variablesReference: 0 };
        } else {
            response.success = false;
            response.body = { result: `${args.expression} not defined`, variablesReference: 0 };
        }
        this.sendResponse(response);
    }

	protected async completionsRequest(response: DebugProtocol.CompletionsResponse, args: DebugProtocol.CompletionsArguments): Promise<void> {
        const completions = await this.getCompletions(args.text);
        if (completions) {
            response.body = {
                targets: completions.map((k) => ({ label: k }))
            };
        }
        this.sendResponse(response);
    }

    private async getCompletions(prefixText: string): Promise<ReadonlyArray<string> | undefined> {
        switch (prefixText) {
            case REF_EXPRESSION_PREFIX: return ALL_REF_KEYS;
            case PARAMETER_REF_PREFIX: return this.runtime.getParameters().map((v) => v.name);
            case CREDENTIAL_REF_PREFIX: return (await this.runtime.getCredentials()).map((c) => c.name);
            case STEP_OUTPUT_REF_PREFIX: return ['NOT_DONE_YET'];
            default: return undefined;
        }
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
