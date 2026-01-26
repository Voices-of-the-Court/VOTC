import { Conversation } from "../conversation/Conversation";
import { Character } from "../gameData/Character";
import { actionRegistry } from "./ActionRegistry";
import { buildStructuredResponseJsonSchema } from "./jsonSchema";
import { buildStructuredResponseSchema } from "./schema";
import { llmManager } from "../LLMManager";
import { ActionEffectWriter } from "./ActionEffectWriter";
import { ActionArgumentValues, ActionInvocation, StructuredActionResponse, ActionExecutionResult } from "./types";
import { ActionPromptBuilder } from "./ActionPromptBuilder";
import { healJsonResponseWithLogging } from "./responseHealing";
import type { SchemaBuildInput } from "./jsonSchema";

export class ActionEngine {
  /**
   * Evaluate actions for the given NPC (as source) based on recent conversation state.
   * - Gathers available actions via check()
   * - Builds a structured-output schema limiting targets and args
   * - Requests LLM to select actions with strict schema
   * - Runs the resolved actions (writing CK3 effects with proper scoping)
   * - Returns array of execution results with feedback
   */
  static async evaluateForCharacter(conv: Conversation, npc: Character): Promise<ActionExecutionResult[]> {
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

          // Handle dynamic args
          let args;
          if (typeof act.definition.args === 'function') {
            args = act.definition.args({ gameData: conv.gameData, sourceCharacter: npc });
          } else {
            args = act.definition.args;
          }

          // Handle dynamic description
          let description: string | undefined;
          if (typeof act.definition.description === 'function') {
            description = act.definition.description({ gameData: conv.gameData, sourceCharacter: npc });
          } else {
            description = act.definition.description;
          }

          available.push({
            signature: act.id,
            args,
            requiresTarget,
            validTargetCharacterIds: checkResult.validTargetCharacterIds,
            description,
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
        return [];
      }

      // 2) Build messages and schema for LLM structured output
      const messages = ActionPromptBuilder.buildActionMessages(conv, npc, available);
      console.log("[ActionEngine] Available actions for LLM:", available.map(a => ({
        id: a.signature,
        requiresTarget: a.requiresTarget,
        validTargets: a.validTargetCharacterIds?.length ?? 0,
        args: a.args.map(arg => `${arg.name}:${arg.type}`)
      })));

      // Primary schema (JSON Schema for provider)
      const jsonSchema = buildStructuredResponseJsonSchema({
        availableActions: available
      });

      // Secondary validation (zod) to double-check the provider output at runtime
      const zodSchema = buildStructuredResponseSchema({
        availableActions: available
      });

      // 3) Request LLM with native structured output
      
      const output = await llmManager.sendActionsRequest(
        messages,
        "votc_actions",
        jsonSchema
      );

      // Handle non-stream result
      const result = await output as any; // ILLMCompletionResponse
      console.log("[ActionEngine] Raw LLM result:", JSON.stringify(result, null, 2));
      
      const content = (result && typeof result === "object") ? result.content : null;
      console.log("[ActionEngine] Extracted content:", content);

      if (!content || typeof content !== "string") {
        // In some providers content may be null/empty despite schema. Fail gracefully.
        console.log("[ActionEngine] No valid content received from LLM");
        return [];
      }

      // 4) Parse and validate JSON with healing
      let parsed: StructuredActionResponse | undefined;
      try {
        // First attempt: Try healing the JSON response
        const maybeJson = healJsonResponseWithLogging(content, "ActionEngine");
        
        if (!maybeJson) {
          console.error("[ActionEngine] Failed to heal JSON response");
          console.error("[ActionEngine] Error details:", {
            receivedContent: content,
            expectedFormat: "{ actions: [{ actionId: string, targetCharacterId?: number, args: {} }] }",
            availableActionIds: available.map(a => a.signature)
          });
          return [];
        }
        
        console.log("[ActionEngine] Healed JSON from LLM:", JSON.stringify(maybeJson, null, 2));
        console.log("[ActionEngine] Expected structure: { actions: [{ actionId, targetCharacterId?, args }] }");
        
        const validated = zodSchema.parse(maybeJson);
        parsed = validated;
        console.log("[ActionEngine] Successfully validated against schema");
      } catch (err) {
        // If validation fails, do not run any actions
        console.error("[ActionEngine] Validation error:", err);
        console.error("[ActionEngine] Error details:", {
          receivedContent: content,
          expectedFormat: "{ actions: [{ actionId: string, targetCharacterId?: number, args: {} }] }",
          availableActionIds: available.map(a => a.signature)
        });
        return [];
      }

      if (!parsed || !Array.isArray(parsed.actions) || parsed.actions.length === 0) {
        return [];
      }

      // 5) Resolve and run actions, collecting results
      const results: ActionExecutionResult[] = [];
      for (const inv of parsed.actions) {
        const result = await this.runInvocation(conv, npc, inv);
        results.push(result);
      }
      
      return results;
    } catch (err) {
      // silent guard: action engine should never crash the conversation loop
      console.error("ActionEngine error:", err);
      return [];
    }
  }

  private static async runInvocation(conv: Conversation, npc: Character, inv: ActionInvocation): Promise<ActionExecutionResult> {
    const loaded = actionRegistry.getById(inv.actionId);
    if (!loaded || !loaded.validation.valid) {
      return {
        actionId: inv.actionId,
        success: false,
        error: 'Action not found or invalid'
      };
    }

    const action = loaded.definition;

    const targetId = inv.targetCharacterId ?? null;
    const target = targetId != null ? conv.gameData.characters.get(targetId) ?? undefined : undefined;

    console.log("Running action:", inv.actionId, { source: npc.id, target: targetId, args: inv.args });
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
      const result = await action.run({
        gameData: conv.gameData,
        sourceCharacter: npc,
        targetCharacter: target,
        runGameEffect,
        args
      });

      // Handle different return types
      let feedback: ActionExecutionResult['feedback'] = undefined;
      if (result) {
        console.log(`Action ${inv.actionId} executed successfully with result:`, result);
        if (typeof result === 'string') {
          // Simple string feedback - default to neutral sentiment
          feedback = { message: result, sentiment: 'neutral' };
        } else if (typeof result === 'object' && 'message' in result) {
          // ActionFeedback object with optional sentiment
          feedback = {
            message: result.message,
            sentiment: result.sentiment || 'neutral'
          };
        }
      }

      return {
        actionId: inv.actionId,
        success: true,
        feedback
      };
    } catch (err) {
      console.error(`Action ${inv.actionId} failed:`, err);
      return {
        actionId: inv.actionId,
        success: false,
        error: err instanceof Error ? err.message : String(err)
      };
    }
  }
}