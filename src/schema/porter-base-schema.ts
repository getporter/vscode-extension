export function porterBaseSchema(): JSONRootSchema {
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

const PORTER_ACTION_IDS = ['install', 'uninstall'];

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
        credentials: {
            type: "array",
            items: {
                $ref: "#/definitions/credential"
            }
        },
        parameters: {
            type: "array",
            items: {
                $ref: "#/definitions/parameter"
            }
        },
        dependencies: {
            type: "array",
            items: {
                $ref: "#/definitions/dependency"
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

function porterCredentialSchema(): JSONSchema {
    return {
        type: "object",
        properties: {
            name: {
                type: "string"
            },
            path: {
                type: "string"
            },
            env: {
                type: "string"
            }
        },
        required: ["name"],
        oneOf: [
            { required: ["path"] },
            { required: ["env"] }
        ],
        additionalProperties: false
    };
}

function porterParameterSchema(): JSONSchema {
    return {
        type: "object",
        properties: {
            name: {
                type: "string"
            },
            type: {
                enum: ["int", "string", "boolean"]
            },
            default: {
                type: "string"
            },
        },
        required: ["name", "type"],
        additionalProperties: false
    };
}

function porterDependencySchema(): JSONSchema {
    return {
        type: "object",
        properties: {
            name: {
                type: "string"
            },
            parameters: {
                type: "object",
                additionalProperties: {
                    type: "string"
                }
            },
            connections: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        source: {
                            type: "string"
                        },
                        destination: {
                            type: "string"
                        }
                    },
                    required: ["source", "destination"],
                    additionalProperties: false,
                }
            }
        },
        required: ["name"],
        additionalProperties: false
    };
}

function porterStepOutputSchema(): JSONSchema {
    return {
        type: "object",
        properties: {
            name: {
                type: "string"
            }
        },
        required: ["name"],
        additionalProperties: true
    };
}

function porterSchemaDefinitions(): { [key: string]: JSONSchema } {
    const definitions: { [key: string]: JSONSchema } = {
        mixinId: {
            enum: []
        },
        credential: porterCredentialSchema(),
        parameter: porterParameterSchema(),
        dependency: porterDependencySchema(),
        stepOutput: porterStepOutputSchema()
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
            },
            outputs: {
                type: "array",
                items: {
                    $ref: "#/definitions/stepOutput"
                }
            }
        },
        additionalProperties: false,
        oneOf: []
    };
}
