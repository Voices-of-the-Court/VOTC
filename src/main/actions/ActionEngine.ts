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
import { settingsRepository } from "../SettingsRepository";

export interface ActionEvaluationResult {
  autoApproved: ActionExecutionResult[];
  needsApproval: Array<{
    actionId: string;
    actionTitle?: string;
    sourceCharacterId: number;
    sourceCharacterName: string;
    targetCharacterId?: number;
    targetCharacterName?: string;
    args: ActionArgumentValues;
    isDestructive: boolean;
    invocation: ActionInvocation;
  }>;
}

export interface ActionRunOptions {
  dryRun?: boolean;
}

export class ActionEngine {
  /**
   * Evaluate actions for the given NPC (as source) based on recent conversation state.
   * - Gathers available actions via check()
   * - Builds a structured-output schema limiting targets and args
   * - Requests LLM to select actions with strict schema
   * - Separates actions into auto-approved and needs-approval based on settings
   * - Runs auto-approved actions immediately
   * - Returns both executed and pending actions
   */
  static async evaluateForCharacter(conv: Conversation, npc: Character, signal?: AbortSignal): Promise<ActionEvaluationResult> {
    try {
      // Check if cancelled before starting
      if (signal?.aborted) {
        return { autoApproved: [], needsApproval: [] };
      }
      // 1) Build candidate actions for this source character
      const loaded = actionRegistry.getAllActions(/* includeDisabled = */ false);

      const available: SchemaBuildInput["availableActions"] = [];
      for (const act of loaded) {
        // Check for cancellation during action gathering
        if (signal?.aborted) {
          return { autoApproved: [], needsApproval: [] };
        }

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
        return { autoApproved: [], needsApproval: [] };
      }

      // Check for cancellation before LLM request
      if (signal?.aborted) {
        console.log('[DEBUG] ActionEngine: Aborted before LLM request');
        return { autoApproved: [], needsApproval: [] };
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

      // 3) Request LLM with native structured output (pass abort signal)
      
      const output = await llmManager.sendActionsRequest(
        messages,
        "votc_actions",
        jsonSchema,
        signal
      );

      // Check for cancellation after LLM request
      if (signal?.aborted) {
        console.log('[DEBUG] ActionEngine: Aborted after LLM request');
        return { autoApproved: [], needsApproval: [] };
      }

      // Handle non-stream result
      const result = await output as any; // ILLMCompletionResponse
      
      const content = (result && typeof result === "object") ? result.content : null;

      if (!content || typeof content !== "string") {
        return { autoApproved: [], needsApproval: [] };
      }

      // Check for cancellation before parsing
      if (signal?.aborted) {
        console.log('[DEBUG] ActionEngine: Aborted before parsing response');
        return { autoApproved: [], needsApproval: [] };
      }

      // 4) Parse and validate JSON with healing
      let parsed: StructuredActionResponse | undefined;
      try {
        // First attempt: Try healing the JSON response
        const maybeJson = healJsonResponseWithLogging(content, "ActionEngine");
        
        if (!maybeJson) {
          return { autoApproved: [], needsApproval: [] };
        }
        
        const validated = zodSchema.parse(maybeJson);
        parsed = validated;
      } catch (err) {
        return { autoApproved: [], needsApproval: [] };
      }

      if (!parsed || !Array.isArray(parsed.actions) || parsed.actions.length === 0) {
        console.log('[ActionEngine] No actions to process');
        return { autoApproved: [], needsApproval: [] };
      }
      
      console.log(`[ActionEngine] Processing ${parsed.actions.length} actions from LLM`);

      // Check for cancellation before processing actions
      if (signal?.aborted) {
        console.log('[DEBUG] ActionEngine: Aborted before processing actions');
        return { autoApproved: [], needsApproval: [] };
      }

      // 5) Get approval settings and separate actions
      const approvalSettings = settingsRepository.getActionApprovalSettings();
      console.log('[ActionEngine] Approval settings:', approvalSettings);
      const autoApproved: ActionExecutionResult[] = [];
      const needsApproval: ActionEvaluationResult['needsApproval'] = [];

      for (const inv of parsed.actions) {
        // Check for cancellation before each action
        if (signal?.aborted) {
          console.log('[DEBUG] ActionEngine: Aborted during action processing');
          break;
        }

        // Get action definition to check if it's destructive
        const loaded = actionRegistry.getById(inv.actionId);
        if (!loaded || !loaded.validation.valid) {
          continue;
        }

        const isDestructive = (loaded.definition as any).isDestructive || false;
        console.log(`[ActionEngine] Action ${inv.actionId} isDestructive property: ${(loaded.definition as any).isDestructive}, computed: ${isDestructive}`);
        
        // Determine if this action needs approval
        let needsUserApproval = false;
        
        switch (approvalSettings.approvalMode) {
          case 'none':
            // 'none' means no auto-accept, so all actions need approval
            needsUserApproval = true;
            break;
          case 'non-destructive':
            // 'non-destructive' means auto-accept non-destructive, so only destructive need approval
            needsUserApproval = isDestructive;
            break;
          case 'all':
            // 'all' means auto-accept all, so no actions need approval
            needsUserApproval = false;
            break;
        }
        
        console.log(`[ActionEngine] Action ${inv.actionId} isDestructive property: ${loaded.definition.isDestructive}, computed: ${isDestructive}, needsApproval: ${needsUserApproval}`);

        if (needsUserApproval) {
          // Add to pending approval list
          const targetId = inv.targetCharacterId ?? null;
          const target = targetId != null ? conv.gameData.characters.get(targetId) ?? undefined : undefined;
          
          console.log(`[ActionEngine] Action ${inv.actionId} needs approval (destructive: ${isDestructive})`);
          needsApproval.push({
            actionId: inv.actionId,
            actionTitle: loaded.definition.title,
            sourceCharacterId: npc.id,
            sourceCharacterName: npc.shortName,
            targetCharacterId: targetId ?? undefined,
            targetCharacterName: target?.shortName,
            args: inv.args ?? {},
            isDestructive,
            invocation: inv
          });
        } else {
          // Execute immediately
          console.log(`[ActionEngine] Action ${inv.actionId} auto-approved (destructive: ${isDestructive})`);
          const result = await this.runInvocation(conv, npc, inv);
          autoApproved.push(result);
        }
      }
      
      return { autoApproved, needsApproval };
    } catch (err) {
      // Check if this was an abort
      if (signal?.aborted) {
        console.log('[DEBUG] ActionEngine: Caught abort signal in error handler');
        return { autoApproved: [], needsApproval: [] };
      }
      // silent guard: action engine should never crash the conversation loop
      console.error("ActionEngine error:", err);
      return { autoApproved: [], needsApproval: [] };
    }
  }

  /**
   * Execute an action invocation. When dryRun is true, game effects are not written.
   */
  static async runInvocation(
    conv: Conversation,
    npc: Character,
    inv: ActionInvocation,
    options?: ActionRunOptions
  ): Promise<ActionExecutionResult> {
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

    // console.log("Running action:", inv.actionId, { source: npc.id, target: targetId, args: inv.args });
    const runGameEffect = (effectBody: string) => {
      // In dry runs we avoid writing to the game run file
      if (options?.dryRun) {
        return;
      }
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
        args,
        conversation: conv,
        dryRun: options?.dryRun
      });

      // Handle different return types
      let feedback: ActionExecutionResult['feedback'] = undefined;
      if (result) {
        // console.log(`Action ${inv.actionId} executed successfully with result:`, result);
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
