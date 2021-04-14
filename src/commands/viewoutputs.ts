import { CommandResult } from "./result";

export interface ViewOutputs {
    viewOutputs(): Promise<CommandResult>;
}

function isViewOutputs(obj: any): obj is ViewOutputs {
    return obj && typeof obj.viewOutputs === 'function';
}

export async function viewOutputs(target: unknown): Promise<CommandResult> {
    if (isViewOutputs(target)) {
        return await target.viewOutputs();
    }
    return CommandResult.Failed;
}
