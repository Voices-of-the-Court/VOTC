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
 *
 * @param input - Schema build input with available actions
 * @param useMinimizedSchema - Whether to generate a minimized schema for models with strict limits (e.g., Gemini)
 */
export function buildStructuredResponseJsonSchema(input: SchemaBuildInput, useMinimizedSchema: boolean = false) {
  // Use simplified schema for models with strict schema limitations
  if (useMinimizedSchema) {
    return buildGeminiCompatibleSchema(input);
  }

  const actionVariants = input.availableActions.map((action) => {
    const properties: any = {
      actionId: { const: action.signature },
      args: buildArgsObjectSchema(action.args),
    };

    const required: string[] = [];

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

/**
 * Build a simplified schema for Gemini models that avoids deep nesting.
 * Uses a flat structure without anyOf discriminators.
 *
 * Gemini has strict limitations:
 * - Maximum nesting depth is limited
 * - No anyOf/oneOf support
 * - Properties with enum should be simple
 *
 * Strategy: Define all possible arg properties with their types in a flat schema.
 * Each arg includes metadata about which actions use it and whether it's required.
 * Runtime validation via Zod will catch any action/arg mismatches.
 */
function buildGeminiCompatibleSchema(input: SchemaBuildInput) {  
  // Collect all possible target character IDs across all actions
  const allTargetIds = new Set<number>();
  for (const action of input.availableActions) {
    if (action.validTargetCharacterIds) {
      action.validTargetCharacterIds.forEach(id => allTargetIds.add(id));
    }
  }

  // Track which actions use which args and their constraints
  interface ArgMetadata {
    type: "number" | "string" | "enum" | "boolean";
    constraints: any;
    usedByActions: Set<string>;
    requiredByActions: Set<string>;
    enumValues?: Set<string | number>;
  }
  
  const argMetadata: Record<string, ArgMetadata> = {};
  
  // First pass: collect all args with their metadata
  for (const action of input.availableActions) {
    for (const arg of action.args) {
      const name = arg.name;
      
      if (!argMetadata[name]) {
        argMetadata[name] = {
          type: arg.type,
          constraints: {},
          usedByActions: new Set(),
          requiredByActions: new Set(),
        };
      }
      
      argMetadata[name].usedByActions.add(action.signature);
      if (arg.required) {
        argMetadata[name].requiredByActions.add(action.signature);
      }
      
      // Merge constraints based on type
      switch (arg.type) {
        case "number": {
          // const meta = argMetadata[name];
          // Take the most restrictive constraints
          // if (arg.min !== undefined) {
          //   meta.constraints.minimum = meta.constraints.minimum !== undefined
          //     ? Math.max(meta.constraints.minimum, arg.min)
          //     : arg.min;
          // }
          // if (arg.max !== undefined) {
          //   meta.constraints.maximum = meta.constraints.maximum !== undefined
          //     ? Math.min(meta.constraints.maximum, arg.max)
          //     : arg.max;
          // }
          // if (arg.step !== undefined && Number.isFinite(arg.step) && arg.step > 0) {
          //   // Use the largest step value (most restrictive)
          //   meta.constraints.multipleOf = meta.constraints.multipleOf !== undefined
          //     ? Math.max(meta.constraints.multipleOf, arg.step)
          //     : arg.step;
          // }
          break;
        }
        case "string": {
          const meta = argMetadata[name];
          if (arg.minLength !== undefined) {
            meta.constraints.minLength = meta.constraints.minLength !== undefined
              ? Math.max(meta.constraints.minLength, arg.minLength)
              : arg.minLength;
          }
          if (arg.maxLength !== undefined) {
            meta.constraints.maxLength = meta.constraints.maxLength !== undefined
              ? Math.min(meta.constraints.maxLength, arg.maxLength)
              : arg.maxLength;
          }
          if (arg.pattern) {
            const patternStr = typeof arg.pattern === "string" ? arg.pattern : arg.pattern.source;
            // If patterns differ, we can't merge them easily, so just use the first one
            if (!meta.constraints.pattern) {
              meta.constraints.pattern = patternStr;
            }
          }
          break;
        }
        case "enum": {
          const meta = argMetadata[name];
          if (!meta.enumValues) {
            meta.enumValues = new Set();
          }
          arg.options.forEach(opt => meta.enumValues!.add(opt));
          break;
        }
        case "boolean": {
          // No additional constraints for boolean
          break;
        }
      }
    }
  }
  
  // Second pass: build the arg properties with full constraints and descriptions
  const allArgProperties: Record<string, any> = {};
  
  for (const [name, meta] of Object.entries(argMetadata)) {
    let argSchema: any;
    
    switch (meta.type) {
      case "number": {
        argSchema = { type: "number", ...meta.constraints };
        break;
      }
      case "string": {
        argSchema = { type: "string", ...meta.constraints };
        break;
      }
      case "enum": {
        argSchema = {
          type: "string",
          enum: Array.from(meta.enumValues || []),
        };
        break;
      }
      case "boolean": {
        argSchema = { type: "boolean" };
        break;
      }
      default: {
        argSchema = { not: {} }; // impossible schema
      }
    }
    
    // Add description indicating which actions use this arg
    const actionsList = Array.from(meta.usedByActions).sort();
    const requiredList = Array.from(meta.requiredByActions).sort();
    
    let description = `Used by: ${actionsList.join(", ")}`;
    if (requiredList.length > 0) {
      description += `. Required for: ${requiredList.join(", ")}`;
    }
    argSchema.description = description;
    
    allArgProperties[name] = argSchema;
  }

  // Build action variants for anyOf with descriptions
  const actionIdVariants = input.availableActions.map(action => {
    const variant: any = {
      const: action.signature,
      description: action.description || action.signature,
    };
    
    // Add valid target IDs if available
    if (action.validTargetCharacterIds && action.validTargetCharacterIds.length > 0) {
      variant.validTargetCharacterIds = action.validTargetCharacterIds;
    }
    
    // Add available args for this action
    if (action.args && action.args.length > 0) {
      variant.availableArgs = action.args.map(arg => ({
        name: arg.name,
        type: arg.type,
        required: arg.required || false,
      }));
    }
    
    return variant;
  });

  // Build the schema
  const itemProperties: any = {
    actionId: {
      anyOf: actionIdVariants,
      description: "The action to perform",
    },
    args: {
      type: "object",
      properties: allArgProperties,
      description: "Arguments for the action. Different actions require different arguments.",
    },
  };

  // Only add targetCharacterId if there are valid targets
  if (allTargetIds.size > 0) {
    itemProperties.targetCharacterId = {
      type: "integer",
      enum: Array.from(allTargetIds),
      description: "The character ID to target with this action",
    };
  }

  const schema = {
    type: "object",
    properties: {
      actions: {
        type: "array",
        items: {
          type: "object",
          properties: itemProperties,
          description: "An action to perform in the game",
        },
        description: "List of actions to perform",
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
        // if (arg.min !== undefined) {
        //   num.minimum = arg.min;
        // }
        // if (arg.max !== undefined) {
        //   num.maximum = arg.max;
        // }
        // // No native "step" in JSON Schema Draft-07; could use multipleOf if step is integral
        // if (arg.step !== undefined && Number.isFinite(arg.step) && arg.step > 0) {
        //   num.multipleOf = arg.step;
        // }
        properties[name] = num;
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
        properties[name] = str;
        if (arg.required) required.push(name);
        break;
      }

      case "enum": {
        const en = { type: "string", enum: arg.options };
        properties[name] = en;
        if (arg.required) required.push(name);
        break;
      }

      case "boolean": {
        const bool: any = { type: "boolean" };
        properties[name] = bool;
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
