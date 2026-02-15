// Detailed persona builder supporting multiple characters in conversation.
// Polish localization - Just Edition (compact personality values)
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
    output += `[Informacje o postaci ${current.shortName}: ${buildCharacterItems(current, gameData, true).join("; \n")}]\n`;
    
    gameData.characters.forEach((char) => {
        if (char.id !== current.id) {
            output += `[Informacje o postaci ${char.shortName}: ${buildCharacterItems(char, gameData, false).join("; \n")}]\n`;
        }
    });

    const scenarioLine = `[data(${date}), lokalizacja(${location}), scenariusz(${scenario()})]`;

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
                return `${mainChar.shortName} jest w sali tronowej ${locationController} z ${participantsListLine}.`;
            case "garden":
                return `${mainChar.shortName} spotyka ${participantsListLine} w ogrodzie zamkowym ${locationController}.`;
            case "bedchamber":
                return `${mainChar.shortName} jest w prywatnej komnacie z ${participantsListLine}.`;
            case "feast":
                return `${mainChar.shortName} rozmawia z ${participantsListLine} podczas uczty zorganizowanej przez ${locationController}.`;
            case "army_camp":
                return `${mainChar.shortName} jest w obozie wojskowym z ${participantsListLine}.`;
            case "hunt":
                return `${mainChar.shortName} poluje z ${participantsListLine} w mglistym lesie.`;
            case "dungeon":
                return `${mainChar.shortName} jest w lochu z ${participantsListLine}.`;
            case "alley":
                return `${mainChar.shortName} spotyka ${participantsListLine} w wąskim, ukrytym zaułku.`;
            default:
                return `${mainChar.shortName} spotyka ${participantsListLine} w ${scene}.`;
        }
    }
};


function buildCharacterItems(char, gameData, isCurrent) {
  const items = [];

  items.push(`id(${char.id})`);
  items.push(`imię: ${char.firstName}`);
  items.push(`pełne imię: ${char.fullName}`);
  items.push(mainPosition(char));

  if (char.heldCourtAndCouncilPositions) {
    items.push(`${char.heldCourtAndCouncilPositions} ${char.liege || "nieznanego pana"}`);
  }

  items.push(houseAndStatus(char));
  if (char.primaryTitle !== "None of" || char.primaryTitle !== "None" || char.primaryTitle !== "None von" || char.primaryTitle !== "None de") items.push(`główny tytuł: ${char.primaryTitle}`);
  if (char.titleRankConcept !== "concept_none") items.push(`ranga tytułu: ${char.titleRankConcept}`);
  if (char.capitalLocation) items.push(`stolica: ${char.capitalLocation}`);
  if (char.location) items.push(`obecna lokalizacja: ${char.location}`);

  const personalityTraits = (char.traits || []).filter((t) => t.category === "Cech osobowości");
  if (personalityTraits.length) {
    items.push(
      `cechy osobowości: ${personalityTraits
        .map((t) => `${t.name}`)
        .join(", ")}`
    );
  }

  const otherTraits = (char.traits || []).filter((t) => t.category !== "Cech osobowości");
  if (otherTraits.length) {
    items.push(
      `inne cechy: ${otherTraits
        .map((t) => `${t.name} [${t.category}]${t.desc ? ` (${t.desc})` : ""}`)
        .join(", ")}`
    );
  }

  if (char.sexuality) items.push(`seksualność: ${char.sexuality}`);
  if (char.personality) items.push(`osobowość: ${char.personality}`);
  
  const personalityDesc = personalityDescription(char);
  if (personalityDesc && isCurrent) items.push(personalityDesc);
  
  items.push(`stan cywilny: ${marriage(char)}`);
  items.push(describeProwess(char));
  items.push(goldStatus(char));
  items.push(`wiek: ${char.age}`);
  if (char.faith) items.push(`wiara: ${char.faith}`);
  if (char.culture) items.push(`kultura: ${char.culture}`);

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
      `skarbiec: ${char.treasury.amount.toFixed(2)} (${char.treasury.tooltip || "brak opisu"})`
    );
  }

  if (char.income) {
    items.push(
      `dochód: złoto ${char.income.gold.toFixed(2)}, bilans ${char.income.balance.toFixed(2)}`
    );
  }

  if (char.influence) items.push(`wpływy: ${char.influence.amount} ${char.influence.tooltip || ""}`.trim());
  if (char.herd) items.push(`stado: ${char.herd.amount} ${char.herd.breakdown || ""}`.trim());

  if (char.legitimacy) {
    items.push(
      `legitymizacja: ${char.legitimacy.type}, poziom ${char.legitimacy.level}, wartość ${char.legitimacy.value.toFixed(2)}`
    );
  }

  if (char.troops && char.troops.totalOwnedTroops > 0) items.push(troopsLine(char));

  if (char.laws && char.laws.length) {
    items.push(`prawa: ${char.laws.map((l) => l.name).join(", ")}`);
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
      `modyfikatory: ${char.modifiers
        .map((m) => `${m.name}${m.description ? ` (${m.description})` : ""}`)
        .join(", ")}`
    );
  }

  if (isCurrent && char.stress) {
    items.push(
      `stres: poziom ${char.stress.level}, wartość ${char.stress.value}, postęp ${char.stress.progress}`
    );
  }
  if (!isCurrent && char.stress) {
    items.push(`stres: poziom ${char.stress.level}`);
  }

  const family = familyLine(char);
  if (family) items.push(family);

  return items.filter(Boolean);
}


function mainPosition(char) {
  if (char.isLandedRuler) {
    return char.isIndependentRuler
      ? `Niezależny władca ${char.primaryTitle}`
      : `Władca ${char.primaryTitle}, wasal ${char.liege}`;
  }
  if (char.isKnight) {
    return `Rycerz ${char.liege}`;
  }
  if (char.isRuler) {
    return `Przywódca ${char.primaryTitle}`;
  }
  return `Poddany ${char.liege || "nieznanego pana"}`;
}

function houseAndStatus(char) {
  let line = char.sheHe === "she" ? "kobieta" : "mężczyzna";
  line += char.house ? `, z rodu ${char.house}` : ", z niskiego rodu";
  return line;
}

function marriage(char) {
  if (char.consort) return `w związku z ${char.consort}`;
  return "kawaler";
}

function describeProwess(char) {
  const p = char.prowess || 0;
  if (p >= 15) return `bojowość: ${p} (straszliwy wojownik)`;
  if (p >= 10) return `bojowość: ${p} (zdolny wojownik)`;
  if (p >= 5) return `bojowość: ${p} (wyszkolony wojownik)`;
  if (p > 0) return `bojowość: ${p} (niedoświadczony wojownik)`;
  return `bojowość: ${p} (osoba cywilna)`;
}

function goldStatus(char) {
  const gold = char.gold || 0;
  if (gold >= 1000) return `bogaty (złoto: ${gold})`;
  if (gold > 500) return `zamożny (złoto: ${gold})`;
  if (gold > 100) return `średni majątek (złoto: ${gold})`;
  if (gold > 0) return `biedny (złoto: ${gold})`;
  if (gold === 0) return "bez złota";
  return `zadłużony (złoto: ${gold})`;
}

function personalityDescription(char) {
  const traits = [];
  
  traits.push(`odwaga: ${char.boldness}`);
  traits.push(`współczucie: ${char.compassion}`);
  traits.push(`energia: ${char.energy}`);
  traits.push(`chciwość: ${char.greed}`);
  traits.push(`honor: ${char.honor}`);
  traits.push(`racjonalność: ${char.rationality}`);
  traits.push(`towarzyskość: ${char.sociability}`);
  traits.push(`mściwość: ${char.vengefulness}`);
  traits.push(`gorliwość: ${char.zeal}`);

  return `jądro osobowości: \n${traits.join("\n")}`;
}

function opinionBreakdownLine(char, targetId, gameData) {
  if (!char.opinionBreakdowns || char.opinionBreakdowns.length === 0) return null;
  const targetBreakdown = char.opinionBreakdowns.find((ob) => ob.id === targetId);
  if (!targetBreakdown || !targetBreakdown.breakdown) return null;
  const list = targetBreakdown.breakdown
    .map((m) => `${m.reason}: ${m.value > 0 ? "+" : ""}${m.value}`)
    .join(", ");
  return `analiza opinii o ${gameData.characters.get(targetId).shortName}: ${list}`;
}

function listRelationsToCharacters(char, gameData) {
  if (!char.relationsToCharacters || char.relationsToCharacters.length === 0) return null;
  const lines = char.relationsToCharacters
    .map((rel) => {
      const targetChar = gameData.characters.get(rel.id);
      if (targetChar) {
        return `${targetChar.shortName} jest ${rel.relations.join(", ")}`.replace("twój", `${gameData.playerName}`).replace("ty", gameData.playerName);
      }
      return null;
    })
    .filter(Boolean);
  return lines.length > 0 ? `relacje postaci z ${char.fullName}: ${lines.join("; ")}` : null;
}

function secretsLine(char) {
  if (!char.secrets || char.secrets.length === 0) return null;
  const list = char.secrets
    .map((s) => `${s.name} (${s.category}${s.isCriminal ? ", przestępstwo" : ""}${s.isShunned ? ", haniebny" : ""})`)
    .join(", ");
  return `sekrety tej postaci: ${list}`;
}

function knownSecretsLine(char) {
  if (!char.knownSecrets || char.knownSecrets.length === 0) return null;
  const list = char.knownSecrets
    .map(
      (s) =>
        `${s.name} należący do ${s.ownerName} (${s.category}${s.isCriminal ? ", przestępstwo" : ""}${
          s.isShunned ? ", haniebny" : ""
        })`
    )
    .join(", ");
  return `znane sekrety: ${list}`;
}

function troopsLine(char) {
  if (!char.troops) return null;
  const total = char.troops.totalOwnedTroops || 0;
  const regiments = (char.troops.maaRegiments || [])
    .filter((r) => r.isPersonal)
    .map((r) => `${r.name}:${r.menAlive}`)
    .join(", ");
  return `wojska: łącznie ${total}, prywatne MAA: ${regiments}`;
}

function familyLine(char) {
  const parts = [];
  if (char.parents && char.parents.length > 0) {
    const parentsList = char.parents
      .map((p) => `${p.name}${p.deathDate ? ` (zmarł ${p.deathDate}${p.deathReason ? `: ${p.deathReason}` : ""})` : ""}`)
      .join(", ");
    parts.push(`rodzice ${char.fullName}: ${parentsList}`);
  }
  if (char.siblings && char.siblings.length > 0) {
    const siblingsList = char.siblings
      .map((s) => {
        const status = [s.sheHe === "he" ? "brat" : "siostra", s.maritalStatus || "kawaler"]
          .filter(Boolean)
          .join(", ");
        const death = s.deathDate ? `, zmarł ${s.deathDate}${s.deathReason ? ` (${s.deathReason})` : ""}` : "";
        const traits = (s.traits || []).map((t) => t.name).join(", ");
        return `${s.name} (${status}${death}${traits ? `, cechy: ${traits}` : ""})\n`;
      })
      .join(", ");
    parts.push(`rodzeństwo ${char.fullName}: ${siblingsList}`);
  }
  if (char.children && char.children.length > 0) {
    const childrenList = char.children
      .map((c) => {
        const status = [c.sheHe === "he" ? "syn" : "córka", c.maritalStatus || "kawaler"]
          .filter(Boolean)
          .join(", ");
        const death = c.deathDate ? `, zmarł ${c.deathDate}${c.deathReason ? ` (${c.deathReason})` : ""}` : "";
        const traits = (c.traits || []).map((t) => t.name).join(", ");
        return `${c.name} (${status}${death}${traits ? `, cechy: ${traits}` : ""})\n`;
      })
      .join(", ");
    parts.push(`dzieci ${char.fullName}: ${childrenList}`);
  }
  return parts.length ? parts.join("; ") : null;
}

function getOpinionDescription(score) {
    if (score > 60) return "oddany";
    if (score > 20) return "przyjazny";
    if (score > -20) return "neutralny";
    if (score > -60) return "pogardliwy";
    return "nienawistny";
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
                return `${char.shortName} jest ${desc} wobec ${targetCharacter.shortName}`;
            }
            return null;
        })
        .filter(Boolean);
        
    return lines.length > 0 ? `opinie[${lines.join(' | ')}]` : null;
}
