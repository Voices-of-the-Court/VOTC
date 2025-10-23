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
    historyWindow: number = 8
  ): ILLMMessage[] {
    const messages: ILLMMessage[] = [];

    // 1) System role: purpose and strict output guidance
    const systemIntro =
`You are an action selection engine for a Crusader Kings 3 roleplay assistant.
- You MUST return ONLY JSON that matches the provided schema. Do not include prose or code fences.
- Actions MUST be selected strictly from the provided "Available Actions" list.
- Each action MUST have only one targetCharacterId (single target). If you need multiple targets, repeat the action with different targets.
- If an action requires a target, pick only from the provided validTargetCharacterIds for that action.
- If an action has arguments, fill them carefully according to the description and allowed values.
- Do not invent character IDs or action names.`;
    messages.push({ role: "system", content: systemIntro });

    // 2) Context: Character roster with indices and ids (order is CK3 order)
    const characterRosterLines: string[] = [];
    const idsInOrder = Array.from(conv.gameData.characters.keys());
    idsInOrder.forEach((id, index) => {
      const c = conv.gameData.characters.get(id)!;
      characterRosterLines.push(`${index}: ${c.shortName} (id=${c.id})`);
    });

    const rosterBlock =
`Characters in this conversation (order matches CK3 global list):
${characterRosterLines.join("\n")}

You are selecting actions for: ${npc.shortName} (id=${npc.id}).`;

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

      actionLines.push(
`${action.signature}
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

    // 4) Recent conversation history (last N messages)
    const history = conv.getHistory();
    const recent = history.slice(Math.max(0, history.length - historyWindow));
    const historyLines = recent.map(m => `${m.name ?? m.role}: ${m.content}`).join("\n");
    const historyBlock =
`Recent messages:
${historyLines}

Given the above, select the actions (if any) that ${npc.shortName} (id=${npc.id}) would execute now.`;
    messages.push({ role: "user", content: historyBlock });

    return messages;
  }
}