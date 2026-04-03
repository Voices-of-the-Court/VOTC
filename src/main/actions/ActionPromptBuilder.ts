import { Conversation } from "../conversation/Conversation";
import { Character } from "../gameData/Character";
import { ILLMMessage } from "../llmProviders/types";

/**
 * Builds LLM messages for action selection using tool calling.
 * The available tools are passed separately to the LLM provider.
 * This builder provides conversation context and instructions.
 */
export class ActionPromptBuilder {
  static buildActionMessages(
    conv: Conversation,
    npc: Character,
    historyWindow: number = conv.gameData.characters.size
  ): ILLMMessage[] {
    const messages: ILLMMessage[] = [];

    // 1) System role: purpose and tool-calling guidance
    const systemIntro =
`You are an action selection engine in a roleplay AI system.

Your job is to decide which game actions should be executed right now based on the conversation. Use the provided tools to execute actions. You may call zero or more tools.

KEY RULES:
- Use ONLY the tools provided. Never invent tool names or argument names.
- If a tool has a targetCharacterId parameter, use a valid character ID from the roster below.
- Fill arguments exactly as specified (types, min/max, enums).
- If nothing meaningful happened, do not call any tools.

PLAYER-SPECIFIC ACTIONS & isPlayerSource:
- Some actions are player-only (e.g. playerPaysGoldTo). Use them when the player performed the action in the conversation.
- Actions with isPlayerSource: boolean let you flip the source to the player character "${conv.gameData.playerName}". Set it to true only when the context clearly shows the player is the source.

GOLD PAYMENT RULE (very important):
- If the player's last message narrates paying gold AND the NPC accepts it, you MUST call the correct gold action tool.

IMPRISONMENT RULE (very important):
- If the player's message narrates imprisoning the current NPC (or vice versa), you MUST call isImprisonedBy.

You are now processing the NPC "${npc.fullName}" turn.`;

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
      content: `Characters in this conversation (order matches CK3 global list):\n${characterRosterLines.join("\n")}`
    });

    // 5. Final user instruction
    const outroBlock =
`Given the conversation above, call the appropriate tool(s) for actions that should be executed right now.

You may call tools for:
• Actions for ${npc.fullName} (id=${npc.id})
• OR player-specific actions when the conversation shows the player performed them

If no actions are needed, do not call any tools.`;

    messages.push({ role: "user", content: outroBlock });

    return messages;
  }
}