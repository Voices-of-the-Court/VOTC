/**
 * JSON Schema builder for structured action responses (OpenAI-compatible).
 * We avoid zod-to-json-schema and generate JSON Schema directly from our metadata.
 */
import { ActionArgumentDefinition } from "./types";

export interface SchemaBuildInput {
  availableActions: {
    signature: string;
    args: ActionArgumentDefinition[];
    // If requiresTarget is true, targetCharacterId must be present
    requiresTarget: boolean;
    // When provided, targetCharacterId must be one of these values
    validTargetCharacterIds?: number[];
    // Human-readable description to present in prompts (computed per sourceCharacter)
    description?: string;
  }[];
}

/**
 * Build a JSON Schema (Draft-07 style) describing:
 * {
 *   actions: Array<{ actionId, targetCharacterId?, args: {...} }>
 * }
 */
export function buildStructuredResponseJsonSchema(input: SchemaBuildInput) {
  const actionVariants = input.availableActions.map((action) => {
    const properties: any = {
      actionId: { const: action.signature },
      args: buildArgsObjectSchema(action.args),
    };

    const required: string[] = ["actionId", "args"];

    // targetCharacterId rules
    if (action.requiresTarget) {
      if (action.validTargetCharacterIds && action.validTargetCharacterIds.length > 0) {
        properties.targetCharacterId = {
          type: "integer",
          enum: action.validTargetCharacterIds,
        };
      } else {
        properties.targetCharacterId = {
          type: "integer",
        };
      }
      required.push("targetCharacterId");
    } else {
      if (action.validTargetCharacterIds && action.validTargetCharacterIds.length > 0) {
        // Optional but constrained if present
        properties.targetCharacterId = {
          anyOf: [
            { type: "integer", enum: action.validTargetCharacterIds },
            { type: "null" },
          ],
        };
      } else {
        properties.targetCharacterId = {
          anyOf: [{ type: "integer" }, { type: "null" }],
        };
      }
    }

    return {
      type: "object",
      additionalProperties: false,
      properties,
      required,
    };
  });

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      actions: {
        type: "array",
        items: {
          anyOf: actionVariants,
        },
        default: [],
      },
    },
    required: ["actions"],
  };

  return schema;
}

function buildArgsObjectSchema(args: ActionArgumentDefinition[]) {
  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const arg of args) {
    const name = arg.name;
    switch (arg.type) {
      case "number": {
        const num: any = { type: "number" };
        if (arg.min !== undefined) {
          num.minimum = arg.min;
        }
        if (arg.max !== undefined) {
          num.maximum = arg.max;
        }
        // No native "step" in JSON Schema Draft-07; could use multipleOf if step is integral
        if (arg.step !== undefined && Number.isFinite(arg.step) && arg.step > 0) {
          num.multipleOf = arg.step;
        }
        properties[name] = arg.required ? num : { anyOf: [num, { type: "null" }] };
        if (arg.required) required.push(name);
        break;
      }

      case "string": {
        const str: any = { type: "string" };
        if (arg.minLength !== undefined) {
          str.minLength = arg.minLength;
        }
        if (arg.maxLength !== undefined) {
          str.maxLength = arg.maxLength;
        }
        if (arg.pattern) {
          str.pattern =
            typeof arg.pattern === "string" ? arg.pattern : (arg.pattern as RegExp).source;
        }
        properties[name] = arg.required ? str : { anyOf: [str, { type: "null" }] };
        if (arg.required) required.push(name);
        break;
      }

      case "enum": {
        const en = { type: "string", enum: arg.options };
        properties[name] = arg.required ? en : { anyOf: [en, { type: "null" }] };
        if (arg.required) required.push(name);
        break;
      }

      case "boolean": {
        const bool: any = { type: "boolean" };
        properties[name] = arg.required ? bool : { anyOf: [bool, { type: "null" }] };
        if (arg.required) required.push(name);
        break;
      }

      default: {
        properties[name] = { not: {} }; // impossible schema
        break;
      }
    }
  }

  return {
    type: "object",
    additionalProperties: false,
    properties,
    required,
  };
}

/**
 * Helper to wrap a JSON Schema into OpenAI "response_format" payload for structured outputs.
 * Callers can pass this into ILLMCompletionRequest.response_format.
 *
 * Example:
 * response_format: buildOpenAIResponseFormat("votc_actions", buildStructuredResponseJsonSchema(...))
 */
export function buildOpenAIResponseFormat(name: string, schemaObject: object) {
  return {
    type: "json_schema",
    json_schema: {
      name,
      schema: schemaObject,
      strict: true,
    },
  };
}