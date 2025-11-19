/** @import { GameData, Character } from '../../gamedata_typedefs.js' */
module.exports = {
  signature: "setEmotion",
  title: "Set Target Emotion",

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  args: ({ sourceCharacter }) => [
    {
      name: "emotion",
      type: "enum",
      description: `Emotion to set for the target character (talk pose). Options: idle, sad, sadness, happy, happiness, love, admiration, pain, worry, speaking, anger, rage, fear, shock, stunned, disgust, disbelief, disapproval, dismissal, disappointed, beg, boredom, grief, crying, laugh, ecstasy, flirtation, interested, paranoia, scheme, schadenfreude, shame, stress, wailing, manic, eccentric, delirium, thinking, reading, writing, pageflipping, drinking, toast, praying, eavesdrop, debating, storyteller, dancing, eyeroll, betting, bribing, physician, survey, holdingstaff, scepter, lantern, stayback, heroflex`,
      required: true,
      options: [ "idle", "sad", "sadness", "happy", "happiness", "love", "admiration", "pain", "worry", "speaking", "anger", "rage", "fear", "shock", "stunned", "disgust", "disbelief", "disapproval", "dismissal", "disappointed", "beg", "boredom", "grief", "crying", "laugh", "ecstasy", "flirtation", "interested", "paranoia", "scheme", "schadenfreude", "shame", "stress", "wailing", "manic", "eccentric", "delirium", "thinking", "reading", "writing", "pageflipping", "drinking", "toast", "praying", "eavesdrop", "debating", "storyteller", "dancing", "eyeroll", "betting", "bribing", "physician", "survey", "holdingstaff", "scepter", "lantern", "stayback", "heroflex" ]
    }
  ],

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  description: ({ sourceCharacter }) =>
    `Set an emotion (talk_pose) for a chosen target character. Only affects the target. Target may be source character.`,

  /**
   * Only target-based: allow choosing any character as target
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   */
  check: ({ gameData, sourceCharacter }) => {
    const allIds = Array.from(gameData.characters.keys());
    const validTargets = allIds.filter((id) => id !== gameData.playerID);
    return {
      canExecute: true,
      validTargetCharacterIds: validTargets
    };
  },

  /**
   * Execute by setting a simple variable on the target scope:
   * global_var:votc_action_target = {
   *   set_variable = { name = talk_pose value = flag:<emotion> }
   * }
   *
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   * @param {Character} params.targetCharacter
   * @param {Function} params.runGameEffect
   * @param {Record<string, number|string|null>} params.args
   */
  run: ({ gameData, sourceCharacter, targetCharacter, runGameEffect, args }) => {
    if (!targetCharacter) return;

    const allowed = new Set([ "idle", "sad", "sadness", "happy", "happiness", "love", "admiration", "pain", "worry", "speaking", "anger", "rage", "fear", "shock", "stunned", "disgust", "disbelief", "disapproval", "dismissal", "disappointed", "beg", "boredom", "grief", "crying", "laugh", "ecstasy", "flirtation", "interested", "paranoia", "scheme", "schadenfreude", "shame", "stress", "wailing", "manic", "eccentric", "delirium", "thinking", "reading", "writing", "pageflipping", "drinking", "toast", "praying", "eavesdrop", "debating", "storyteller", "dancing", "eyeroll", "betting", "bribing", "physician", "survey", "holdingstaff", "scepter", "lantern", "stayback", "heroflex" ]);
    const raw = typeof args?.emotion === "string" ? args.emotion.toLowerCase().trim() : "";
    const emotion = allowed.has(raw) ? raw : "idle";

    runGameEffect(`
global_var:votc_action_target = {
    set_variable = {
        name = talk_pose
        value = flag:${emotion}
    }
}`);
  },
};