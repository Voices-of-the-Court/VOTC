import { Conversation } from "../conversation/Conversation";
import { Character } from "../gameData/Character";
import { actionRegistry } from "./ActionRegistry";
import { llmManager } from "../LLMManager";
import { ActionEffectWriter } from "./ActionEffectWriter";
import { ActionArgumentValues, ActionInvocation, ActionExecutionResult, ToolFunctionDefinition } from "./types";
import { ActionPromptBuilder } from "./ActionPromptBuilder";
import { settingsRepository } from "../SettingsRepository";
import { resolveI18nString } from "./i18nUtils";
import { ActionSandbox } from "./ActionSandbox";

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

/** Resolved tool definition with mapping back to action signature */
interface ResolvedTool {
  signature: string;
  functionName: string;
  toolDef: ToolFunctionDefinition;
  validTargetCharacterIds?: number[];
}

export class ActionEngine {
  /**
   * Evaluate actions for the given NPC (as source) based on recent conversation state.
   * Uses LLM tool calling instead of structured JSON output.
   */
  static async evaluateForCharacter(conv: Conversation, npc: Character, signal?: AbortSignal): Promise<ActionEvaluationResult> {
    try {
      if (signal?.aborted) {
        return { autoApproved: [], needsApproval: [] };
      }
      
      const userLang = settingsRepository.getLanguage();
      
      // 1) Build candidate actions and their tool definitions
      const loaded = actionRegistry.getAllActions(/* includeDisabled = */ false);
      const resolvedTools: ResolvedTool[] = [];

      for (const act of loaded) {
        if (signal?.aborted) {
          return { autoApproved: [], needsApproval: [] };
        }

        try {
          const checkResult = await act.definition.check({
            gameData: conv.gameData,
            sourceCharacter: npc,
          });

          if (!checkResult?.canExecute) continue;

          // Resolve the function definition (call it if dynamic)
          let toolDef: ToolFunctionDefinition;
          if (typeof act.definition.function === 'function') {
            toolDef = act.definition.function({ gameData: conv.gameData, sourceCharacter: npc });
          } else {
            toolDef = { ...act.definition.function };
          }

          // Deep clone parameters so we can modify them
          toolDef = {
            ...toolDef,
            parameters: JSON.parse(JSON.stringify(toolDef.parameters))
          };

          // Enrich targetCharacterId parameter with valid target IDs from check()
          if (checkResult.validTargetCharacterIds && checkResult.validTargetCharacterIds.length > 0) {
            if (toolDef.parameters.properties.targetCharacterId) {
              toolDef.parameters.properties.targetCharacterId.enum = checkResult.validTargetCharacterIds;
            }
          }

          resolvedTools.push({
            signature: act.id,
            functionName: toolDef.name,
            toolDef,
            validTargetCharacterIds: checkResult.validTargetCharacterIds,
          });
        } catch (err) {
          actionRegistry.registerValidation(act.id, {
            valid: false,
            message: `check() threw: ${err instanceof Error ? err.message : String(err)}`
          });
        }
      }

      if (resolvedTools.length === 0) {
        return { autoApproved: [], needsApproval: [] };
      }

      if (signal?.aborted) {
        console.log('[DEBUG] ActionEngine: Aborted before LLM request');
        return { autoApproved: [], needsApproval: [] };
      }

      // 2) Build messages for LLM
      const messages = ActionPromptBuilder.buildActionMessages(conv, npc);

      // 3) Build OpenAI-compatible tools array
      const tools = resolvedTools.map(rt => ({
        type: 'function' as const,
        function: {
          name: rt.toolDef.name,
          description: rt.toolDef.description,
          parameters: rt.toolDef.parameters,
        }
      }));

      // Build function name → signature mapping
      const fnNameToSignature = new Map<string, string>();
      for (const rt of resolvedTools) {
        fnNameToSignature.set(rt.functionName, rt.signature);
      }

      console.log(`[ActionEngine] Tool call request for ${npc.fullName}:`, messages);
      console.log(`[ActionEngine] Available tools (${tools.length}):`, tools.map(t => t.function.name));

      // 4) Request LLM with tool calling
      const output = await llmManager.sendActionsRequest(messages, tools, signal);

      if (signal?.aborted) {
        console.log('[DEBUG] ActionEngine: Aborted after LLM request');
        return { autoApproved: [], needsApproval: [] };
      }

      const result = await output as any;
      
      console.log('[ActionEngine] LLM response:', JSON.stringify({
        content: result?.content,
        tool_calls: result?.tool_calls,
        finish_reason: result?.finish_reason,
        usage: result?.usage,
      }));

      // 5) Parse tool_calls from the response
      const toolCalls = result?.tool_calls;
      if (!toolCalls || !Array.isArray(toolCalls) || toolCalls.length === 0) {
        console.log('[ActionEngine] No tool calls in response');
        return { autoApproved: [], needsApproval: [] };
      }

      console.log(`[ActionEngine] Processing ${toolCalls.length} tool calls from LLM`);

      if (signal?.aborted) {
        return { autoApproved: [], needsApproval: [] };
      }

      // 6) Convert tool calls to action invocations and separate by approval
      const approvalSettings = settingsRepository.getActionApprovalSettings();
      const autoApproved: ActionExecutionResult[] = [];
      const needsApproval: ActionEvaluationResult['needsApproval'] = [];

      for (const tc of toolCalls) {
        if (signal?.aborted) break;

        const fnName = tc.function?.name;
        const signature = fnNameToSignature.get(fnName);
        if (!signature) {
          console.warn(`[ActionEngine] Unknown tool call function: ${fnName}`);
          continue;
        }

        const loaded = actionRegistry.getById(signature);
        if (!loaded || !loaded.validation.valid) continue;

        // Parse the arguments
        let args: ActionArgumentValues = {};
        try {
          args = typeof tc.function.arguments === 'string' 
            ? JSON.parse(tc.function.arguments) 
            : tc.function.arguments ?? {};
        } catch (err) {
          console.warn(`[ActionEngine] Failed to parse tool call arguments for ${fnName}:`, err);
          continue;
        }

        console.log(`[ActionEngine] Tool call: ${fnName} (action: ${signature})`, JSON.stringify(args));

        // Extract targetCharacterId from args if present
        let targetCharacterId: number | null = null;
        if ('targetCharacterId' in args && args.targetCharacterId != null) {
          targetCharacterId = Number(args.targetCharacterId);
          delete args.targetCharacterId;
        }

        const inv: ActionInvocation = {
          actionId: signature,
          targetCharacterId,
          args,
        };

        const isDestructive = actionRegistry.getEffectiveDestructive(signature);
        
        let needsUserApproval = false;
        switch (approvalSettings.approvalMode) {
          case 'none':
            needsUserApproval = true;
            break;
          case 'non-destructive':
            needsUserApproval = isDestructive;
            break;
          case 'all':
            needsUserApproval = false;
            break;
        }

        if (needsUserApproval) {
          const target = targetCharacterId != null ? conv.gameData.characters.get(targetCharacterId) ?? undefined : undefined;
          const actionTitle = loaded.definition.title 
            ? resolveI18nString(loaded.definition.title, userLang)
            : undefined;
          
          needsApproval.push({
            actionId: signature,
            actionTitle,
            sourceCharacterId: npc.id,
            sourceCharacterName: npc.shortName,
            targetCharacterId: targetCharacterId ?? undefined,
            targetCharacterName: target?.shortName,
            args,
            isDestructive,
            invocation: inv,
          });
        } else {
          const result = await this.runInvocation(conv, npc, inv);
          autoApproved.push(result);
        }
      }
      
      return { autoApproved, needsApproval };
    } catch (err) {
      if (signal?.aborted) {
        return { autoApproved: [], needsApproval: [] };
      }
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

    const targetId = inv.targetCharacterId ?? null;
    const target = targetId != null ? conv.gameData.characters.get(targetId) ?? undefined : undefined;

    // Get user's language preference
    const userLang = settingsRepository.getLanguage();

    console.log(`[ActionEngine] Firing action: ${inv.actionId} (source: ${npc.shortName}, target: ${target?.shortName ?? 'none'}, args: ${JSON.stringify(inv.args ?? {})}, dryRun: ${options?.dryRun ?? false})`);
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
      // Execute action in sandboxed VM context for security
      const result = await ActionSandbox.executeAction(loaded.filePath, {
        gameData: conv.gameData,
        sourceCharacter: npc,
        targetCharacter: target,
        runGameEffect,
        args,
        conversation: conv,
        dryRun: options?.dryRun,
        lang: userLang
      });

      // Handle different return types
      let feedback: ActionExecutionResult['feedback'] = undefined;
      if (result) {
        console.log(`[ActionEngine] Action ${inv.actionId} executed successfully with result:`, result);
        if (typeof result === 'string') {
          // Simple string feedback - resolve i18n and default to neutral sentiment
          feedback = { message: result, sentiment: 'neutral', messageType: 'badge' };
        } else if (typeof result === 'object') {
          // Could be I18nString object or ActionFeedback object
          if ('message' in result) {
            // ActionFeedback object with optional sentiment and messageType
            feedback = {
              message: resolveI18nString(result.message, userLang),
              ...(result.title ? { title: resolveI18nString(result.title, userLang) } : {}),
              sentiment: (result.sentiment || 'neutral') as 'positive' | 'negative' | 'neutral',
              messageType: (result.messageType || 'badge') as 'badge' | 'narration'
            };
          } else {
            // Plain I18nString object (Record<string, string>)
            feedback = {
              message: resolveI18nString(result, userLang),
              sentiment: 'neutral',
              messageType: 'badge'
            };
          }
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
