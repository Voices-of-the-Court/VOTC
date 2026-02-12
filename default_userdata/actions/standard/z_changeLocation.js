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
  title: {
    en: "Change Scene Location",
    ru: "Сменить локацию сцены",
    fr: "Changer le lieu de la scène",
    de: "Szenenort ändern",
    es: "Cambiar ubicación de la escena",
    ja: "シーンの場所を変更",
    ko: "장면 장소 변경",
    pl: "Zmień lokalizację sceny",
    zh: "更改场景位置"
  },

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
   * @param {string} params.lang - Language code for i18n
   */
  run: ({ gameData, sourceCharacter, targetCharacter, runGameEffect, args, lang }) => {
    const location = typeof args?.location === "string" ? args.location.toLowerCase().trim() : "";

    if (!location) {
      return {
        message: {
          en: `Failed: No location specified. Arguments: ${JSON.stringify(args)}`,
          ru: `Ошибка: Локация не указана. Аргументы: ${JSON.stringify(args)}`,
          fr: `Échec : Aucun lieu spécifié. Arguments : ${JSON.stringify(args)}`,
          de: `Fehler: Kein Ort angegeben. Argumente: ${JSON.stringify(args)}`,
          es: `Error: No se especificó una ubicación. Argumentos: ${JSON.stringify(args)}`,
          ja: `失敗: 場所が指定されていません。引数: ${JSON.stringify(args)}`,
          ko: `실패: 장소가 지정되지 않았습니다. 인수: ${JSON.stringify(args)}`,
          pl: `Niepowodzenie: Nie określono lokalizacji. Argumenty: ${JSON.stringify(args)}`,
          zh: `失败: 未指定位置。参数: ${JSON.stringify(args)}`
        },
        sentiment: 'negative',
      };
    }

    if (!VALID_LOCATIONS.includes(location)) {
      return {
        message: {
          en: `Failed: Invalid location "${location}"`,
          ru: `Ошибка: Неверная локация "${location}"`,
          fr: `Échec : Lieu invalide "${location}"`,
          de: `Fehler: Ungültiger Ort "${location}"`,
          es: `Error: Ubicación inválida "${location}"`,
          ja: `失敗: 無効な場所 "${location}"`,
          ko: `실패: 잘못된 장소 "${location}"`,
          pl: `Niepowodzenie: Nieprawidłowa lokalizacja "${location}"`,
          zh: `失败: 无效的位置 "${location}"`
        },
        sentiment: 'negative',
      };
    }

    runGameEffect(`set_global_variable = { name = talk_scene value = flag:talk_scene_${location} }`);

    return {
      message: {
        en: `Scene changed to ${location.replace(/_/g, ' ')}`,
        ru: `Сцена изменена на ${location.replace(/_/g, ' ')}`,
        fr: `Scène changée pour ${location.replace(/_/g, ' ')}`,
        de: `Szene geändert zu ${location.replace(/_/g, ' ')}`,
        es: `Escena cambiada a ${location.replace(/_/g, ' ')}`,
        ja: `シーンが ${location.replace(/_/g, ' ')} に変更されました`,
        ko: `장면이 ${location.replace(/_/g, ' ')}(으)로 변경되었습니다`,
        pl: `Scena zmieniona na ${location.replace(/_/g, ' ')}`,
        zh: `场景已更改为 ${location.replace(/_/g, ' ')}`
      },
      sentiment: 'neutral',
    };
  },
};