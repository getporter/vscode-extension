import * as vscode from 'vscode';
import { reporter } from './telemetry';

export function telemetriseCommand(command: string, callback: (...args: any[]) => any): (...args: any[]) => any {
    return (args) => {
        if (reporter) {
            reporter.sendTelemetryEvent("command", { command: command });
        }
        return callback(args);
    };
}

export function telemetriseTextEditorCommand(command: string, callback: (textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit, ...args: any[]) => any): (textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit, ...args: any[]) => any {
    return (textEditor, edit, args) => {
        if (reporter) {
            reporter.sendTelemetryEvent("command", { command: command });
        }
        return callback(textEditor, edit, args);
    };
}
