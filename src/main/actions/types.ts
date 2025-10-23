import { GameData } from "../gameData/GameData.js";
import { Character } from "../gameData/Character.js";

export type ActionArgumentPrimitiveType = "number" | "string" | "enum";

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

export type ActionArgumentDefinition =
  | NumberArgument
  | StringArgument
  | EnumArgument;

export type ActionArgumentValue = number | string | null;

export type ActionArgumentValues = Record<string, ActionArgumentValue>;

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

export interface ActionDefinition {
  signature: string;
  title?: string;
  description: string;
  args: ActionArgumentDefinition[];
  check: (context: ActionCheckContext) => Promise<ActionCheckResult> | ActionCheckResult;
  run: (context: ActionRunContext) => Promise<void> | void;
}

export interface ActionInvocation {
  actionId: string;
  targetCharacterId?: number | null;
  args: ActionArgumentValues;
}

export interface StructuredActionResponse {
  actions: ActionInvocation[];
}