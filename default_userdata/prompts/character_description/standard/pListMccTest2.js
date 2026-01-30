// Detailed persona builder supporting multiple characters in conversation.
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
    
    // current character as primary scope
    const current = mainChar;

    let output = "";
    output += `[${current.shortName}'s character info: ${buildCharacterItems(current, gameData, true).join("; \n")}]\n`;
    
    // other characters as secondary scopes
    gameData.characters.forEach((char) => {
        if (char.id !== current.id) {
            output += `[${char.shortName}'s character info: ${buildCharacterItems(char, gameData, false).join("; \n")}]\n`;
        }
    });

    const scenarioLine = `[date(${date}), location(${location}), scenario(${scenario()})]`;

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
                return `${mainChar.shortName} is in ${locationController}'s throneroom with ${participantsListLine}.`;
            case "garden":
                return `${mainChar.shortName} meets ${participantsListLine} in ${locationController}'s castle garden.`;
            case "bedchamber":
                return `${mainChar.shortName} is in the private bedchamber with ${participantsListLine}.`;
            case "feast":
                return `${mainChar.shortName} talks with ${participantsListLine} during a feast hosted by ${locationController}.`;
            case "army_camp":
                return `${mainChar.shortName} is in the army camp with ${participantsListLine}.`;
            case "hunt":
                return `${mainChar.shortName} is hunting with ${participantsListLine} in a foggy forest.`;
            case "dungeon":
                return `${mainChar.shortName} is in the dungeon with ${participantsListLine}.`;
            case "alley":
                return `${mainChar.shortName} meets ${participantsListLine} in a narrow, hidden alley.`;
            default:
                return `${mainChar.shortName} meets ${participantsListLine} in ${scene}.`;
        }
    }
};


    function buildCharacterItems(char, gameData, isCurrent) {
  const items = [];

  items.push(`id(${char.id})`);
  items.push(`name: ${char.firstName}`);
  items.push(`full name: ${char.fullName}`);
  items.push(mainPosition(char));

  if (char.heldCourtAndCouncilPositions) {
    items.push(`${char.heldCourtAndCouncilPositions} of ${char.liege || "unknown liege"}`);
  }

  items.push(houseAndStatus(char));
  if (char.primaryTitle !== "None of") items.push(`primary title: ${char.primaryTitle}`);
  if (char.titleRankConcept !== "concept_none") items.push(`title rank: ${char.titleRankConcept}`);
  if (char.capitalLocation) items.push(`capital: ${char.capitalLocation}`);
  if (char.location) items.push(`current location: ${char.location}`);

  const personalityTraits = (char.traits || []).filter((t) => t.category === "Personality Trait");
  if (personalityTraits.length) {
    items.push(
      `personality traits: ${personalityTraits
        .map((t) => `${t.name}${t.desc ? ` (${t.desc})` : ""}`)
        .join(", ")}`
    );
  }

  const otherTraits = (char.traits || []).filter((t) => t.category !== "Personality Trait");
  if (otherTraits.length) {
    items.push(
      `other traits: ${otherTraits
        .map((t) => `${t.name} [${t.category}]${t.desc ? ` (${t.desc})` : ""}`)
        .join(", ")}`
    );
  }

  if (char.sexuality) items.push(`sexuality: ${char.sexuality}`);
  if (char.personality) items.push(`personality: ${char.personality}`);
  if (typeof char.greed === "number") items.push(`greediness: ${greediness(char)}`);
  items.push(`marital status: ${marriage(char)}`);
  items.push(describeProwess(char));
  items.push(goldStatus(char));
  items.push(`age: ${char.age}`);
  if (char.faith) items.push(`faith: ${char.faith}`);
  if (char.culture) items.push(`culture: ${char.culture}`);

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
      `treasury: ${char.treasury.amount.toFixed(2)} (${char.treasury.tooltip || "no tooltip"})`
    );
  }

  if (char.income) {
    items.push(
      `income: gold ${char.income.gold.toFixed(2)}, balance ${char.income.balance.toFixed(2)}`
    );
    // income breakdown intentionally omitted to avoid prompt bloat
  }

  if (char.influence) items.push(`influence: ${char.influence.amount} ${char.influence.tooltip || ""}`.trim());
  if (char.herd) items.push(`herd: ${char.herd.amount} ${char.herd.breakdown || ""}`.trim());

  if (char.legitimacy) {
    items.push(
      `legitimacy: ${char.legitimacy.type}, level ${char.legitimacy.level}, value ${char.legitimacy.value.toFixed(2)}`
    );
  }

  if (char.troops && char.troops.totalOwnedTroops > 0) items.push(troopsLine(char));

  if (char.laws && char.laws.length) {
    items.push(`laws: ${char.laws.map((l) => l.name).join(", ")}`);
  }

  // Sensitive: secrets only for current character (regardless of playerID)
  if (isCurrent) {
    const secrets = secretsLine(char);
    if (secrets) items.push(secrets);
  }

  // Sensitive: known secrets only for current character
  if (isCurrent) {
    const knownSecrets = knownSecretsLine(char);
    if (knownSecrets) items.push(knownSecrets);
  }

  if (char.modifiers && char.modifiers.length) {
    items.push(
      `modifiers: ${char.modifiers
        .map((m) => `${m.name}${m.description ? ` (${m.description})` : ""}`)
        .join(", ")}`
    );
  }

  // Sensitive: internal stress only for current character
  if (isCurrent && char.stress) {
    items.push(
      `stress: level ${char.stress.level}, value ${char.stress.value}, progress ${char.stress.progress}`
    );
  }
  if (!isCurrent && char.stress) {
    items.push(`stress: level ${char.stress.level}`);
  }

  const family = familyLine(char);
  if (family) items.push(family);

  // Sensitive: per-character conversation summaries only for current character
  // if (isCurrent) {
  //   const summaries = conversationSummariesLine(char);
  //   if (summaries) items.push(summaries);
  // }

  return items.filter(Boolean);
}


function mainPosition(char) {
  if (char.isLandedRuler) {
    return char.isIndependentRuler
      ? `Independent ruler of ${char.primaryTitle}`
      : `Ruler of ${char.primaryTitle}, vassal of ${char.liege}`;
  }
  if (char.isKnight) {
    return `Knight of ${char.liege}`;
  }
  if (char.isRuler) {
    return `Leader of ${char.primaryTitle}`;
  }
  return `Follower of ${char.liege || "unknown lord"}`;
}

function houseAndStatus(char) {
  let line = char.sheHe === "she" ? "woman" : "man";
  line += char.house ? `, of house ${char.house}` : ", lowborn";
  return line;
}

function marriage(char) {
  if (char.consort) return `married to ${char.consort}`;
  return "unmarried";
}

function describeProwess(char) {
  const p = char.prowess || 0;
  if (p >= 15) return `prowess: ${p} (formidable warrior)`;
  if (p >= 10) return `prowess: ${p} (skilled combatant)`;
  if (p >= 5) return `prowess: ${p} (trained fighter)`;
  if (p > 0) return `prowess: ${p} (inexperienced fighter)`;
  return `prowess: ${p} (non-combatant)`;
}

function goldStatus(char) {
  const gold = char.gold || 0;
  if (gold >= 1000) return `wealthy (gold: ${gold})`;
  if (gold > 500) return `comfortable (gold: ${gold})`;
  if (gold > 100) return `moderate wealth (gold: ${gold})`;
  if (gold > 0) return `poor (gold: ${gold})`;
  if (gold === 0) return "has no gold";
  return `in debt (gold: ${gold})`;
}

function greediness(char) {
  if (char.greed > 75) return "very greedy";
  if (char.greed > 50) return "greedy";
  if (char.greed > 25) return "slightly greedy";
  if (char.greed < -25) return "generous";
  return "neutral greed";
}

function opinionBreakdownLine(char, targetId, gameData) {
  if (!char.opinionBreakdowns || char.opinionBreakdowns.length === 0) return null;
  const targetBreakdown = char.opinionBreakdowns.find((ob) => ob.id === targetId);
  if (!targetBreakdown || !targetBreakdown.breakdown) return null;
  const list = targetBreakdown.breakdown
    .map((m) => `${m.reason}: ${m.value > 0 ? "+" : ""}${m.value}`)
    .join(", ");
  return `opinion breakdown of ${gameData.characters.get(targetId).shortName}: ${list}`;
}

function listRelationsToCharacters(char, gameData) {
  if (!char.relationsToCharacters || char.relationsToCharacters.length === 0) return null;
  const lines = char.relationsToCharacters
    .map((rel) => {
      const targetChar = gameData.characters.get(rel.id);
      if (targetChar) {
        return `${targetChar.shortName} is ${rel.relations.join(", ")}`.replace("your", gameData.playerName + "'s").replace("of you", "of " + gameData.playerName);
      }
      return null;
    })
    .filter(Boolean);
  return lines.length > 0 ? `relations of characters to ${char.fullName}: ${lines.join("; ")}` : null;
}

function secretsLine(char) {
  if (!char.secrets || char.secrets.length === 0) return null;
  const list = char.secrets
    .map((s) => `${s.name} (${s.category}${s.isCriminal ? ", criminal" : ""}${s.isShunned ? ", shunned" : ""})`)
    .join(", ");
  return `this character secrets: ${list}`;
}

function knownSecretsLine(char) {
  if (!char.knownSecrets || char.knownSecrets.length === 0) return null;
  const list = char.knownSecrets
    .map(
      (s) =>
        `${s.name} of ${s.ownerName} (${s.category}${s.isCriminal ? ", criminal" : ""}${
          s.isShunned ? ", shunned" : ""
        })`
    )
    .join(", ");
  return `known secrets: ${list}`;
}

function troopsLine(char) {
  if (!char.troops) return null;
  const total = char.troops.totalOwnedTroops || 0;
  const regiments = (char.troops.maaRegiments || [])
    .filter((r) => r.isPersonal)
    .map((r) => `${r.name}:${r.menAlive}`)
    .join(", ");
  return `troops: total ${total}, personal MAA: ${regiments}`;
}

function allMemoriesLine(char) {
  if (!char.memories || char.memories.length === 0) return null;
  const list = char.memories
    .map((m) => `${m.creationDate} (${m.creationDateTotalDays}): ${m.type} - ${m.desc}`)
    .join(" | ");
  return `memories: ${list}`;
}

function familyLine(char) {
  const parts = [];
  if (char.parents && char.parents.length > 0) {
    const parentsList = char.parents
      .map((p) => `${p.name}${p.deathDate ? ` (died ${p.deathDate}${p.deathReason ? `: ${p.deathReason}` : ""})` : ""}`)
      .join(", ");
    parts.push(`parents of ${char.fullName}: ${parentsList}`);
  }
  if (char.siblings && char.siblings.length > 0) {
    const siblingsList = char.siblings
      .map((s) => {
        const status = [s.sheHe === "he" ? "brother" : "sister", s.maritalStatus || "unmarried"]
          .filter(Boolean)
          .join(", ");
        const death = s.deathDate ? `, died ${s.deathDate}${s.deathReason ? ` (${s.deathReason})` : ""}` : "";
        const traits = (s.traits || []).map((t) => t.name).join(", ");
        return `${s.name} (${status}${death}${traits ? `, traits: ${traits}` : ""})\n`;
      })
      .join(", ");
    parts.push(`siblings of ${char.fullName}: ${siblingsList}`);
  }
  if (char.children && char.children.length > 0) {
    const childrenList = char.children
      .map((c) => {
        const status = [c.sheHe === "he" ? "son" : "daughter", c.maritalStatus || "unmarried"]
          .filter(Boolean)
          .join(", ");
        const death = c.deathDate ? `, died ${c.deathDate}${c.deathReason ? ` (${c.deathReason})` : ""}` : "";
        const traits = (c.traits || []).map((t) => t.name).join(", ");
        return `${c.name} (${status}${death}${traits ? `, traits: ${traits}` : ""})\n`;
      })
      .join(", ");
    parts.push(`children of ${char.fullName}: ${childrenList}`);
  }
  return parts.length ? parts.join("; ") : null;
}

function conversationSummariesLine(char) {
  if (!char.conversationSummaries || char.conversationSummaries.length === 0) return null;
  const list = char.conversationSummaries.map((s) => `${s.date}: ${s.content}`).join(" | ");
  return `conversation summaries: ${list}`;
}



    function getOpinionDescription(score) {
        if (score > 60) return "devoted to";
        if (score > 20) return "friendly toward";
        if (score > -20) return "neutral toward";
        if (score > -60) return "contempt toward";
        return "hateful toward";
    }

    function opinionOfPlayer(char) {
        if (char.id === player.id) return null;
        const desc = getOpinionDescription(char.opinionOfPlayer);
        return `opinion_of_player(${desc})`;
    }

    function listOpinionsToCharacters(char, gameData) {
        if (gameData.characters.size <= 2 || !char.opinions || char.opinions.length === 0) {
            return null;
        }
        const lines = char.opinions
            .map(opinionData => {
                const targetCharacter = gameData.characters.get(opinionData.id);
                // Exclude self and player (handled separately)
                if (targetCharacter && targetCharacter.id !== char.id) {
                    const desc = getOpinionDescription(opinionData.opinon);
                    return `${char.shortName} seems ${desc} ${targetCharacter.shortName}`;
                }
                return null;
            })
            .filter(Boolean);
            
        return lines.length > 0 ? `opinions[${lines.join(' | ')}]` : null;
    }


    