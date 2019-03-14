import * as path from 'path';
import * as vscode from 'vscode';

import * as config from '../config/config';
import { Errorable } from '../utils/errorable';
import * as shell from '../utils/shell';

const logChannel = vscode.window.createOutputChannel("Porter");

async function invokeObj<T>(sh: shell.Shell, command: string, args: string, opts: shell.ExecOpts, fn: (stdout: string) => T): Promise<Errorable<T>> {
    const bin = config.porterPath() || 'porter';
    const cmd = `${bin} ${command} ${args}`;
    logChannel.appendLine(`$ ${cmd}`);
    return await sh.execObj<T>(
        cmd,
        `porter ${command}`,
        opts,
        andLog(fn)
    );
}

function andLog<T>(fn: (s: string) => T): (s: string) => T {
    return (s: string) => {
        logChannel.appendLine(s);
        return fn(s);
    };
}

export function home(sh: shell.Shell): string {
    return process.env['PORTER_HOME'] || path.join(sh.home(), '.porter');
}

export async function create(sh: shell.Shell, folder: string): Promise<Errorable<string>> {
    return await invokeObj(sh, 'create', '', { cwd: folder }, (s) => path.join(folder, 'porter.yaml'));
}

export async function build(sh: shell.Shell, folder: string): Promise<Errorable<null>> {
    return await invokeObj(sh, 'build', '', { cwd: folder }, (s) => null);
}

export async function schema(sh: shell.Shell): Promise<Errorable<string>> {
    return await invokeObj(sh, 'schema', '', {}, (s) => s);
}
