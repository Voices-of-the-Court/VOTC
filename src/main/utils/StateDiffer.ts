import { GameData } from "../gameData/GameData";
import { Character } from "../gameData/Character";

/**
 * StateDiffer — computes the delta between a frozen (baseline) gameData snapshot
 * and the live (action-mutated) gameData, for prompt-cache optimization.
 *
 * Context: when prompt caching is enabled, the cached prompt prefix is rendered from
 * the frozen snapshot so it stays byte-identical across turns (cache hits). The live
 * state still mutates as characters perform actions (pay gold, gain traits, form
 * relations, leave the conversation). This class produces a small, bounded textual
 * diff of only what changed, which PromptBuilder appends to the (uncached) tail of
 * the prompt — after history, before the instruction — so the model sees current state
 * without invalidating the cached prefix.
 *
 * Bounded size: scales with (#changed fields × #characters), NOT conversation length.
 * Empty diff -> returns null (caller omits the block entirely).
 */
export class StateDiffer {
  /**
   * Render the live "current scene" section (scene/location/controller/participants).
   * Always rendered from the LIVE gameData (these can change on changeLocation /
   * leavesConversation), placed in the uncached tail so the frozen prefix is immune.
   * Note: this is live-state (not a diff) and is emitted every turn.
   */
  static renderCurrentScene(live: GameData, currentChar: Character): string {
    const present = Array.from(live.characters.values())
      .filter((c) => c.id !== currentChar.id)
      .map((c) => c.shortName);
    const controller =
      live.locationController === live.playerName
        ? 'you (player)'
        : live.locationController || 'unknown';
    const participants = present.length > 0 ? present.join(', ') : 'no one else';

    return (
      `## Current Scene (live)\n` +
      `- Date: ${live.date}\n` +
      `- Location: ${live.location || 'unknown'} ` +
      `(held by ${controller})\n` +
      `- Scene: ${live.scene}\n` +
      `- Present: ${currentChar.shortName}, ${participants}`
    );
  }

  /**
   * Compute and render the state diff (baseline -> live) as a textual block.
   * Returns null when nothing changed, so the caller can omit the block entirely.
   *
   * Covers:
   *  - characters that joined / left the conversation
   *  - per-character gold changes (leads with the CURRENT value)
   *  - traits gained / lost
   *  - relations gained / lost (to other characters and to the player)
   *
   * Does NOT cover fields that are only mutated by parseLog at conversation start
   * (opinions, income, memories, bio) — those are stable mid-conversation by design.
   */
  static renderDiff(baseline: GameData, live: GameData): string | null {
    const lines: string[] = [];

    // --- Membership changes (who joined / left) ---
    const baselineIds = new Set(baseline.characters.keys());
    const liveIds = new Set(live.characters.keys());

    const joined: Character[] = [];
    for (const id of liveIds) {
      if (!baselineIds.has(id)) joined.push(live.characters.get(id)!);
    }
    const left: string[] = [];
    for (const id of baselineIds) {
      if (!liveIds.has(id)) {
        const c = baseline.characters.get(id);
        left.push(c ? c.shortName : `character ${id}`);
      }
    }

    if (joined.length > 0) {
      lines.push(`- Entered the conversation: ${joined.map((c) => c.shortName).join(', ')}.`);
    }
    if (left.length > 0) {
      lines.push(`- Left the conversation: ${left.join(', ')}.`);
    }

    // Per-character diffs (only for characters present in both)
    for (const id of baselineIds) {
      if (!liveIds.has(id)) continue; // handled above
      const bChar = baseline.characters.get(id)!;
      const lChar = live.characters.get(id)!;
      lines.push(...this.diffCharacter(bChar, lChar, baseline));
    }

    if (lines.length === 0) return null;

    return `## Changes this conversation (since it began)\n` + lines.join('\n');
  }

  /**
   * Diff a single character. Returns human-readable lines (empty if unchanged).
   * Leads with the CURRENT value so the model doesn't have to do arithmetic.
   */
  private static diffCharacter(
    baseline: Character,
    live: Character,
    baselineGameData: GameData
  ): string[] {
    const lines: string[] = [];
    const name = live.shortName;

    // --- Gold (scalar) ---
    // Only emit when changed (per decision: show changed fields only).
    if (baseline.gold !== live.gold) {
      const delta = live.gold - baseline.gold;
      const sign = delta >= 0 ? '+' : '';
      lines.push(
        `- ${name} now has ${live.gold} gold ` +
          `(started at ${baseline.gold}; ${sign}${delta} this conversation).`
      );
    }

    // --- Traits (set) ---
    const baselineTraits = baseline.traits || [];
    const liveTraits = live.traits || [];

    const bTraitNames = new Set(baselineTraits.map((t) => t.name.toLowerCase()));
    const lTraitNames = new Set(liveTraits.map((t) => t.name.toLowerCase()));

    // Gained traits
    const gainedTraits = liveTraits.filter((t) => !bTraitNames.has(t.name.toLowerCase()));
    if (gainedTraits.length > 0) {
        lines.push(
            `- ${name} gained trait(s): ` +
              gainedTraits.map((t) => `${t.name}${t.desc ? ` (${t.desc})` : ''}`).join(', ') +
              `.`
        );
    }

    // Lost traits
    const lostTraits = baselineTraits.filter((t) => !lTraitNames.has(t.name.toLowerCase()));
    if (lostTraits.length > 0) {
        lines.push(
            `- ${name} lost trait(s): ` +
              lostTraits.map((t) => `${t.name}${t.desc ? ` (${t.desc})` : ''}`).join(', ') +
              `.`
        );
    }

    // --- Relations to other characters (set) ---
    const bRelations = this.collectRelations(baseline);
    const lRelations = this.collectRelations(live);
    const relKey = (charId: number, rel: string) => `${charId}|${rel.toLowerCase()}`;
    const bRelKeys = new Set(
      bRelations.flatMap((r) => r.relations.map((rel) => relKey(r.id, rel)))
    );
    for (const entry of lRelations) {
      const added = entry.relations.filter((rel) => !bRelKeys.has(relKey(entry.id, rel)));
      if (added.length > 0) {
        const targetName = baselineGameData.characters.get(entry.id)?.shortName ?? `character ${entry.id}`;
        lines.push(
          `- ${name} is now ${added.join(', ')} with ${targetName}.`
        );
      }
    }

    // --- Relations to player (list of strings) ---
    const bToPlayer = new Set((baseline.relationsToPlayer || []).map((r) => r.toLowerCase()));
    const addedToPlayer = (live.relationsToPlayer || []).filter(
      (r) => !bToPlayer.has(r.toLowerCase())
    );
    if (addedToPlayer.length > 0) {
      lines.push(
        `- ${name} now ${addedToPlayer.join(', ')} ${baselineGameData.playerName}.`
      );
    }

    const bStress = baseline.stress;
    const lStress = live.stress;

    if (bStress && lStress && bStress.value !== lStress.value) {
      const delta = lStress.value - bStress.value;
      const sign = delta >= 0 ? '+' : '';
      const levelChanged = bStress.level !== lStress.level;
      
      let msg = `- ${name}'s stress is now ${lStress.value} (was ${bStress.value}; ${sign}${delta})`;
      if (levelChanged) {
        msg += ` — stress level changed to ${lStress.level}`;
      }
      lines.push(msg + '.');
    }

    return lines;
  }

  /**
   * Flatten relationsToCharacters for a character into {id, relations[]} pairs,
   * tolerating missing fields.
   */
  private static collectRelations(
    char: Character
  ): { id: number; relations: string[] }[] {
    if (!char.relationsToCharacters) return [];
    return char.relationsToCharacters.map((r) => ({ id: r.id, relations: r.relations || [] }));
  }
}
