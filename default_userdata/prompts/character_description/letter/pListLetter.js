// Character description script for letters. Keeps a compact, single-string summary of both characters
// while including all available memories and detailed state.

module.exports = (gameData) => {
  const player = gameData.getPlayer ? gameData.getPlayer() : gameData.characters.get(gameData.playerID);
  const ai = gameData.getAi ? gameData.getAi() : gameData.characters.get(gameData.aiID);

  if (!player || !ai) {
    return "[Missing character data for letter prompt]";
  }

  const playerItems = buildCharacterItems(player, gameData, true);
  const aiItems = buildCharacterItems(ai, gameData, false);

  let output = "";
  output += `[${player.shortName}'s character info: ${playerItems.join("; \n")}]\n\n`;
  output += `[${ai.shortName}'s character info: ${aiItems.join("; \n")}]\n`;
  output += `[Letter sent on: ${gameData.date}]\n`;
  output += `[Current location: ${gameData.location}]\n`;

  return output;
};

function buildCharacterItems(char, gameData, isPlayer) {
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
      `other traits: ${otherTraits.map((t) => `${t.name} [${t.category}]${t.desc ? ` (${t.desc})` : ""}`).join(", ")}`
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
  if (char.opinionOfPlayer !== undefined) items.push(opinion(char, gameData));

  const breakdown = opinionBreakdownLine(char, gameData.playerID);
  if (breakdown) items.push(breakdown);

  if (char.relationsToPlayer && char.relationsToPlayer.length) {
    items.push(`relations to player: ${char.relationsToPlayer.join(", ")}`);
  }

  const relToChars = listRelationsToCharacters(char, gameData);
  if (relToChars) items.push(relToChars);

  if (char.treasury) {
    items.push(`treasury: ${char.treasury.amount.toFixed(2)} (${char.treasury.tooltip || "no tooltip"})`);
  }
  if (char.income) {
    items.push(`income: gold ${char.income.gold.toFixed(2)}, balance ${char.income.balance.toFixed(2)}`);
    if (char.income.balanceBreakdown) {
      items.push(`income breakdown: ${char.income.balanceBreakdown}`);
    }
  }
  if (char.influence) items.push(`influence: ${char.influence.amount} ${char.influence.tooltip || ""}`.trim());
  if (char.herd) items.push(`herd: ${char.herd.amount} ${char.herd.breakdown || ""}`.trim());

  if (char.legitimacy) {
    items.push(
      `legitimacy: ${char.legitimacy.type}, level ${char.legitimacy.level}, value ${char.legitimacy.value.toFixed(2)}`
    );
  }

  if (char.troops.totalOwnedTroops > 0) items.push(troopsLine(char));

  if (char.laws && char.laws.length) {
    items.push(`laws: ${char.laws.map((l) => l.name).join(", ")}`);
  }

  const secrets = secretsLine(char);
  if (secrets && char.id !== gameData.playerID) items.push(secrets);
  const knownSecrets = knownSecretsLine(char);
  if (knownSecrets && char.id !== gameData.playerID) items.push(knownSecrets);

  if (char.modifiers && char.modifiers.length) {
    items.push(`modifiers: ${char.modifiers.map((m) => `${m.name}${m.description ? ` (${m.description})` : ""}`).join(", ")}`);
  }

  if (char.stress) {
    items.push(`stress: level ${char.stress.level}, value ${char.stress.value}, progress ${char.stress.progress}`);
  }

  const family = familyLine(char);
  if (family) items.push(family);

  // const memLine = allMemoriesLine(char);
  // if (memLine) items.push(memLine);

  // const conversations = conversationSummariesLine(char);
  // if (conversations) items.push(conversations);

  if (!isPlayer && typeof char.opinionOfPlayer === "number") {
    items.push(`opinion of ${gameData.playerName}: ${char.opinionOfPlayer}`);
  }

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
  if (gold === 0) return "broke";
  return `in debt (gold: ${gold})`;
}

function greediness(char) {
  if (char.greed > 75) return "very greedy";
  if (char.greed > 50) return "greedy";
  if (char.greed > 25) return "slightly greedy";
  if (char.greed < -25) return "generous";
  return "neutral greed";
}

function opinion(char, gameData) {
  const op = char.opinionOfPlayer || 0;
  if (op > 60) return `opinion of ${gameData.playerName}: ${op} (very favorable)`;
  if (op > 20) return `opinion of ${gameData.playerName}: ${op} (positive)`;
  if (op > -20) return `opinion of ${gameData.playerName}: ${op} (neutral)`;
  if (op > -60) return `opinion of ${gameData.playerName}: ${op} (negative)`;
  return `opinion of ${gameData.playerName}: ${op} (hostile)`;
}

function opinionBreakdownLine(char, playerId) {
  if (!char.opinionBreakdowns || char.opinionBreakdowns.length === 0) return null;
  const playerBreakdown = char.opinionBreakdowns.find((ob) => ob.id === playerId);
  if (!playerBreakdown || !playerBreakdown.breakdown) return null;
  const list = playerBreakdown.breakdown
    .map((m) => `${m.reason}: ${m.value > 0 ? "+" : ""}${m.value}`)
    .join(", ");
  return `opinion breakdown of: ${list}`;
}

function listRelationsToCharacters(char, gameData) {
  if (!char.relationsToCharacters || char.relationsToCharacters.length === 0) return null;
  const lines = char.relationsToCharacters
    .map((rel) => {
      const targetChar = gameData.characters.get(rel.id);
      if (targetChar) {
        return `${targetChar.shortName} is ${rel.relations.join(", ")}`;
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
