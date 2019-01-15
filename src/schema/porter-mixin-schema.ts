export function mixins(): string[] {
    return ['helm', 'exec'];
}

function helmMixinSchema(): { [key: string]: JSONSchema } {
    // TODO: this is for testing - should be replaced by dynamic loading - and be more complete!
    return {
        install: {
            type: "object",
            properties: {
                name: {
                    type: "string"
                },
                chart: {
                    type: "string"
                }
            },
            additionalProperties: false
        }
    };
}

function execMixinSchema(): { [key: string]: JSONSchema } {
    function execStepMixinSchema(): JSONSchema {
        return {
            type: "object",
            properties: {
                name: {
                    type: "string"
                },
                command: {
                    type: "string"
                },
                arguments: {
                    type: "array",
                    items: {
                        type: "string"
                    }
                },
                parameters: {
                    type: "object",
                    additionalProperties: {
                        type: "string"
                    }
                }
            },
            required: [
                "command"
            ],
            additionalProperties: false
        };
    }

    return {
        install: execStepMixinSchema(),
        uninstall: execStepMixinSchema()
    };
}

function porterMixinSchema(mixin: string): { [key: string]: JSONSchema } | undefined {
    // TODO: replace with dynamic loading
    if (mixin === 'helm') {
        return helmMixinSchema();
    } else if (mixin === 'exec') {
        return execMixinSchema();
    }

    return undefined;
}

export function rollInMixinSchema(schema: JSONRootSchema, mixin: string): void {
    (schema.definitions.mixinId as JSONEnumSchema).enum.push(mixin);

    const mixinSchema = porterMixinSchema(mixin);
    if (mixinSchema) {
        for (const verb in mixinSchema) {
            const verbSchema = schema.definitions[verb] as JSONObjectSchema;
            verbSchema.properties![mixin] = { type: "object", $ref: `#/definitions/${mixin}-${verb}` };
            verbSchema.oneOf!.push({ required: [mixin] });
            schema.definitions[`${mixin}-${verb}`] = mixinSchema[verb];
        }
    }
}
