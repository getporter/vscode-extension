interface JSONRootSchema extends JSONObjectSchema {
    readonly definitions: { [key: string]: JSONSchema };
}

interface JSONSchemaCommon {
    readonly description?: string;
}

interface JSONStringSchema extends JSONSchemaCommon {
    readonly type: "string";
}

interface JSONArraySchema extends JSONSchemaCommon {
    readonly type: "array";
    readonly items: {
        readonly $ref: string;
    };
}

interface JSONObjectSchema extends JSONSchemaCommon {
    readonly type: "object";
    readonly properties: { [key: string]: JSONSchema };
    readonly additionalProperties?: boolean;  // technically incorrect but good enough for our use case
    readonly required?: string[];
    readonly oneOf?: any[];  // TODO: un-any-fy
}

interface JSONEnumSchema {
    readonly enum: string[];
}

type JSONSchema = JSONStringSchema | JSONArraySchema | JSONObjectSchema | JSONEnumSchema;
