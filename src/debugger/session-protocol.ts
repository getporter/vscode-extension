import { Errorable } from "../utils/errorable";

export const EVENT_STOP_ON_ENTRY = 'stopOnEntry';
export const EVENT_STOP_ON_STEP = 'stopOnStep';
export const EVENT_STOP_ON_BREAKPOINT = 'stopOnBreakpoint';
export const EVENT_BREAKPOINT_VALIDATED = 'breakpointValidated';
export const EVENT_OUTPUT = 'output';
export const EVENT_END = 'end';

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

export interface PorterBreakpoint {
    readonly id: number;
    line: number;
    verified: boolean;
}
