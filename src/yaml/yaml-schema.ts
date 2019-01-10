import * as vscode from 'vscode';
import { activateYamlExtension } from "./yaml-extension";
import { failed } from '../utils/errorable';
import { porterBaseSchema } from '../schema/porter-base-schema';
import { mixins, rollInMixinSchema } from '../schema/porter-mixin-schema';

const PORTER_SCHEMA = 'porter';

export async function registerYamlSchema(): Promise<void> {
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

    const schema = porterBaseSchema();

    for (const mixin of mixins()) {
        rollInMixinSchema(schema, mixin);
    }

    const schemaJSON = JSON.stringify(schema, undefined, 2);
    console.log(schemaJSON);
    return schemaJSON;
}
