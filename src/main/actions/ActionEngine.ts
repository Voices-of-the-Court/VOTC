import { Conversation } from "../conversation/Conversation";
import { Character } from "../gameData/Character";
import { actionRegistry } from "./ActionRegistry";
import { buildStructuredResponseJsonSchema } from "./jsonSchema";
import { buildStructuredResponseSchema } from "./schema";
import { llmManager } from "../LLMManager";
import { ActionEffectWriter } from "./ActionEffectWriter";
import { ActionArgumentValues, ActionInvocation, StructuredActionResponse } from "./types";
import { ActionPromptBuilder } from "./ActionPromptBuilder";
import type { SchemaBuildInput } from "./jsonSchema";

export class ActionEngine {
  /**
   * Evaluate actions for the given NPC (as source) based on recent conversation state.
   * - Gathers available actions via check()
   * - Builds a structured-output schema limiting targets and args
   * - Requests LLM to select actions with strict schema
   * - Runs the resolved actions (writing CK3 effects with proper scoping)
   */
  static async evaluateForCharacter(conv: Conversation, npc: Character): Promise<void> {
    try {
      // 1) Build candidate actions for this source character
      const loaded = actionRegistry.getAllActions(/* includeDisabled = */ false);

      const available: SchemaBuildInput["availableActions"] = [];
      for (const act of loaded) {
        try {
          const checkResult = await act.definition.check({
            gameData: conv.gameData,
            sourceCharacter: npc,
          });

          if (!checkResult?.canExecute) continue;

          const requiresTarget = !!(checkResult.validTargetCharacterIds && checkResult.validTargetCharacterIds.length > 0);

          available.push({
            signature: act.id,
            args: act.definition.args,
            requiresTarget,
            validTargetCharacterIds: checkResult.validTargetCharacterIds,
          });
        } catch (err) {
          // mark as invalid but continue
          actionRegistry.registerValidation( act.id, {
            valid: false,
            message: `check() threw: ${err instanceof Error ? err.message : String(err)}`
          });
        }
      }

      if (available.length === 0) {
        return;
      }

      // 2) Build messages and schema for LLM structured output
      const messages = ActionPromptBuilder.buildActionMessages(conv, npc, available);

      // Primary schema (JSON Schema for provider)
      const jsonSchema = buildStructuredResponseJsonSchema({
        availableActions: available
      });

      // Secondary validation (zod) to double-check the provider output at runtime
      const zodSchema = buildStructuredResponseSchema({
        availableActions: available
      });

      // 3) Request LLM with native structured output
      const output = await llmManager.sendStructuredJsonRequest(
        messages,
        "votc_actions",
        jsonSchema
      );

      // Handle non-stream result
      const result = await output as any; // ILLMCompletionResponse
      const content = (result && typeof result === "object") ? result.content : null;

      if (!content || typeof content !== "string") {
        // In some providers content may be null/empty despite schema. Fail gracefully.
        return;
      }

      // 4) Parse and validate JSON
      let parsed: StructuredActionResponse | undefined;
      try {
        const maybeJson = JSON.parse(content);
        const validated = zodSchema.parse(maybeJson);
        parsed = validated;
      } catch (err) {
        // If parsing/validation fails, do not run any actions
        return;
      }

      if (!parsed || !Array.isArray(parsed.actions) || parsed.actions.length === 0) {
        return;
      }

      // 5) Resolve and run actions
      for (const inv of parsed.actions) {
        await this.runInvocation(conv, npc, inv);
      }
    } catch (err) {
      // silent guard: action engine should never crash the conversation loop
      // console.error("ActionEngine error:", err);
      return;
    }
  }

  private static async runInvocation(conv: Conversation, npc: Character, inv: ActionInvocation): Promise<void> {
    const loaded = actionRegistry.getById(inv.actionId);
    if (!loaded || !loaded.validation.valid) return;

    const action = loaded.definition;

    const targetId = inv.targetCharacterId ?? null;
    const target = targetId != null ? conv.gameData.characters.get(targetId) ?? undefined : undefined;

    const runGameEffect = (effectBody: string) => {
      ActionEffectWriter.writeEffect(
        conv.gameData,
        npc.id,
        targetId,
        effectBody
      );
    };

    // Provide args as a plain object (name -> value); default to {}
    const args: ActionArgumentValues = inv.args ?? {};

    try {
      await action.run({
        gameData: conv.gameData,
        sourceCharacter: npc,
        targetCharacter: target,
        runGameEffect,
        args
      });
    } catch (err) {
      // ignore failing custom actions
    }
  }
}