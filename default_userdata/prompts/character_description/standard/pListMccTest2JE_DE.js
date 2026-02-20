// Detailed persona builder supporting multiple characters in conversation.
// German localization - Just Edition (compact personality values)
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
    output += `[Charakterinformationen von ${current.shortName}: ${buildCharacterItems(current, gameData, true).join("; \n")}]\n`;
    
    gameData.characters.forEach((char) => {
        if (char.id !== current.id) {
            output += `[Charakterinformationen von ${char.shortName}: ${buildCharacterItems(char, gameData, false).join("; \n")}]\n`;
        }
    });

    const scenarioLine = `[Datum(${date}), Ort(${location}), Szenario(${scenario()})]`;

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
                return `${mainChar.shortName} ist im Thronsaal von ${locationController} mit ${participantsListLine}.`;
            case "garden":
                return `${mainChar.shortName} trifft ${participantsListLine} im Schlossgarten von ${locationController}.`;
            case "bedchamber":
                return `${mainChar.shortName} ist in der privaten Kammer mit ${participantsListLine}.`;
            case "feast":
                return `${mainChar.shortName} unterhält sich mit ${participantsListLine} bei einem Festmahl, das von ${locationController} ausgerichtet wird.`;
            case "army_camp":
                return `${mainChar.shortName} ist im Feldlager mit ${participantsListLine}.`;
            case "hunt":
                return `${mainChar.shortName} jagt mit ${participantsListLine} in einem nebligen Wald.`;
            case "dungeon":
                return `${mainChar.shortName} ist im Kerker mit ${participantsListLine}.`;
            case "alley":
                return `${mainChar.shortName} trifft ${participantsListLine} in einer engen, verborgenen Gasse.`;
            default:
                return `${mainChar.shortName} trifft ${participantsListLine} in ${scene}.`;
        }
    }
};


function buildCharacterItems(char, gameData, isCurrent) {
  const items = [];

  items.push(`id(${char.id})`);
  items.push(`Name: ${char.firstName}`);
  items.push(`voller Name: ${char.fullName}`);
  items.push(mainPosition(char));

  if (char.heldCourtAndCouncilPositions) {
    items.push(`${char.heldCourtAndCouncilPositions} von ${char.liege || "unbekannter Lehnsherr"}`);
  }

  items.push(houseAndStatus(char));
  if (char.primaryTitle !== "None of" || char.primaryTitle !== "None" || char.primaryTitle !== "None von" || char.primaryTitle !== "None de") items.push(`Haupttitel: ${char.primaryTitle}`);
  if (char.titleRankConcept !== "concept_none") items.push(`Titelrang: ${char.titleRankConcept}`);
  if (char.capitalLocation) items.push(`Hauptstadt: ${char.capitalLocation}`);
  if (char.location) items.push(`aktueller Ort: ${char.location}`);

  const personalityTraits = (char.traits || []).filter((t) => t.category === "Persönlichkeitseigenschaft");
  if (personalityTraits.length) {
    items.push(
      `Persönlichkeitseigenschaften: ${personalityTraits
        .map((t) => `${t.name}`)
        .join(", ")}`
    );
  }

  const otherTraits = (char.traits || []).filter((t) => t.category !== "Persönlichkeitseigenschaft");
  if (otherTraits.length) {
    items.push(
      `andere Eigenschaften: ${otherTraits
        .map((t) => `${t.name} [${t.category}]${t.desc ? ` (${t.desc})` : ""}`)
        .join(", ")}`
    );
  }

  if (char.sexuality) items.push(`Sexualität: ${char.sexuality}`);
  if (char.personality) items.push(`Persönlichkeit: ${char.personality}`);
  
  const personalityDesc = personalityDescription(char);
  if (personalityDesc && isCurrent) items.push(personalityDesc);
  
  items.push(`Familienstand: ${marriage(char)}`);
  items.push(describeProwess(char));
  items.push(goldStatus(char));
  items.push(`Alter: ${char.age}`);
  if (char.faith) items.push(`Glaube: ${char.faith}`);
  if (char.culture) items.push(`Kultur: ${char.culture}`);

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
      `Schatzkammer: ${char.treasury.amount.toFixed(2)} (${char.treasury.tooltip || "keine Beschreibung"})`
    );
  }

  if (char.income) {
    items.push(
      `Einkommen: Gold ${char.income.gold.toFixed(2)}, Bilanz ${char.income.balance.toFixed(2)}`
    );
  }

  if (char.influence) items.push(`Einfluss: ${char.influence.amount} ${char.influence.tooltip || ""}`.trim());
  if (char.herd) items.push(`Herde: ${char.herd.amount} ${char.herd.breakdown || ""}`.trim());

  if (char.legitimacy) {
    items.push(
      `Legitimität: ${char.legitimacy.type}, Stufe ${char.legitimacy.level}, Wert ${char.legitimacy.value.toFixed(2)}`
    );
  }

  if (char.troops && char.troops.totalOwnedTroops > 0) items.push(troopsLine(char));

  if (char.laws && char.laws.length) {
    items.push(`Gesetze: ${char.laws.map((l) => l.name).join(", ")}`);
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
      `Modifikatoren: ${char.modifiers
        .map((m) => `${m.name}${m.description ? ` (${m.description})` : ""}`)
        .join(", ")}`
    );
  }

  if (isCurrent && char.stress) {
    items.push(
      `Stress: Stufe ${char.stress.level}, Wert ${char.stress.value}, Fortschritt ${char.stress.progress}`
    );
  }
  if (!isCurrent && char.stress) {
    items.push(`Stress: Stufe ${char.stress.level}`);
  }

  const family = familyLine(char);
  if (family) items.push(family);

  return items.filter(Boolean);
}


function mainPosition(char) {
  if (char.isLandedRuler) {
    return char.isIndependentRuler
      ? `Unabhängiger Herrscher von ${char.primaryTitle}`
      : `Herrscher von ${char.primaryTitle}, Vasall von ${char.liege}`;
  }
  if (char.isKnight) {
    return `Ritter von ${char.liege}`;
  }
  if (char.isRuler) {
    return `Anführer von ${char.primaryTitle}`;
  }
  return `Gefolgsmann von ${char.liege || "unbekannter Lehnsherr"}`;
}

function houseAndStatus(char) {
  let line = char.sheHe === "she" ? "Frau" : "Mann";
  line += char.house ? `, Haus ${char.house}` : ", niederer Stand";
  return line;
}

function marriage(char) {
  if (char.consort) return `${char.fullName} ist verheiratet mit ${char.consort}`;
  return `${char.fullName} ist ledig`;
}

function describeProwess(char) {
  const p = char.prowess || 0;
  if (p >= 15) return `Kampfkraft: ${p} (furchteinflößender Krieger)`;
  if (p >= 10) return `Kampfkraft: ${p} (geschickter Kämpfer)`;
  if (p >= 5) return `Kampfkraft: ${p} (trainierter Kämpfer)`;
  if (p > 0) return `Kampfkraft: ${p} (unerfahrener Kämpfer)`;
  return `Kampfkraft: ${p} (Nicht-Kämpfer)`;
}

function goldStatus(char) {
  const gold = char.gold || 0;
  if (gold >= 1000) return `reich (Gold: ${gold})`;
  if (gold > 500) return `wohlhabend (Gold: ${gold})`;
  if (gold > 100) return `moderater Reichtum (Gold: ${gold})`;
  if (gold > 0) return `arm (Gold: ${gold})`;
  if (gold === 0) return "kein Gold";
  return `verschuldet (Gold: ${gold})`;
}

function personalityDescription(char) {
  const traits = [];
  
  traits.push(`Mut: ${char.boldness}`);
  traits.push(`Mitgefühl: ${char.compassion}`);
  traits.push(`Energie: ${char.energy}`);
  traits.push(`Gier: ${char.greed}`);
  traits.push(`Ehre: ${char.honor}`);
  traits.push(`Rationalität: ${char.rationality}`);
  traits.push(`Geselligkeit: ${char.sociability}`);
  traits.push(`Nachtragend: ${char.vengefulness}`);
  traits.push(`Eifer: ${char.zeal}`);

  return `Persönlichkeitskern: \n${traits.join("\n")}`;
}

function opinionBreakdownLine(char, targetId, gameData) {
  if (!char.opinionBreakdowns || char.opinionBreakdowns.length === 0) return null;
  const targetBreakdown = char.opinionBreakdowns.find((ob) => ob.id === targetId);
  if (!targetBreakdown || !targetBreakdown.breakdown) return null;
  const list = targetBreakdown.breakdown
    .map((m) => `${m.reason}: ${m.value > 0 ? "+" : ""}${m.value}`)
    .join(", ");
  return `Meinungsaufschlüsselung über ${gameData.characters.get(targetId).shortName}: ${list}`;
}

function listRelationsToCharacters(char, gameData) {
  if (!char.relationsToCharacters || char.relationsToCharacters.length === 0) return null;
  const lines = char.relationsToCharacters
    .map((rel) => {
      const targetChar = gameData.characters.get(rel.id);
      if (targetChar) {
        return `${targetChar.shortName} ist ${rel.relations.join(", ")}`.replace("dein", `${gameData.playerName}s`).replace("du", gameData.playerName);
      }
      return null;
    })
    .filter(Boolean);
  return lines.length > 0 ? `Charakterbeziehungen zu ${char.fullName}: ${lines.join("; ")}` : null;
}

function secretsLine(char) {
  if (!char.secrets || char.secrets.length === 0) return null;
  const list = char.secrets
    .map((s) => `${s.name} (${s.category}${s.isCriminal ? ", verbrecherisch" : ""}${s.isShunned ? ", verpönt" : ""})`)
    .join(", ");
  return `Geheimnisse dieses Charakters: ${list}`;
}

function knownSecretsLine(char) {
  if (!char.knownSecrets || char.knownSecrets.length === 0) return null;
  const list = char.knownSecrets
    .map(
      (s) =>
        `${s.name} von ${s.ownerName} (${s.category}${s.isCriminal ? ", verbrecherisch" : ""}${
          s.isShunned ? ", verpönt" : ""
        })`
    )
    .join(", ");
  return `bekannte Geheimnisse: ${list}`;
}

function troopsLine(char) {
  if (!char.troops) return null;
  const total = char.troops.totalOwnedTroops || 0;
  const regiments = (char.troops.maaRegiments || [])
    .filter((r) => r.isPersonal)
    .map((r) => `${r.name}:${r.menAlive}`)
    .join(", ");
  return `Truppen: insgesamt ${total}, persönliche MAA: ${regiments}`;
}

function familyLine(char) {
  const parts = [];
  if (char.parents && char.parents.length > 0) {
    const parentsList = char.parents
      .map((p) => `${p.name}${p.deathDate ? ` (gestorben ${p.deathDate}${p.deathReason ? `: ${p.deathReason}` : ""})` : ""}`)
      .join(", ");
    parts.push(`Eltern von ${char.fullName}: ${parentsList}`);
  }
  if (char.siblings && char.siblings.length > 0) {
    const siblingsList = char.siblings
      .map((s) => {
        const status = [s.sheHe === "he" ? "Bruder" : "Schwester", s.maritalStatus || "ledig"]
          .filter(Boolean)
          .join(", ");
        const death = s.deathDate ? `, gestorben ${s.deathDate}${s.deathReason ? ` (${s.deathReason})` : ""}` : "";
        const traits = (s.traits || []).map((t) => t.name).join(", ");
        return `${s.name} (${status}${death}${traits ? `, Eigenschaften: ${traits}` : ""})\n`;
      })
      .join(", ");
    parts.push(`Geschwister von ${char.fullName}: ${siblingsList}`);
  }
  if (char.children && char.children.length > 0) {
    const childrenList = char.children
      .map((c) => {
        const status = [c.sheHe === "he" ? "Sohn" : "Tochter", c.maritalStatus || "ledig"]
          .filter(Boolean)
          .join(", ");
        const death = c.deathDate ? `, gestorben ${c.deathDate}${c.deathReason ? ` (${c.deathReason})` : ""}` : "";
        const traits = (c.traits || []).map((t) => t.name).join(", ");
        return `${c.name} (${status}${death}${traits ? `, Eigenschaften: ${traits}` : ""})\n`;
      })
      .join(", ");
    parts.push(`Kinder von ${char.fullName}: ${childrenList}`);
  }
  return parts.length ? parts.join("; ") : null;
}

function getOpinionDescription(score) {
    if (score > 60) return "ergeben";
    if (score > 20) return "freundlich";
    if (score > -20) return "neutral";
    if (score > -60) return "verächtlich";
    return "hasserfüllt";
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
                return `${char.shortName} ist ${desc} gegenüber ${targetCharacter.shortName}`;
            }
            return null;
        })
        .filter(Boolean);
        
    return lines.length > 0 ? `Meinungen[${lines.join(' | ')}]` : null;
}
