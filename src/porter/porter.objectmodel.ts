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

export type CredentialSource = ValueCredentialSource | EnvironmentVariableCredentialSource;
