'use strict';

import * as vscode from 'vscode';

import { registerYamlSchema } from './yaml/yaml-schema';

export async function activate(context: vscode.ExtensionContext) {
    await registerYamlSchema();
}

export function deactivate() {
}
