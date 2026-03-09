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
`You are an action selection engine in a roleplay AI system.

Your ONLY job is to decide which game actions should be executed right now based on the conversation and available actions.

KEY RULES:
- You MUST return ONLY valid JSON matching the schema provided by the provider. No prose, no explanations, no code fences.
- Use ONLY actions from the "Available Actions" list below. Never invent actionIds or argument names.
- Every action must have exactly one targetCharacterId (or none if the action allows it).
- If an action needs a target, use ONLY the validTargetCharacterIds listed for that action.
- Fill arguments exactly as specified (types, min/max, enums).

PLAYER-SPECIFIC ACTIONS & isPlayerSource:
- Some actions are player-only (e.g. playerPaysGoldTo). Use them when the player performed the action in the conversation.
- Actions with isPlayerSource: boolean let you flip the source to the player character "${conv.gameData.playerName}". Set it to true only when the context clearly shows the player is the source.

GOLD PAYMENT RULE (very important):
- If the player's last message narrates paying gold AND the NPC accepts it (or takes the gold), you MUST include the correct gold action:
  • playerPaysGoldTo (when player is paying)
  • paysGoldTo (when NPC is paying)
- This is required to update the treasury state. Do not skip it just because the payment was already narrated.

IMPRISONMENT RULE (very important):
- If the player's message narrates imprisoning the current NPC (or the NPC imprisoning the player), you MUST include isImprisonedBy.
- Target = the jailor.
- prisonType = "dungeon" (default) or "house_arrest".
- Use isPlayerSource: true ONLY if the PLAYER is the one being imprisoned.
- This is required to update the imprisonment state.

If nothing else fits, use the noOp action.

You are now processing the NPC "${npc.fullName}" turn, but you may still output player-specific actions when needed to keep game state correct.`;

    messages.push({ role: "system", content: systemIntro });

    // 2. Recent conversation history
    const history = conv.getHistory();
    const recent = history.slice(Math.max(0, history.length - historyWindow));
    const historyLines = recent.map(m => `${m.name ?? m.role}: ${m.content}`).join("\n");
    messages.push({
      role: "system",
      content: `Recent messages:\n${historyLines}`
    });

    // 3. Recent actions history (last 10)
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
      messages.push({
        role: "system",
        content: `Recent actions (last ${actionHistoryLines.length}):\n${actionHistoryLines.join("\n")}`
      });
    }

    // 4. Character roster
    const characterRosterLines: string[] = [];
    const idsInOrder = Array.from(conv.gameData.characters.keys());
    idsInOrder.forEach((id, index) => {
      const c = conv.gameData.characters.get(id)!;
      const playerTag = c.id === conv.gameData.playerID ? " (PLAYER)" : "";
      characterRosterLines.push(`${index}: ${c.fullName} (id=${c.id})${playerTag}`);
    });

    messages.push({
      role: "system",
      content: `Characters in this conversation (order matches CK3 global list):\n${characterRosterLines.join("\n")}\n\nYou are now selecting actions for the current turn.`
    });

    // 5. Available Actions — cleaner formatting
    const actionLines: string[] = [];
    for (const action of available) {
      const argDescs = action.args.length
        ? action.args.map(a => {
            if (a.type === "enum") return `- ${a.name}: enum{${a.options.join(", ")}} ${a.required ? "(required)" : "(optional)"}`;
            if (a.type === "number") {
              const bounds = [
                a.min !== undefined ? `min=${a.min}` : "",
                a.max !== undefined ? `max=${a.max}` : "",
                a.step !== undefined ? `step=${a.step}` : ""
              ].filter(Boolean).join(", ");
              return `- ${a.name}: number${bounds ? ` [${bounds}]` : ""} ${a.required ? "(required)" : "(optional)"}`;
            }
            if (a.type === "string") {
              const bounds = [
                a.minLength !== undefined ? `minLen=${a.minLength}` : "",
                a.maxLength !== undefined ? `maxLen=${a.maxLength}` : "",
                a.pattern ? `pattern=${typeof a.pattern === "string" ? a.pattern : a.pattern.source}` : ""
              ].filter(Boolean).join(", ");
              return `- ${a.name}: string${bounds ? ` [${bounds}]` : ""} ${a.required ? "(required)" : "(optional)"}`;
            }
            return `- ${a.name}: ${a.type} ${a.required ? "(required)" : "(optional)"}`;
          }).join("\n")
        : "- (no args)";

      const targetLine = action.validTargetCharacterIds?.length
        ? `Targets: one of { ${action.validTargetCharacterIds.join(", ")} }`
        : action.requiresTarget
          ? "Targets: required (any valid character id in roster)"
          : "Targets: none (omit or use null)";

      actionLines.push(
`${action.signature}
Description: ${action.description || "—"}
${targetLine}
Args:
${argDescs}
`
      );
    }

    const actionsBlock =
`Available Actions:

${actionLines.join("\n\n")}

Return JSON only. No extra text.`;
    messages.push({ role: "system", content: actionsBlock });

    // 6. Few-shot examples (most powerful improvement)
    const fewShot = `Examples of correct JSON output:

Example 1 — Normal NPC reaction:
{
  "actions": [
    {
      "actionId": "changeOpinionOf",
      "targetCharacterId": 47903,
      "args": { "value": -2 }
    },
    {
      "actionId": "setEmotion",
      "targetCharacterId": 55376,
      "args": { "emotion": "anger" }
    }
  ]
}

Example 2 — Player just paid gold and NPC accepted it:
{
  "actions": [
    {
      "actionId": "playerPaysGoldTo",
      "targetCharacterId": 55376,
      "args": { "amount": 200 }
    }
  ]
}

Follow this exact structure.`;

    messages.push({ role: "system", content: fewShot });

    // 7. Final user instruction
    const outroBlock =
`Given everything above, select the actions (if any) that should be executed right now.

You may output:
• Actions for ${npc.fullName} (id=${npc.id})
• OR player-specific actions (e.g. playerPaysGoldTo) when the conversation shows the player performed them

Respect all argument types, constraints, and valid targets.`;

    messages.push({ role: "user", content: outroBlock });

    return messages;
  }
}