import { Conversation } from "../conversation/Conversation";
import { Character } from "../gameData/Character";
import { ILLMMessage } from "../llmProviders/types";
import type { SchemaBuildInput } from "./jsonSchema";

/**
 * Builds LLM messages for action selection with structured outputs.
 * - Includes recent conversation history
 * - Lists characters with IDs and their stable order index
 * - Describes available actions, their args, and valid targets
 * - Instructs the model to return only JSON (the provider will enforce schema)
 */
export class ActionPromptBuilder {
  static buildActionMessages(
    conv: Conversation,
    npc: Character,
    available: SchemaBuildInput["availableActions"],
    historyWindow: number = conv.gameData.characters.size
  ): ILLMMessage[] {
    const messages: ILLMMessage[] = [];

    // 1) System role: purpose and strict output guidance
    const systemIntro =
`You are an action selection engine in roleplay AI system.
Your task is to choose which actions to execute for the given NPC character based on recent conversation context and available actions.
Some actions may include such argument as isPlayerSource. This argument will change action source to player character ${conv.gameData.playerName} instead of the NPC. You must set this argument to true if action makes sense to be done by the player, e.g. for action isImprisonedBy, if the player is imprisoned by action target, then isPlayerSource should be true. Use this argument wisely based on the context.
Somea actions are player-specific, meaning they should only be executed by the player character, e.g. z_playerPaysGoldTo. If gold is paid by non-player character, then action should be used unversal action, e.g. z_payGoldTo.

Important instructions:
- You MUST return ONLY JSON that matches the provided schema. Do not include prose or code fences.
- Actions MUST be selected strictly from the provided "Available Actions" list.
- Each action MUST have only one targetCharacterId (single target) or none. If you need multiple targets, repeat the action with different targets.
- If an action requires a target, pick only from the provided validTargetCharacterIds for that action.
- If an action has arguments, fill them carefully according to the description and allowed values.
- Do not invent character IDs or action names.
`;
    messages.push({ role: "system", content: systemIntro });

    // 1.1) History context: recent conversation history (last N messages)
    const history = conv.getHistory();
    const recent = history.slice(Math.max(0, history.length - historyWindow));
    const historyLines = recent.map(m => `${m.name ?? m.role}: ${m.content}`).join("\n");
    const historyBlock =
`Recent messages:
${historyLines}
`;
    messages.push({ role: "system", content: historyBlock });

    // 1.2) Recent actions history (last 10 actions)
    const actionHistoryLines: string[] = [];
    const allMessages = (conv as any).messages as any[];
    if (allMessages) {
      for (let i = allMessages.length - 1; i >= 0 && actionHistoryLines.length < 10; i--) {
        const entry = allMessages[i];
        if (entry.type === 'action-feedback' && entry.feedbacks) {
          for (const fb of entry.feedbacks) {
            if (actionHistoryLines.length >= 10) break;
            const status = fb.success ? '✓' : '✗';
            actionHistoryLines.unshift(`${status} ${fb.actionId}: ${fb.message}`);
          }
        } else if (entry.type === 'action-approval' && entry.action) {
          const action = entry.action;
          const sourceName = action.sourceCharacterName || `#${action.sourceCharacterId}`;
          const targetInfo = action.targetCharacterName 
            ? ` → ${action.targetCharacterName}` 
            : (action.targetCharacterId ? ` → #${action.targetCharacterId}` : '');
          const status = entry.status === 'approved' ? '✓' : '⏳';
          actionHistoryLines.unshift(`${status} ${sourceName}${targetInfo}: ${action.actionId}`);
        }
      }
    }
    if (actionHistoryLines.length > 0) {
      const actionHistoryBlock =
`Recent actions (last ${actionHistoryLines.length}):
${actionHistoryLines.join("\n")}
`;
      messages.push({ role: "system", content: actionHistoryBlock });
    }

    // 2) Context: Character roster with indices and ids (order is CK3 order)
    const characterRosterLines: string[] = [];
    const idsInOrder = Array.from(conv.gameData.characters.keys());
    idsInOrder.forEach((id, index) => {
      const c = conv.gameData.characters.get(id)!;
      characterRosterLines.push(`${index}: ${c.fullName} (id=${c.id})`);
    });

    const rosterBlock =
`Characters in this conversation (order matches CK3 global list):
${characterRosterLines.join("\n")}

You MUST select which actions should be executed for ${npc.fullName} (or for the player character ${conv.gameData.playerName} if isPlayerSource) based on this context:
`;

    messages.push({ role: "system", content: rosterBlock });

    // 3) Available actions listing with args and targets
    const actionLines: string[] = [];
    for (const action of available) {
      const argDescs = action.args.map(a => {
        if (a.type === "enum") {
          return `- ${a.name}: enum{${a.options.join(", ")} } ${a.required ? "(required)" : "(optional)"}`;
        }
        if (a.type === "number") {
          const bounds = [
            a.min !== undefined ? `min=${a.min}` : null,
            a.max !== undefined ? `max=${a.max}` : null,
            a.step !== undefined ? `step=${a.step}` : null
          ].filter(Boolean).join(", ");
          return `- ${a.name}: number ${bounds ? `[${bounds}]` : ""} ${a.required ? "(required)" : "(optional)"}`;
        }
        if (a.type === "string") {
          const bounds = [
            a.minLength !== undefined ? `minLen=${a.minLength}` : null,
            a.maxLength !== undefined ? `maxLen=${a.maxLength}` : null,
            a.pattern ? `pattern=${typeof a.pattern === "string" ? a.pattern : a.pattern.source}` : null
          ].filter(Boolean).join(", ");
          return `- ${a.name}: string ${bounds ? `[${bounds}]` : ""} ${a.required ? "(required)" : "(optional)"}`;
        }
        if (a.type === "boolean") {
          return `- ${a.name}: boolean ${a.required ? "(required)" : "(optional)"}`;
        }
        return '- unsupported arg';
      }).join("\n");

      let targetLine = "";
      if (action.validTargetCharacterIds && action.validTargetCharacterIds.length > 0) {
        targetLine = `Targets: one of { ${action.validTargetCharacterIds.join(", ")} }`;
      } else if (action.requiresTarget) {
        targetLine = `Targets: required (any valid character id in roster)`;
      } else {
        targetLine = `Targets: none (omit or use null)`;
      }

      const descLine = action.description ? `Description: ${action.description}` : "";

      actionLines.push(
`${action.signature}
${descLine}
${targetLine}
Args:
${argDescs || "- (no args)"}
`
      );
    }

    const actionsBlock =
`Available Actions (single-target per action):
${actionLines.join("\n")}

Return JSON only. No extra text.`;
    messages.push({ role: "system", content: actionsBlock });


    // 4) User role: instruction to select actions for this NPC now
    const outroBlock =
`
Given the above, select the actions (if any) that should be executed ONLY for ${npc.shortName} (id=${npc.id}) now only from listed actions.
Expected structure: { actions: [{ actionId, targetCharacterId?, args }] }
You must respect expected structure, action argument types and constraints. Do not invent action IDs, argument names, or character IDs.
`;
    messages.push({ role: "user", content: outroBlock });

    return messages;
  }
}