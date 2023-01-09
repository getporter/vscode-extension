export interface CredentialInfo {
    readonly namespace: string;
    readonly name: string;
    readonly modified: string;
}

export interface CredentialSetContent {
    readonly namespace: string;
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

export interface Installation {
    readonly namespace: string;
    readonly name: string;
    readonly status: InstallationStatus;
    readonly _calculated: InstallationDisplayValues;
}

export interface InstallationStatus {
    readonly resultStatus: string;
    readonly created: string;
    readonly modified: string;
    readonly action: string;
}

export interface InstallationDisplayValues {
    readonly displayInstallationState: string;
    readonly displayInstallationStatus: string;
}

export interface InstallationDetail {
    readonly namespace: string;
    readonly name: string;
    readonly created: string;
    readonly modified: string;
    readonly action: string;
    readonly status: string;
    history: Run[];
}

export interface Run {
    readonly id: string;
    readonly action: string;
    readonly started: string;
    readonly stopped: string;
    readonly status: string;
}

export interface InstallationOutput {
    readonly name: string;
    readonly value: string;
    readonly type: string;
}
