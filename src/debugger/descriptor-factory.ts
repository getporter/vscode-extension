import * as net from 'net';
import * as vscode from 'vscode';
import { PorterInstallDebugSession } from './install-session';

export class PorterInstallDebugAdapterDescriptorFactory implements vscode.DebugAdapterDescriptorFactory {

    private server?: net.Server;

    createDebugAdapterDescriptor(session: vscode.DebugSession, executable: vscode.DebugAdapterExecutable | undefined): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {

        if (!this.server) {
            // start listening on a random port
            this.server = net.createServer((socket) => {
                const session = new PorterInstallDebugSession();
                session.setRunAsServer(true);
                session.start(<NodeJS.ReadableStream>socket, socket);
            }).listen(0);
        }

        return new vscode.DebugAdapterServer((<net.AddressInfo>this.server.address()).port);
    }

    dispose() {
        if (this.server) {
            this.server.close();
            this.server = undefined;
        }
    }
}
