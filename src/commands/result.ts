import { Errorable, succeeded } from "../utils/errorable";

export enum CommandResult {
    Unknown = 0,
    Succeeded,
    Failed,
    Cancelled,
}

export function commandResultOf<T>(errorable: Errorable<T>): CommandResult {
    if (succeeded(errorable)) {
        return CommandResult.Succeeded;
    }
    return CommandResult.Failed;
}
