// Updated for the new reactive action system (source/target semantics).
// Target is the killer of the source character.

module.exports = {
  signature: "noOp",
  title: {
    en: "No executed actions fallback",
    ru: "Отсутствие выполненных действий",
    fr: "Aucune action exécutée",
    de: "Keine ausgeführten Aktionen",
    es: "Respaldo sin acciones ejecutadas",
    ja: "実行されたアクションなし",
    ko: "실행된 작업 없음",
    pl: "Brak wykonanych akcji",
    zh: "无执行操作回退"
  },

  // Dynamic args receive sourceCharacter (kept empty for this action, but enables richer prompts)
  args: ({ sourceCharacter }) => [],

  // Dynamic description to reduce LLM confusion by naming the source explicitly
  description: ({ sourceCharacter }) =>
    `Always execute when there's no other actions to execute.`,

  /**
   * New check signature: ({ gameData, sourceCharacter })
   * Make this action available for any source character, with all other characters
   * as potential killers (targets). LLM must choose the killer explicitly.
   */
  check: ({ gameData, sourceCharacter }) => {
    return {
      canExecute: true
    };
  },

  /**
   * New run signature:
   * ({ gameData, sourceCharacter, targetCharacter, runGameEffect, args })
   * We scope the death on the source character with the killer set to the target.
   * ActionEffectWriter will have already created:
   *  - global_var:votc_action_source  (the source character)
   *  - global_var:votc_action_target  (the target character: the killer)
   * Additionally, if the target is the player, votc_action_target will be scoped to 'root'.
   */
  run: ({ gameData, sourceCharacter, targetCharacter, runGameEffect }) => {
    // If for some reason target wasn't provided, do nothing.
    return;
  },
};
