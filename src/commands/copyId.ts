import { CommandResult } from "./result";

export interface CopyId {
    copyId(): Promise<CommandResult>;
}

function isCopyId(obj: any): obj is CopyId {
    return obj && typeof obj.copyId === 'function';
}

export async function copyId(target: unknown): Promise<CommandResult> {
    if (isCopyId(target)) {
        return await target.copyId();
    }
    return CommandResult.Failed;
}
