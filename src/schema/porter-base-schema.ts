export function porterBaseSchema(): JSONSchema {
    const schema: JSONRootSchema = {
        description: "Porter bundle specification",
        type: "object",
        properties: porterRootProperties(),
        required: [
            "name",
            "version",
            "invocationImage"
        ],
        additionalProperties: false,
        definitions: porterSchemaDefinitions()
    };

    return schema;
}

const PORTER_ACTION_IDS = ['install'];

function porterRootProperties(): { [key: string]: JSONSchema } {
    const properties: { [key: string]: JSONSchema } = {
        name: {
            type: "string"
        },
        version: {
            type: "string"
        },
        invocationImage: {
            type: "string"
        },
        mixins: {
            type: "array",
            items: {
                $ref: "#/definitions/mixinId"
            }
        },
        parameters: {
            type: "array",
            items: {
                $ref: "#/definitions/parameter"
            }
        }
    };

    for (const action of PORTER_ACTION_IDS) {
        properties[action] = {
            type: "array",
            items: {
                $ref: `#/definitions/${action}`
            }
        };
    }

    return properties;
}

function porterParameterSchema(): JSONSchema {
    return {
        type: "object",
        properties: {
            name: {
                type: "string"
            },
            type: {
                type: "string"
            },
            default: {
                type: "string"
            },
        },
        additionalProperties: false
    };
}

function porterSchemaDefinitions(): { [key: string]: JSONSchema } {
    const definitions: { [key: string]: JSONSchema } = {
        mixinId: {
            enum: []
        },
        parameter: porterParameterSchema()
    };

    for (const action of PORTER_ACTION_IDS) {
        definitions[action] = stepBaseSchema();
    }

    return definitions;
}

function stepBaseSchema(): JSONSchema {
    return {
        type: "object",
        properties: {
            description: {
                type: "string"
            }
        },
        additionalProperties: false,
        oneOf: []
    };
}
