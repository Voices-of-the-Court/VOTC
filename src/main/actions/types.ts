import { GameData } from "../gameData/GameData";
import { Character } from "../gameData/Character";

export type ActionArgumentPrimitiveType = "number" | "string" | "enum" | "boolean";

export interface ActionArgumentBase {
  name: string;
  displayName?: string;
  description: string;
  required?: boolean;
}

export interface NumberArgument extends ActionArgumentBase {
  type: "number";
  min?: number;
  max?: number;
  step?: number;
}

export interface StringArgument extends ActionArgumentBase {
  type: "string";
  maxLength?: number;
  minLength?: number;
  pattern?: RegExp | string;
}

export interface EnumArgument extends ActionArgumentBase {
  type: "enum";
  options: string[];
}

export interface BooleanArgument extends ActionArgumentBase {
  type: "boolean";
}

export type ActionArgumentDefinition =
  | NumberArgument
  | StringArgument
  | EnumArgument
  | BooleanArgument;

export type ActionArgumentValue = number | string | boolean | null;

export type ActionArgumentValues = Record<string, ActionArgumentValue>;

export type DynamicArgsFunction = (context: { gameData?: GameData; sourceCharacter: Character }) => ActionArgumentDefinition[];
export type DynamicDescriptionFunction = (context: { gameData?: GameData; sourceCharacter: Character }) => string;

export interface ActionCheckContext {
  gameData: GameData;
  sourceCharacter: Character;
}

export interface ActionCheckResult {
  canExecute: boolean;
  validTargetCharacterIds?: number[];
  reason?: string;
}

export interface ActionRunContext {
  gameData: GameData;
  sourceCharacter: Character;
  targetCharacter?: Character;
  runGameEffect: (effect: string) => void;
  args: ActionArgumentValues;
}

export type ActionFeedbackSentiment = 'positive' | 'negative' | 'neutral';

export interface ActionFeedback {
  message: string;
  sentiment?: ActionFeedbackSentiment;
}

export interface ActionDefinition {
  signature: string;
  title?: string;
  description: string | DynamicDescriptionFunction;
  args: ActionArgumentDefinition[] | DynamicArgsFunction;
  check: (context: ActionCheckContext) => Promise<ActionCheckResult> | ActionCheckResult;
  run: (context: ActionRunContext) => Promise<string | ActionFeedback | void> | string | ActionFeedback | void;
}

export interface ActionExecutionResult {
  actionId: string;
  success: boolean;
  feedback?: {
    message: string;
    sentiment: ActionFeedbackSentiment;
  };
  error?: string;
}

export interface ActionInvocation {
  actionId: string;
  targetCharacterId?: number | null;
  args: ActionArgumentValues;
}

export interface StructuredActionResponse {
  actions: ActionInvocation[];
}