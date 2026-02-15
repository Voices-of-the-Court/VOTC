// Detailed persona builder supporting multiple characters in conversation.
// Russian localization - Just Edition (compact personality values)
// Exports a function (gameData, currentCharacterId?) => string

/**@typedef {import('../../../gamedata_typedefs').GameData} GameData */
/**@param {GameData} gameData */
module.exports = (gameData, currentCharacterId) => {
    const player = gameData.characters.get(gameData.playerID);
    const mainChar = gameData.characters.get(currentCharacterId || gameData.aiID);
    const date = gameData.date;
    const location = gameData.location;
    let locationController = gameData.locationController;
    
    if (locationController === player.fullName) {
        locationController = player.shortName;
    } else if (locationController === mainChar.fullName) {
        locationController = mainChar.shortName;
    }
    
    const scene = gameData.scene;
    const current = mainChar;

    let output = "";
    output += `[информация о персонаже ${current.shortName}: ${buildCharacterItems(current, gameData, true).join("; \n")}]\n`;
    
    gameData.characters.forEach((char) => {
        if (char.id !== current.id) {
            output += `[информация о персонаже ${char.shortName}: ${buildCharacterItems(char, gameData, false).join("; \n")}]\n`;
        }
    });

    const scenarioLine = `[дата(${date}), место(${location}), сцена(${scenario()})]`;

    output += scenarioLine;
    return output;

    function scenario() {
      let participantsListLine = ""
      gameData.characters.forEach((char) => {
        if (char.id !== current.id)
        participantsListLine += `${char.shortName}, `
      })
      participantsListLine = participantsListLine.slice(0, -2);
        switch (scene) {
            case "throne_room":
                return `${mainChar.shortName} находится в тронном зале ${locationController} с ${participantsListLine}.`;
            case "garden":
                return `${mainChar.shortName} встречает ${participantsListLine} в саду замка ${locationController}.`;
            case "bedchamber":
                return `${mainChar.shortName} находится в личных покоях с ${participantsListLine}.`;
            case "feast":
                return `${mainChar.shortName} беседует с ${participantsListLine} на пиру, устроенном ${locationController}.`;
            case "army_camp":
                return `${mainChar.shortName} находится в военном лагере с ${participantsListLine}.`;
            case "hunt":
                return `${mainChar.shortName} охотится с ${participantsListLine} в туманном лесу.`;
            case "dungeon":
                return `${mainChar.shortName} находится в темнице с ${participantsListLine}.`;
            case "alley":
                return `${mainChar.shortName} встречает ${participantsListLine} в узком скрытом переулке.`;
            default:
                return `${mainChar.shortName} встречает ${participantsListLine} в ${scene}.`;
        }
    }
};


function buildCharacterItems(char, gameData, isCurrent) {
  const items = [];

  items.push(`id(${char.id})`);
  items.push(`имя: ${char.firstName}`);
  items.push(`полное имя: ${char.fullName}`);
  items.push(mainPosition(char));

  if (char.heldCourtAndCouncilPositions) {
    items.push(`${char.heldCourtAndCouncilPositions} ${char.liege || "неизвестного сюзерена"}`);
  }

  items.push(houseAndStatus(char));
  if (char.primaryTitle !== "None of" || char.primaryTitle !== "None" || char.primaryTitle !== "None von" || char.primaryTitle !== "None de") items.push(`основной титул: ${char.primaryTitle}`);
  if (char.titleRankConcept !== "concept_none") items.push(`ранг титула: ${char.titleRankConcept}`);
  if (char.capitalLocation) items.push(`столица: ${char.capitalLocation}`);
  if (char.location) items.push(`текущее местоположение: ${char.location}`);

  const personalityTraits = (char.traits || []).filter((t) => t.category === "Свойство личности");
  if (personalityTraits.length) {
    items.push(
      `черты личности: ${personalityTraits
        .map((t) => `${t.name}`)
        .join(", ")}`
    );
  }

  const otherTraits = (char.traits || []).filter((t) => t.category !== "Свойство личности");
  if (otherTraits.length) {
    items.push(
      `другие черты: ${otherTraits
        .map((t) => `${t.name} [${t.category}]${t.desc ? ` (${t.desc})` : ""}`)
        .join(", ")}`
    );
  }

  if (char.sexuality) items.push(`сексуальность: ${char.sexuality}`);
  if (char.personality) items.push(`личность: ${char.personality}`);
  
  const personalityDesc = personalityDescription(char);
  if (personalityDesc && isCurrent) items.push(personalityDesc);
  
  items.push(`семейное положение: ${marriage(char)}`);
  items.push(describeProwess(char));
  items.push(goldStatus(char));
  items.push(`возраст: ${char.age}`);
  if (char.faith) items.push(`вера: ${char.faith}`);
  if (char.culture) items.push(`культура: ${char.culture}`);

  items.push(listOpinionsToCharacters(char, gameData));
  if (isCurrent) {
    gameData.characters.forEach((otherChar) => {
      if (otherChar.id !== char.id) {
        items.push(opinionBreakdownLine(char, otherChar.id, gameData));
      }
    })
  }
  items.push(listRelationsToCharacters(char, gameData));

  if (char.treasury) {
    items.push(
      `казна: ${char.treasury.amount.toFixed(2)} (${char.treasury.tooltip || "без описания"})`
    );
  }

  if (char.income) {
    items.push(
      `доход: золото ${char.income.gold.toFixed(2)}, баланс ${char.income.balance.toFixed(2)}`
    );
  }

  if (char.influence) items.push(`влияние: ${char.influence.amount} ${char.influence.tooltip || ""}`.trim());
  if (char.herd) items.push(`стадо: ${char.herd.amount} ${char.herd.breakdown || ""}`.trim());

  if (char.legitimacy) {
    items.push(
      `легитимность: ${char.legitimacy.type}, уровень ${char.legitimacy.level}, значение ${char.legitimacy.value.toFixed(2)}`
    );
  }

  if (char.troops && char.troops.totalOwnedTroops > 0) items.push(troopsLine(char));

  if (char.laws && char.laws.length) {
    items.push(`законы: ${char.laws.map((l) => l.name).join(", ")}`);
  }

  if (isCurrent) {
    const secrets = secretsLine(char);
    if (secrets) items.push(secrets);
  }

  if (isCurrent) {
    const knownSecrets = knownSecretsLine(char);
    if (knownSecrets) items.push(knownSecrets);
  }

  if (char.modifiers && char.modifiers.length) {
    items.push(
      `модификаторы: ${char.modifiers
        .map((m) => `${m.name}${m.description ? ` (${m.description})` : ""}`)
        .join(", ")}`
    );
  }

  if (isCurrent && char.stress) {
    items.push(
      `стресс: уровень ${char.stress.level}, значение ${char.stress.value}, прогресс ${char.stress.progress}`
    );
  }
  if (!isCurrent && char.stress) {
    items.push(`стресс: уровень ${char.stress.level}`);
  }

  const family = familyLine(char);
  if (family) items.push(family);

  return items.filter(Boolean);
}


function mainPosition(char) {
  if (char.isLandedRuler) {
    return char.isIndependentRuler
      ? `Независимый правитель ${char.primaryTitle}`
      : `Правитель ${char.primaryTitle}, вассал ${char.liege}`;
  }
  if (char.isKnight) {
    return `Рыцарь ${char.liege}`;
  }
  if (char.isRuler) {
    return `Лидер ${char.primaryTitle}`;
  }
  return `Последователь ${char.liege || "неизвестного господина"}`;
}

function houseAndStatus(char) {
  let line = char.sheHe === "she" ? "женщина" : "мужчина";
  line += char.house ? `, из дома ${char.house}` : ", незнатного происхождения";
  return line;
}

function marriage(char) {
  if (char.consort) return `в браке с ${char.consort}`;
  return "не в браке";
}

function describeProwess(char) {
  const p = char.prowess || 0;
  if (p >= 15) return `доблесть: ${p} (грозный воин)`;
  if (p >= 10) return `доблесть: ${p} (искусный боец)`;
  if (p >= 5) return `доблесть: ${p} (обученный боец)`;
  if (p > 0) return `доблесть: ${p} (неопытный боец)`;
  return `доблесть: ${p} (не боец)`;
}

function goldStatus(char) {
  const gold = char.gold || 0;
  if (gold >= 1000) return `богат (золото: ${gold})`;
  if (gold > 500) return `состоятелен (золото: ${gold})`;
  if (gold > 100) return `средний достаток (золото: ${gold})`;
  if (gold > 0) return `беден (золото: ${gold})`;
  if (gold === 0) return "нет золота";
  return `в долгах (золото: ${gold})`;
}

function personalityDescription(char) {
  const traits = [];
  
  traits.push(`смелость: ${char.boldness}`);
  traits.push(`сострадание: ${char.compassion}`);
  traits.push(`энергичность: ${char.energy}`);
  traits.push(`жадность: ${char.greed}`);
  traits.push(`честь: ${char.honor}`);
  traits.push(`рациональность: ${char.rationality}`);
  traits.push(`общительность: ${char.sociability}`);
  traits.push(`мстительность: ${char.vengefulness}`);
  traits.push(`фанатизм: ${char.zeal}`);

  return `ядро личности: \n${traits.join("\n")}`;
}

function opinionBreakdownLine(char, targetId, gameData) {
  if (!char.opinionBreakdowns || char.opinionBreakdowns.length === 0) return null;
  const targetBreakdown = char.opinionBreakdowns.find((ob) => ob.id === targetId);
  if (!targetBreakdown || !targetBreakdown.breakdown) return null;
  const list = targetBreakdown.breakdown
    .map((m) => `${m.reason}: ${m.value > 0 ? "+" : ""}${m.value}`)
    .join(", ");
  return `разброс мнения о ${gameData.characters.get(targetId).shortName}: ${list}`;
}

function listRelationsToCharacters(char, gameData) {
  if (!char.relationsToCharacters || char.relationsToCharacters.length === 0) return null;
  const lines = char.relationsToCharacters
    .map((rel) => {
      const targetChar = gameData.characters.get(rel.id);
      if (targetChar) {
        return `${targetChar.shortName} — ${rel.relations.join(", ")}`.replace("ваш", gameData.playerName).replace("вас", gameData.playerName);
      }
      return null;
    })
    .filter(Boolean);
  return lines.length > 0 ? `отношения персонажей к ${char.fullName}: ${lines.join("; ")}` : null;
}

function secretsLine(char) {
  if (!char.secrets || char.secrets.length === 0) return null;
  const list = char.secrets
    .map((s) => `${s.name} (${s.category}${s.isCriminal ? ", преступление" : ""}${s.isShunned ? ", порицаемо" : ""})`)
    .join(", ");
  return `секреты персонажа: ${list}`;
}

function knownSecretsLine(char) {
  if (!char.knownSecrets || char.knownSecrets.length === 0) return null;
  const list = char.knownSecrets
    .map(
      (s) =>
        `${s.name} ${s.ownerName} (${s.category}${s.isCriminal ? ", преступление" : ""}${
          s.isShunned ? ", порицаемо" : ""
        })`
    )
    .join(", ");
  return `известные секреты: ${list}`;
}

function troopsLine(char) {
  if (!char.troops) return null;
  const total = char.troops.totalOwnedTroops || 0;
  const regiments = (char.troops.maaRegiments || [])
    .filter((r) => r.isPersonal)
    .map((r) => `${r.name}:${r.menAlive}`)
    .join(", ");
  return `войска: всего ${total}, личная дружина: ${regiments}`;
}

function familyLine(char) {
  const parts = [];
  if (char.parents && char.parents.length > 0) {
    const parentsList = char.parents
      .map((p) => `${p.name}${p.deathDate ? ` (умер ${p.deathDate}${p.deathReason ? `: ${p.deathReason}` : ""})` : ""}`)
      .join(", ");
    parts.push(`родители ${char.fullName}: ${parentsList}`);
  }
  if (char.siblings && char.siblings.length > 0) {
    const siblingsList = char.siblings
      .map((s) => {
        const status = [s.sheHe === "he" ? "брат" : "сестра", s.maritalStatus || "не в браке"]
          .filter(Boolean)
          .join(", ");
        const death = s.deathDate ? `, умер ${s.deathDate}${s.deathReason ? ` (${s.deathReason})` : ""}` : "";
        const traits = (s.traits || []).map((t) => t.name).join(", ");
        return `${s.name} (${status}${death}${traits ? `, черты: ${traits}` : ""})\n`;
      })
      .join(", ");
    parts.push(`братья и сёстры ${char.fullName}: ${siblingsList}`);
  }
  if (char.children && char.children.length > 0) {
    const childrenList = char.children
      .map((c) => {
        const status = [c.sheHe === "he" ? "сын" : "дочь", c.maritalStatus || "не в браке"]
          .filter(Boolean)
          .join(", ");
        const death = c.deathDate ? `, умер ${c.deathDate}${c.deathReason ? ` (${c.deathReason})` : ""}` : "";
        const traits = (c.traits || []).map((t) => t.name).join(", ");
        return `${c.name} (${status}${death}${traits ? `, черты: ${traits}` : ""})\n`;
      })
      .join(", ");
    parts.push(`дети ${char.fullName}: ${childrenList}`);
  }
  return parts.length ? parts.join("; ") : null;
}

function getOpinionDescription(score) {
    if (score > 60) return "предан";
    if (score > 20) return "дружелюбен к";
    if (score > -20) return "нейтрален к";
    if (score > -60) return "презирает";
    return "ненавидит";
}

function listOpinionsToCharacters(char, gameData) {
    if (gameData.characters.size <= 2 || !char.opinions || char.opinions.length === 0) {
        return null;
    }
    const lines = char.opinions
        .map(opinionData => {
            const targetCharacter = gameData.characters.get(opinionData.id);
            if (targetCharacter && targetCharacter.id !== char.id) {
                const desc = getOpinionDescription(opinionData.opinon);
                return `${char.shortName} ${desc} ${targetCharacter.shortName}`;
            }
            return null;
        })
        .filter(Boolean);
        
    return lines.length > 0 ? `мнения[${lines.join(' | ')}]` : null;
}