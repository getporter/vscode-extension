import * as path from 'path';
import * as tmp from 'tmp';
import * as vscode from 'vscode';

import * as config from '../config/config';
import { Errorable } from '../utils/errorable';
import * as shell from '../utils/shell';
import { fs } from '../utils/fs';

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
    // We seem to run into buffering issues on Mac and Linux. There may be a better solution,
    // and we need to check if this is an issue for other commands; but for now, pipe to file
    // and load from there.
    const tempFile = tmp.tmpNameSync({ prefix: "vsporter-", postfix: `.schema.json` });
    try {
        const bin = config.porterPath() || 'porter';
        const cmd = `${bin} schema`;
        const sr = await sh.execToFile(cmd, tempFile, sh.execOpts());
        if (sr.code === 0) {
            return { succeeded: true, result: await fs.readFile(tempFile, { encoding: 'utf8' }) };
        }
        return { succeeded: false, error: [sr.stderr] };
    } finally {
        await fs.unlink(tempFile);
    }
}
