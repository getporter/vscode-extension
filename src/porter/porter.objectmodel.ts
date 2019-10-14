export interface CredentialInfo {
    readonly Name: string;
    readonly Modified: string;
}

export interface CredentialSetContent {
    readonly name: string;
    readonly credentials: Credential[];
}

export interface Credential {
    readonly name: string;
    readonly source: CredentialSource;
}

export interface ValueCredentialSource {
    readonly value: string;
}

export interface EnvironmentVariableCredentialSource {
    readonly env: string;
}

export interface PathCredentialSource {
    readonly path: string;
}

export interface ShellCommandCredentialSource {
    readonly command: string;
}

export type CredentialSource = ValueCredentialSource | EnvironmentVariableCredentialSource | PathCredentialSource | ShellCommandCredentialSource;

export function isValue(s: CredentialSource): s is ValueCredentialSource {
    return (s as any).value;
}

export function isEnv(s: CredentialSource): s is EnvironmentVariableCredentialSource {
    return (s as any).env;
}

export function isPath(s: CredentialSource): s is PathCredentialSource {
    return (s as any).path;
}

export function isCommand(s: CredentialSource): s is ShellCommandCredentialSource {
    return (s as any).command;
}
