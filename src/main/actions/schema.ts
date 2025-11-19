import { z, ZodType, ZodTypeAny, ZodNumber, ZodString } from "zod";

import {
  ActionArgumentDefinition,
  ActionArgumentValues,
  ActionInvocation,
  StructuredActionResponse,
} from "./types";

export interface SchemaBuildInput {
  availableActions: {
    signature: string;
    args: ActionArgumentDefinition[];
    requiresTarget: boolean;
    validTargetCharacterIds?: number[];
    // Human-readable description to present in prompts (computed per sourceCharacter)
    description?: string;
  }[];
}

function buildNumberSchema(arg: Extract<ActionArgumentDefinition, { type: "number" }>) {
  let schema: ZodNumber = z.number({ required_error: `${arg.name} must be provided` });

  if (arg.min !== undefined) {
    schema = schema.min(arg.min, `${arg.name} must be >= ${arg.min}`);
  }
  if (arg.max !== undefined) {
    schema = schema.max(arg.max, `${arg.name} must be <= ${arg.max}`);
  }
  if (arg.step !== undefined && arg.step !== 0) {
    const { step } = arg;
    const base = arg.min ?? 0;
    // refine returns ZodEffects, but it's fine because we don't chain min/max after it
    schema = (schema as unknown as ZodType<number>).refine(
      (value) => Number.isInteger((value - base) / step),
      `${arg.name} must increment by ${step}`
    ) as unknown as ZodNumber;
  }

  if (!arg.required) {
    return (schema as unknown as ZodType<number>).optional().nullable();
  }

  return schema;
}

function buildStringSchema(arg: Extract<ActionArgumentDefinition, { type: "string" }>) {
  let schema: ZodString = z.string({ required_error: `${arg.name} must be provided` });

  if (arg.minLength !== undefined) {
    schema = schema.min(arg.minLength, `${arg.name} too short`);
  }
  if (arg.maxLength !== undefined) {
    schema = schema.max(arg.maxLength, `${arg.name} too long`);
  }
  if (arg.pattern) {
    const regex =
      typeof arg.pattern === "string" ? new RegExp(arg.pattern) : arg.pattern;
    schema = schema.regex(regex, `${arg.name} has invalid format`);
  }

  if (!arg.required) {
    return (schema as unknown as ZodType<string>).optional().nullable();
  }

  return schema;
}

function buildEnumSchema(arg: Extract<ActionArgumentDefinition, { type: "enum" }>) {
  const options = arg.options;
  if (!options.length) {
    return z.never({
      invalid_type_error: `${arg.name} has no enum options`,
    });
  }

  // help TS infer a non-empty tuple
  const enumOpts = options as [string, ...string[]];
  let schema = z.enum(enumOpts, {
    required_error: `${arg.name} must be provided`,
  });

  if (!arg.required) {
    return (schema as unknown as ZodType<string>).optional().nullable();
  }

  return schema;
}

function buildArgumentSchema(arg: ActionArgumentDefinition): ZodTypeAny {
  switch (arg.type) {
    case "number":
      return buildNumberSchema(arg);
    case "string":
      return buildStringSchema(arg);
    case "enum":
      return buildEnumSchema(arg);
    default: {
      const exhaustiveCheck: never = arg;
      return z.never({
        invalid_type_error: `Argument '${
          (exhaustiveCheck as { name?: string }).name ?? "unknown"
        }' has unsupported type`,
      });
    }
  }
}

export function buildActionInvocationSchema(
  input: SchemaBuildInput
): ZodType<ActionInvocation> {
  const variants = input.availableActions.map((action) => {
    const targetSchema = (() => {
      if (
        action.validTargetCharacterIds &&
        action.validTargetCharacterIds.length > 0
      ) {
        return z
          .number()
          .int()
          .refine(
            (id) => action.validTargetCharacterIds!.includes(id),
            `targetCharacterId must be one of ${action.validTargetCharacterIds.join(", ")}`
          );
      }
      if (action.requiresTarget) {
        return z
          .number()
          .int({ message: "targetCharacterId must be provided for this action" });
      }
      return z.number().int().optional().nullable();
    })();

    const argsShape: Record<string, ZodTypeAny> = {};
    for (const arg of action.args) {
      argsShape[arg.name] = buildArgumentSchema(arg);
    }

    const argsObjectSchema =
      Object.keys(argsShape).length === 0
        ? z.object({}).strict()
        : z.object(argsShape).strict();

    const variant = z
      .object({
        actionId: z.literal(action.signature),
        targetCharacterId: targetSchema,
        args: argsObjectSchema.default({} as ActionArgumentValues),
      })
      .strict();

    return variant;
  });

  if (variants.length === 0) {
    return z.never() as unknown as ZodType<ActionInvocation>;
  }

  // Relax typing to satisfy Zod's tuple requirement without over-constraining generics
  return z.discriminatedUnion("actionId", variants as [any, ...any[]]) as unknown as ZodType<ActionInvocation>;
}

export function buildStructuredResponseSchema(
  input: SchemaBuildInput
): ZodType<StructuredActionResponse> {
  const invocationSchema = buildActionInvocationSchema(input);
  const schema = z
    .object({
      actions: z.array(invocationSchema).default([]),
    })
    .strict();

  return schema as unknown as ZodType<StructuredActionResponse>;
}