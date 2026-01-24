/** @import { GameData, Character } from '../../gamedata_typedefs.js' */

const VALID_LOCATIONS = [
  'alley_night',
  'alley_day',
  'armory',
  'battlefield',
  'temple',
  'corridor_night',
  'corridor_day',
  'council_chamber',
  'courtyard',
  'dungeon',
  'ocean',
  'terrain_travel',
  'docks',
  'farmland',
  'feast',
  'gallows',
  'garden',
  'market',
  'village',
  'burning_building',
  'sitting_room',
  'bedchamber',
  'study',
  'relaxing_room',
  'physicians_study',
  'tavern',
  'throne_room',
  'estate',
  'army_camp',
  'bath_house',
  'runestone',
  'runestone_circle',
  'beached_longships',
  'kitchen',
  'bonfire',
  'wine_cellar',
  'crossroads_inn',
  'cave',
  'tournament',
  'holy_site',
  'travel_bridge',
  'hunt_forest_hut',
  'hunt_forest_cave',
  'hunt_foggy_forest',
  'dog_kennels',
  'hunt_poachers_camp',
  'hunt_activity_camp',
  'wedding_ceremony',
  'involved_activity',
  'nursery',
  'courtyard',
  'university',
  'catacombs',
  'condemned_village',
  'funeral_pyre',
  'legendary_battlefield',
  'constantinople',
  'city_gate',
  'relaxing_tent',
  'survey',
  'terrain_settlement',
  'terrain_settlement_no_owner',
  'campfire',
  'camp',
  'camp_night',
  'military_tent',
  'village_festival',
  'coast',
  'city_steppe',
  'examination_room',
  'chinese_city',
  'japanese_city',
];

module.exports = {
  signature: "changeLocation",
  title: "Change Scene Location",

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  args: ({ sourceCharacter }) => [
    {
      name: "location",
      type: "enum",
      description: `Type of location to move to.`,
      required: true,
      options: VALID_LOCATIONS
    },
  ],

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   */
  description: ({ sourceCharacter }) =>
    `Execute when characters are moving to a new location. Changes the scene background.`,

  /**
   * @param {object} params
   * @param {Character} params.sourceCharacter
   * @param {GameData} params.gameData
   */
  check: ({ gameData, sourceCharacter }) => {
    return {
      canExecute: true,
      validTargetCharacterIds: [],
    };
  },

  /**
   * @param {object} params
   * @param {GameData} params.gameData
   * @param {Character} params.sourceCharacter
   * @param {Character} params.targetCharacter
   * @param {Function} params.runGameEffect
   * @param {Record<string, number|string|null>} params.args
   */
  run: ({ gameData, sourceCharacter, targetCharacter, runGameEffect, args }) => {
    const location = typeof args?.location === "string" ? args.location.toLowerCase().trim() : "";

    if (!location) {
      return {
        message: `Failed: No location specified. Arguments: ${JSON.stringify(args)}`,
        sentiment: 'negative',
      };
    }

    if (!VALID_LOCATIONS.includes(location)) {
      return {
        message: `Failed: Invalid location "${location}"`,
        sentiment: 'negative',
      };
    }

    runGameEffect(`set_global_variable = { name = talk_scene value = flag:talk_scene_${location} }`);

    return {
      message: `Scene changed to ${location.replace(/_/g, ' ')}`,
      sentiment: 'neutral',
    };
  },
};