import {
    Logger, logger,
    LoggingDebugSession,
    TerminatedEvent, StoppedEvent, OutputEvent,
    Scope, Source, StackFrame, Thread, Handles
} from 'vscode-debugadapter';
import { DebugProtocol } from 'vscode-debugprotocol';
import { basename } from 'path';
import { PorterInstallRuntime } from './runtime';
import { InstallInputs, VariableInfo } from './session-parameters';
import { Errorable } from '../utils/errorable';

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
        const variables = await this.evaluateVariables(handle);
        if (variables) {
            response.body = {
                variables: variables.map((v) => ({ name: v.name, value: v.value, variablesReference: 0}))
            };
        }
        this.sendResponse(response);
    }

    private async evaluateVariables(handle: string): Promise<VariableInfo[] | undefined> {
        if (handle === PARAMETERS_HANDLE) {
            const variables = this.runtime.getParameters();
            return variables.map((v) => ({ name: v.name, value: v.value }));
        } else if (handle === CREDENTIALS_HANDLE) {
            const variables = await this.runtime.getCredentials();
            const promisedValues = variables.map(async (v) => ({ name: v.name, value: await v.value() }));
            const values = await Promise.all(promisedValues);
            return values.map((v) => ({ name: v.name, value: this.displayEvalResult(v.value) }));
        } else if (handle === STEP_OUTPUTS_HANDLE) {
            return [{ name: 'NOT DONE YET', value: "I TOLD YOU IT WASN'T DONE YET" }];
        } else {
            return undefined;
        }
    }

    private displayEvalResult(value: Errorable<string>): string {
        return value.succeeded ? value.result : (`evaluation failed: ${value.error[0]}`);
    }

    protected async evaluateRequest(response: DebugProtocol.EvaluateResponse, args: DebugProtocol.EvaluateArguments): Promise<void> {
        // NOTE: if we return response.success = false, then no hover tip is shown.  So unfortunately
        // even if evaluation fails we have to return the error message through a 'success' body.
        const evaluated = await this.evaluateExpression(args.expression);
        if (evaluated) {
            response.body = { result: evaluated, variablesReference: 0 };
        }
        this.sendResponse(response);
    }

    private async evaluateExpression(expressionText: string): Promise<string | undefined> {
        if (!expressionText) {
            return undefined;
        }
        if (expressionText.startsWith(PARAMETER_REF_PREFIX)) {
            const parameterName = expressionText.substring(PARAMETER_REF_PREFIX.length);
            const variables = this.runtime.getParameters();
            const variable = variables.find((v) => v.name === parameterName);
            if (variable) {
                return variable.value;
            } else {
                return `${expressionText} not defined`;
            }
        } else if (expressionText.startsWith(CREDENTIAL_REF_PREFIX)) {
            const credentialName = expressionText.substring(CREDENTIAL_REF_PREFIX.length);
            const credentials = await this.runtime.getCredentials();
            const credential = credentials.find((v) => v.name === credentialName);
            if (credential) {
                const credentialValue = await credential.value();
                if (credentialValue.succeeded) {
                    return credentialValue.result;
                } else {
                    return `evaluation failed: ${credentialValue.error[0]}`;
                }
            } else {
                return `${expressionText} not defined`;
            }
        } else if (expressionText.startsWith(STEP_OUTPUT_REF_PREFIX)) {
            // TODO: do it
            return `NOT DONE YET`;
        } else {
            return undefined;
        }
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
