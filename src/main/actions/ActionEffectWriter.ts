import { GameData } from "../gameData/GameData.js";
import { RunFileManager } from "../RunFileManager.js";
import { settingsRepository } from "../SettingsRepository.js";

/**
 * Utilities for composing and writing CK3 effects with proper source/target scoping.
 * Positions are 0-based to match the provided example and CK3 ordered_in_global_list usage.
 */
export class ActionEffectWriter {
  private static runWriter: RunFileManager | null = null;

  /**
   * Compose CK3 prelude code to scope source/target characters from the ordered list.
   * Uses:
   *  - global_var:votc_action_source
   *  - global_var:votc_action_target
   */
  static composeScopePrelude(sourceIndex: number | null | undefined, targetIndex?: number | null): string {
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

    const prelude = this.composeScopePrelude(sourceIndex, targetIndex);
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
    const writer = this.getRunWriter();
    writer.append(effect);
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

  private static getRunWriter(): RunFileManager {
    if (!this.runWriter) {
      const ck3Path = settingsRepository.getCK3UserFolderPath();
      if (!ck3Path) {
        throw new Error("CK3 user folder path is not configured. Please set it in settings.");
      }
      this.runWriter = new RunFileManager(ck3Path);
    }
    return this.runWriter;
  }
}