import { Errorable } from "../utils/errorable";

export interface InstallInputs {
    readonly parameters?: { [key: string]: string };
    readonly credentialSet?: string;
}

export interface VariableInfo {
    readonly name: string;
    readonly value: string;
}

export interface LazyVariableInfo {
    readonly name: string;
    readonly value: () => Promise<Errorable<string>>;
}
