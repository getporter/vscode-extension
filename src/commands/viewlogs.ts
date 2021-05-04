import { CommandResult } from "./result";

export interface ViewLogs {
    viewLogs(): Promise<CommandResult>;
}

function isViewLogs(obj: any): obj is ViewLogs {
    return obj && typeof obj.viewLogs === 'function';
}

export async function viewLogs(target: unknown): Promise<CommandResult> {
    if (isViewLogs(target)) {
        return await target.viewLogs();
    }
    return CommandResult.Failed;
}
