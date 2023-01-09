import * as path from 'path';
import * as tmp from 'tmp';

import * as config from '../config/config';
import { Errorable } from '../utils/errorable';
import * as shell from '../utils/shell';
import { fs } from '../utils/fs';
import * as pairs from '../utils/pairs';
import { CredentialInfo, CredentialSetContent, Installation, InstallationDetail, InstallationOutput, Run } from './porter.objectmodel';

import { PORTER_OUTPUT_CHANNEL as logChannel } from '../utils/logging';

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

export async function listCredentialSets(sh: shell.Shell): Promise<Errorable<string[]>> {
    function parse(stdout: string): string[] {
        return (JSON.parse(stdout) as CredentialInfo[])
            .map((c) => c.name);
    }
    return await invokeObj(sh, 'credentials list', '--all-namespaces -o json', {}, parse);
}

export async function listInstallations(sh: shell.Shell): Promise<Errorable<Installation[]>> {
    function parse(stdout: string): Installation[] {
        return (JSON.parse(stdout) as Installation[]);
    }
    return await invokeObj(sh, 'list', '--all-namespaces -o json', {}, parse);
}

export async function listInstallationOutputs(sh: shell.Shell, namespace: string, name: string): Promise<Errorable<InstallationOutput[]>> {
    function parse(stdout: string): InstallationOutput[] {
        return (JSON.parse(stdout) as InstallationOutput[]);
    }
    return await invokeObj(sh, 'installation outputs list', `--installation ${name} --namespace=${namespace} -o json`, {}, parse);
}

export async function getInstallationDetail(sh: shell.Shell, namespace: string, name: string): Promise<Errorable<InstallationDetail>> {
    function parseInstallation(stdout: string): InstallationDetail {
        return (JSON.parse(stdout) as InstallationDetail);
    }
    const installation = await invokeObj(sh, 'show', `${name} --namespace=${namespace} -o json`, {}, parseInstallation);
    if (!installation.succeeded) {
        return { succeeded: false, error: installation.error };
    }

    function parseRuns(stdout: string): Run[] {
        return (JSON.parse(stdout) as Run[]);
    }
    const runs = await invokeObj(sh, 'installation runs list', `${name} --namespace=${namespace} -o json`, {}, parseRuns);
    if (!runs.succeeded) {
        return { succeeded: false, error: runs.error };
    }

    installation.result.history = runs.result;
    return installation;
}

export async function getRunLogs(sh: shell.Shell, runId: string): Promise<Errorable<string[]>> {
    function parse(stdout: string): string[] {
        return stdout.split('\n');
    }
    return await invokeObj(sh, 'logs', `--run ${runId}`, {}, parse);
}

export async function getCredentials(sh: shell.Shell, namespace: string, name: string): Promise<Errorable<CredentialSetContent>> {
    function parse(stdout: string): CredentialSetContent {
        return JSON.parse(stdout);
    }
    return await invokeObj(sh, 'credentials show', `${name} --namespace=${namespace} -o json`, {}, parse);
}

export async function create(sh: shell.Shell, folder: string): Promise<Errorable<string>> {
    return await invokeObj(sh, 'create', '', { cwd: folder }, (s) => path.join(folder, 'porter.yaml'));
}

export async function build(sh: shell.Shell, folder: string): Promise<Errorable<null>> {
    return await invokeObj(sh, 'build', '', { cwd: folder }, (s) => null);
}

export async function install(sh: shell.Shell, folder: string, name: string, params: { [key: string]: string }, credentialSet: string | undefined): Promise<Errorable<string>> {
    return await invokeObj(sh, 'install', `${name} ${paramsArgs(params)} ${credentialArg(credentialSet)}`, { cwd: folder }, (s) => s);
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

function paramsArgs(parameters: { [key: string]: string }): string {
    return pairs.fromStringMap(parameters)
        .filter((p) => !!p.value)
        .map((p) => `--param ${p.key}=${shell.safeValue(p.value)}`)
        .join(' ');
}

function credentialArg(credentialSet: string | undefined): string {
    if (credentialSet) {
        return `-c ${credentialSet}`;
    }
    return '';
}
