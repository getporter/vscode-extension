import * as vscode from 'vscode';
import * as porter from '../porter/porter';
import { activateYamlExtension } from "./yaml-extension";
import { failed } from '../utils/errorable';
import { shell } from '../utils/shell';
import { longRunning } from '../utils/host';

const PORTER_SCHEMA = 'porter';
const LAST_SCHEMA_CACHE_KEY = 'last-porter-yaml-schema';

let schemaJSON: string | undefined = undefined;

export async function registerYamlSchema(extensionContext: vscode.ExtensionContext): Promise<void> {
    // The schema request callback is synchronous, so we need to make sure
    // the schema is pre-loaded ready for it.  We will start with a best-effort
    // but this may get updated later on, once `porter schema` has completed.
    schemaJSON = extensionContext.globalState.get<string>(LAST_SCHEMA_CACHE_KEY);

    const yamlPlugin = await activateYamlExtension();
    if (failed(yamlPlugin)) {
        vscode.window.showWarningMessage(yamlPlugin.error[0]);
        return;
    }

    yamlPlugin.result.registerContributor(PORTER_SCHEMA, onRequestSchemaURI, onRequestSchemaContent);
}

export async function updateYamlSchema(extensionContext: vscode.ExtensionContext): Promise<void> {
    const action = schemaJSON ? 'Updating' : 'Loading';
    const schema = await longRunning(`${action} porter.yaml schema...`, () =>
        porter.schema(shell)
    );
    if (failed(schema)) {
        vscode.window.showWarningMessage(`Error loading Porter schema. Porter intellisense will not be available.\n\nDetails: ${schema.error[0]}`);
        return;
    }

    if (schema.result && (schema.result !== schemaJSON)) {
        schemaJSON = schema.result;
        extensionContext.globalState.update(LAST_SCHEMA_CACHE_KEY, schemaJSON);
    }
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
