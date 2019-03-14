import * as vscode from 'vscode';
import * as porter from '../porter/porter';
import { activateYamlExtension } from "./yaml-extension";
import { failed } from '../utils/errorable';
import { shell } from '../utils/shell';

const PORTER_SCHEMA = 'porter';

let schemaJSON: string | undefined = undefined;

export async function registerYamlSchema(): Promise<void> {
    // The schema request callback is synchronous, so we need to make sure
    // the schema is pre-loaded ready for it.
    const schema = await porter.schema(shell);
    if (failed(schema)) {
        vscode.window.showWarningMessage(`Error loading Porter schema. Porter intellisense will not be available.\n\nDetails: ${schema.error[0]}`);
        return;
    }

    schemaJSON = schema.result;

    const yamlPlugin = await activateYamlExtension();
    if (failed(yamlPlugin)) {
        vscode.window.showWarningMessage(yamlPlugin.error[0]);
        return;
    }

    yamlPlugin.result.registerContributor(PORTER_SCHEMA, onRequestSchemaURI, onRequestSchemaContent);
}

function onRequestSchemaURI(resource: string): string | undefined {
    if (resource.endsWith('porter.yaml')) {
        return `${PORTER_SCHEMA}://schema/porter`;
    }
    return undefined;
}

function onRequestSchemaContent(schemaUri: string): string | undefined {
    const parsedUri = vscode.Uri.parse(schemaUri);
    if (parsedUri.scheme !== PORTER_SCHEMA) {
        return undefined;
    }
    if (!parsedUri.path || !parsedUri.path.startsWith('/')) {
        return undefined;
    }

    return schemaJSON;
}
