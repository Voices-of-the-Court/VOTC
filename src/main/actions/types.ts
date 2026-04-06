import { GameData } from "../gameData/GameData";
import { Character } from "../gameData/Character";
import type { Conversation } from "../conversation/Conversation";

// i18n support: string or object with language codes
export type I18nString = string | Record<string, string>;

export type ActionArgumentValue = number | string | boolean | null;

export type ActionArgumentValues = Record<string, ActionArgumentValue>;

// --- Tool calling types (v2) ---

/** OpenAI-compatible function/tool definition */
export interface ToolFunctionDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

/** Dynamic function definition that receives context */
export type DynamicToolFunction = (context: { gameData: GameData }) => ToolFunctionDefinition;

export interface ActionCheckContext {
  gameData: GameData;
}

export interface ActionCheckResult {
  canExecute: boolean;
  validSourceCharacterIds?: number[];
  validTargetCharacterIds?: number[];
  reason?: string;
}

export interface ActionRunContext {
  gameData: GameData;
  sourceCharacter: Character;
  targetCharacter?: Character;
  runGameEffect: (effect: string) => void;
  args: ActionArgumentValues;
  conversation?: Conversation; // Optional conversation access for actions
  dryRun?: boolean; // True when action is being previewed, not executed
  lang?: string; // Language code for i18n (e.g., 'en', 'ru', 'fr')
}

export type ActionFeedbackSentiment = 'positive' | 'negative' | 'neutral';
export type ActionMessageType = 'badge' | 'narration';

export interface ActionFeedback {
  message: I18nString;
  title?: I18nString;
  sentiment?: ActionFeedbackSentiment;
  messageType?: ActionMessageType;
}

export interface ActionDefinition {
  signature: string;
  title?: I18nString;
  /** OpenAI-compatible function definition, or a function that returns one given context */
  function: ToolFunctionDefinition | DynamicToolFunction;
  isDestructive?: boolean;
  check: (context: ActionCheckContext) => Promise<ActionCheckResult> | ActionCheckResult;
  run: (context: ActionRunContext) => Promise<I18nString | ActionFeedback | void> | I18nString | ActionFeedback | void;
}

export interface ActionExecutionResult {
  actionId: string;
  success: boolean;
  feedback?: {
    message: string;
    title?: string;
    sentiment: ActionFeedbackSentiment;
    messageType: ActionMessageType;
  };
  error?: string;
}

export interface ActionInvocation {
  actionId: string;
  sourceCharacterId: number;
  targetCharacterId?: number | null;
  args: ActionArgumentValues;
}