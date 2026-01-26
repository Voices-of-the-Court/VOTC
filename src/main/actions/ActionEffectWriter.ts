import { GameData } from "../gameData/GameData";
import { runFileManager } from "./RunFileManager";
/**
 * Utilities for composing and writing CK3 effects with proper source/target scoping.
 * Positions are 0-based to match the provided example and CK3 ordered_in_global_list usage.
 */
export class ActionEffectWriter {
  /**
   * Compose CK3 prelude code to scope source/target characters from the ordered list.
   * Uses:
   *  - global_var:votc_action_source
   *  - global_var:votc_action_target
   */
  static composeScopePrelude(sourceIndex: number | null | undefined, targetIndex?: number | null, isPlayerTarget?: boolean): string {
    let prelude = "";

    if (sourceIndex !== null && sourceIndex !== undefined) {
      prelude += `
ordered_in_global_list = {
    variable = mcc_characters_list_v2
    position = ${sourceIndex}
    set_global_variable = {
        name = votc_action_source
        value = this
    }
}
`;
    }

    if (targetIndex !== null && targetIndex !== undefined) {
      if (isPlayerTarget) {
        // Use 'root' scope for player target
        prelude += `
root = {
    set_global_variable = {
        name = votc_action_target
        value = root
    }
}
`;
      } else {
        // Regular target scoping
        prelude += `
ordered_in_global_list = {
    variable = mcc_characters_list_v2
    position = ${targetIndex}
    set_global_variable = {
        name = votc_action_target
        value = this
    }
}
`;
      }
    }

    return prelude;
  }

  /**
   * Compose final CK3 effect block including scope prelude and action effect text.
   * Consumers can write this string into run file.
   */
  static composeFullEffect(
    gameData: GameData,
    sourceCharacterId: number,
    targetCharacterId: number | null | undefined,
    effectBody: string
  ): string {
    const sourceIndex = this.getCharacterIndex(gameData, sourceCharacterId);
    const targetIndex = targetCharacterId != null ? this.getCharacterIndex(gameData, targetCharacterId) : null;
    const isPlayerTarget = targetCharacterId != null && targetCharacterId === gameData.playerID;

    const prelude = this.composeScopePrelude(sourceIndex, targetIndex, isPlayerTarget);
    return `${prelude}\n${effectBody}\n`;
  }

  /**
   * Write composed effect to run file (appends).
   * Creates a RunFileManager using CK3 user folder path from SettingsRepository if not already created.
   */
  static writeEffect(
    gameData: GameData,
    sourceCharacterId: number,
    targetCharacterId: number | null | undefined,
    effectBody: string
  ): void {
    const effect = this.composeFullEffect(gameData, sourceCharacterId, targetCharacterId, effectBody);
    console.log(`Writing effect to run file: ${effect}`);
    runFileManager.append(effect);
    
    // Clear runfile after 500ms
    setTimeout(() => {
      runFileManager.clear();
    }, 500);
  }

  /**
   * Compute 0-based position for character id in the ordered list.
   * The GameData.characters Map is guaranteed to be in CK3 order.
   */
  static getCharacterIndex(gameData: GameData, characterId: number): number {
    const ids = Array.from(gameData.characters.keys());
    const idx = ids.indexOf(characterId);
    if (idx === -1) {
      throw new Error(`Character id ${characterId} not found in GameData.characters`);
    }
    return idx;
  }

}