import * as vscode from 'vscode';
import { reporter } from './telemetry';
import { CommandResult } from '../commands/result';

export function telemetriseCommand(command: string, callback: (...args: any[]) => CommandResult | Promise<CommandResult>): (...args: any[]) => CommandResult | Promise<CommandResult> {
    return (args) => {
        if (reporter) {
            reporter.sendTelemetryEvent("command", { command: command });
        }
        const commandResult = callback(args);
        when(commandResult, (r) => reportResult(command, r));
        return commandResult;
    };
}

export function telemetriseTextEditorCommand(command: string, callback: (textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit, ...args: any[]) => CommandResult | Promise<CommandResult>): (textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit, ...args: any[]) => CommandResult | Promise<CommandResult> {
    return (textEditor, edit, args) => {
        if (reporter) {
            reporter.sendTelemetryEvent("command", { command: command });
        }
        const commandResult = callback(textEditor, edit, args);
        when(commandResult, (r) => reportResult(command, r));
        return commandResult;
    };
}

function thenable<T>(t: T | Thenable<T>): t is Thenable<T> {
    return !!((t as any).then);
}

function when<T>(value: T | Thenable<T>, fn: (t: T) => void): void {
    if (thenable(value)) {
        value.then((v) => fn(v));
    } else {
        fn(value);
    }
}

function reportResult(command: string, result: CommandResult) {
    if (reporter) {
        reporter.sendTelemetryEvent("commandResult", { command: command, succeeded: commandResultText(result) });
    }
}

function commandResultText(result: CommandResult): string {
    switch (result) {
        case CommandResult.Unknown: return 'unknown';
        case CommandResult.Succeeded: return 'succeeded';
        case CommandResult.Failed: return 'failed';
        case CommandResult.Cancelled: return 'cancelled';
    }
}
