import { reporter } from './telemetry';

export function telemetrise(command: string, callback: (...args: any[]) => any): (...args: any[]) => any {
    return (a) => {
        if (reporter) {
            reporter.sendTelemetryEvent("command", { command: command });
        }
        return callback(a);
    };
}
