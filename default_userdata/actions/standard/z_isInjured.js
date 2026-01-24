/** @import { GameData, Character } from '../../gamedata_typedefs.js' */
module.exports = {
  signature: "isInjured",
  title: "Target Is Injured",

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  args: ({ sourceCharacter }) => [
    {
      name: "injuryType",
      type: "enum",
      description: `Type of injury inflicted on the target character. Options: wounded (simple injury), remove_eye, blind, cut_leg, cut_balls (castration), disfigured.`,
      required: true,
      options: ["wounded", "remove_eye", "blind", "cut_leg", "cut_balls", "disfigured"]
    }
  ],

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  description: ({ sourceCharacter }) =>
    `Execute when the target character is injured in various ways. The injury happens generally, not from a specific source. Choose the target and injury type.`,

  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   */
  check: ({ gameData, sourceCharacter }) => {
    // Allow targeting any character including source
    const allIds = Array.from(gameData.characters.keys());
    return {
      canExecute: true,
      validTargetCharacterIds: allIds,
    };
  },

  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   * @param {Character} params.targetCharacter
   * @param {Function} params.runGameEffect
   * @param {Record<string, number|string|boolean|null>} params.args
   */
  run: ({ gameData, sourceCharacter, targetCharacter, runGameEffect, args }) => {
    if (!targetCharacter) {
      return {
        message: "Failed: No target character specified",
        sentiment: 'negative'
      };
    }

    const injuryType = typeof args?.injuryType === "string" ? args.injuryType.toLowerCase().trim() : "wounded";
    let message = "";

    // Apply specific injury based on type
    switch (injuryType) {
      case "remove_eye":
        if (targetCharacter.hasTrait("One-Eyed")) {
          runGameEffect(`
global_var:votc_action_target = {
    add_trait = blind
    remove_trait = one_eyed
}`);
          try {
            targetCharacter.addTrait({
              category: "health",
              name: "Blind",
              desc: `${targetCharacter.shortName} is blind`
            });
          } catch (e) {}
          message = `${targetCharacter.shortName}'s remaining eye was destroyed, leaving them blind`;
        } else {
          runGameEffect(`
global_var:votc_action_target = {
    add_trait = one_eyed
}`);
          try {
            targetCharacter.addTrait({
              category: "health",
              name: "One-Eyed",
              desc: `${targetCharacter.shortName} is one-eyed`
            });
          } catch (e) {}
          message = `${targetCharacter.shortName}'s eye was brutally removed`;
        }
        break;

      case "blind":
        if (!targetCharacter.hasTrait('Blind')) {
          runGameEffect(`
global_var:votc_action_target = {
    add_trait = blind
}`);
          try {
            targetCharacter.addTrait({
              category: "health",
              name: "Blind",
              desc: `${targetCharacter.shortName} is blind`
            });
          } catch (e) {}
          message = `${targetCharacter.shortName} was blinded`;
        } else {
          message = `${targetCharacter.shortName} is already blind`;
        }
        break;

      case "cut_leg":
        if (!targetCharacter.hasTrait('One-Legged')) {
          runGameEffect(`
global_var:votc_action_target = {
    add_trait = one_legged
}`);
          try {
            targetCharacter.addTrait({
              category: "health",
              name: "One-Legged",
              desc: `${targetCharacter.shortName} is one-legged`
            });
          } catch (e) {}
          message = `${targetCharacter.shortName}'s leg was severed`;
        } else {
          message = `${targetCharacter.shortName} already has only one leg`;
        }
        break;

      case "cut_balls":
        if (targetCharacter.sheHe === 'he' && (!targetCharacter.hasTrait('Eunuch') && !targetCharacter.hasTrait('Beardless Eunuch'))) {
          runGameEffect(`
global_var:votc_action_target = {
    if = {
        limit = {
            age < 12
        }
        ep3_child_castration_effect = yes
    }
    else = {
        ep3_youth_castration_effect = yes
    }
}`);
          try {
            targetCharacter.addTrait({
              category: "health",
              name: "Eunuch",
              desc: `${targetCharacter.shortName} is an eunuch`
            });
          } catch (e) {}
          message = `${targetCharacter.shortName} was castrated`;
        } else {
          message = `${targetCharacter.shortName} cannot be castrated`;
        }
        break;

      case "disfigured":
        if (!targetCharacter.hasTrait('Disfigured')) {
          runGameEffect(`
global_var:votc_action_target = {
    add_trait = disfigured
}`);
          try {
            targetCharacter.addTrait({
              category: "health",
              name: "Disfigured",
              desc: `${targetCharacter.shortName} is disfigured`
            });
          } catch (e) {}
          message = `${targetCharacter.shortName}'s face was horribly disfigured`;
        } else {
          message = `${targetCharacter.shortName} is already disfigured`;
        }
        break;

      default:
        // wounded - handled below
        message = `${targetCharacter.shortName} was injured`;
        break;
    }

    // Randomly apply lunatic or possessed with a 5% chance after any injury
    if (Math.random() < 0.05 && !(targetCharacter.hasTrait('lunatic_1') || targetCharacter.hasTrait('possessed_1'))) {
      const mentalTrait = Math.random() < 0.5 ? 'lunatic_1' : 'possessed_1';
      runGameEffect(`
global_var:votc_action_target = {
    add_trait = ${mentalTrait}
}`);
    }

    // Apply wound progression based on existing traits
    if (targetCharacter.hasTrait('Brutally Mauled')) {
      // Replace Wounded_3 with Maimed (25% chance)
      if (Math.random() < 0.25) {
        runGameEffect(`
global_var:votc_action_target = {
    remove_trait = wounded_3
    add_trait = maimed
}`);
        try {
          targetCharacter.removeTrait("Brutally Mauled");
          targetCharacter.addTrait({
            category: "health",
            name: "Maimed",
            desc: `${targetCharacter.shortName} is maimed`
          });
        } catch (e) {}
      }
    } else if (targetCharacter.hasTrait('Severely Injured')) {
      // Replace Wounded_2 with Wounded_3 (40% chance)
      if (Math.random() < 0.40) {
        runGameEffect(`
global_var:votc_action_target = {
    remove_trait = wounded_2
    add_trait = wounded_3
}`);
        try {
          targetCharacter.removeTrait("Severely Injured");
          targetCharacter.addTrait({
            category: "health",
            name: "Brutally Mauled",
            desc: `${targetCharacter.shortName} is heavily wounded`
          });
        } catch (e) {}
      }
    } else if (targetCharacter.hasTrait('Wounded')) {
      // Replace Wounded_1 with Wounded_2 (65% chance)
      if (Math.random() < 0.65) {
        runGameEffect(`
global_var:votc_action_target = {
    remove_trait = wounded_1
    add_trait = wounded_2
}`);
        try {
          targetCharacter.removeTrait("Wounded");
          targetCharacter.addTrait({
            category: "health",
            name: "Severely Injured",
            desc: `${targetCharacter.shortName} is really wounded`
          });
        } catch (e) {}
      }
    } else {
      // If the target has no wounded traits, add Wounded_1
      runGameEffect(`
global_var:votc_action_target = {
    add_trait = wounded_1
}`);
      try {
        targetCharacter.addTrait({
          category: "health",
          name: "Wounded",
          desc: `${targetCharacter.shortName} is wounded`
        });
      } catch (e) {}
    }

    return {
      message: message || `${targetCharacter.shortName} was injured`,
      sentiment: 'negative'
    };
  },
};
