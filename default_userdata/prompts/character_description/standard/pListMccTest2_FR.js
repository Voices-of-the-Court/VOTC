// Detailed persona builder supporting multiple characters in conversation.
// French localization
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
    output += `[Informations sur ${current.shortName}: ${buildCharacterItems(current, gameData, true).join("; \n")}]\n`;
    
    gameData.characters.forEach((char) => {
        if (char.id !== current.id) {
            output += `[Informations sur ${char.shortName}: ${buildCharacterItems(char, gameData, false).join("; \n")}]\n`;
        }
    });

    const scenarioLine = `[date(${date}), lieu(${location}), scénario(${scenario()})]`;

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
                return `${mainChar.shortName} est dans la salle du trône de ${locationController} avec ${participantsListLine}.`;
            case "garden":
                return `${mainChar.shortName} rencontre ${participantsListLine} dans les jardins du château de ${locationController}.`;
            case "bedchamber":
                return `${mainChar.shortName} est dans la chambre privée avec ${participantsListLine}.`;
            case "feast":
                return `${mainChar.shortName} discute avec ${participantsListLine} lors d'un festin organisé par ${locationController}.`;
            case "army_camp":
                return `${mainChar.shortName} est au camp militaire avec ${participantsListLine}.`;
            case "hunt":
                return `${mainChar.shortName} chasse avec ${participantsListLine} dans une forêt brumeuse.`;
            case "dungeon":
                return `${mainChar.shortName} est dans le donjon avec ${participantsListLine}.`;
            case "alley":
                return `${mainChar.shortName} rencontre ${participantsListLine} dans une ruelle étroite et cachée.`;
            default:
                return `${mainChar.shortName} rencontre ${participantsListLine} dans ${scene}.`;
        }
    }
};


function buildCharacterItems(char, gameData, isCurrent) {
  const items = [];

  items.push(`id(${char.id})`);
  items.push(`prénom: ${char.firstName}`);
  items.push(`nom complet: ${char.fullName}`);
  items.push(mainPosition(char));

  if (char.heldCourtAndCouncilPositions) {
    items.push(`${char.heldCourtAndCouncilPositions} de ${char.liege || "seigneur inconnu"}`);
  }

  items.push(houseAndStatus(char));
  if (char.primaryTitle !== "None of" || char.primaryTitle !== "None" || char.primaryTitle !== "None von" || char.primaryTitle !== "None de") items.push(`titre principal: ${char.primaryTitle}`);
  if (char.titleRankConcept !== "concept_none") items.push(`rang du titre: ${char.titleRankConcept}`);
  if (char.capitalLocation) items.push(`capitale: ${char.capitalLocation}`);
  if (char.location) items.push(`lieu actuel: ${char.location}`);

  const personalityTraits = (char.traits || []).filter((t) => t.category === "Trait de personnalité");
  if (personalityTraits.length) {
    items.push(
      `traits de personnalité: ${personalityTraits
        .map((t) => `${t.name}${t.desc ? ` (${t.desc})` : ""}`)
        .join(", ")}`
    );
  }

  const otherTraits = (char.traits || []).filter((t) => t.category !== "Trait de personnalité");
  if (otherTraits.length) {
    items.push(
      `autres traits: ${otherTraits
        .map((t) => `${t.name} [${t.category}]${t.desc ? ` (${t.desc})` : ""}`)
        .join(", ")}`
    );
  }

  if (char.sexuality) items.push(`sexualité: ${char.sexuality}`);
  if (char.personality) items.push(`personnalité: ${char.personality}`);
  
  const personalityDesc = personalityDescription(char);
  if (personalityDesc && isCurrent) items.push(personalityDesc);
  
  items.push(`état civil: ${marriage(char)}`);
  items.push(describeProwess(char));
  items.push(goldStatus(char));
  items.push(`âge: ${char.age}`);
  if (char.faith) items.push(`foi: ${char.faith}`);
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
      `trésorerie: ${char.treasury.amount.toFixed(2)} (${char.treasury.tooltip || "sans description"})`
    );
  }

  if (char.income) {
    items.push(
      `revenu: or ${char.income.gold.toFixed(2)}, solde ${char.income.balance.toFixed(2)}`
    );
  }

  if (char.influence) items.push(`influence: ${char.influence.amount} ${char.influence.tooltip || ""}`.trim());
  if (char.herd) items.push(`troupeau: ${char.herd.amount} ${char.herd.breakdown || ""}`.trim());

  if (char.legitimacy) {
    items.push(
      `légitimité: ${char.legitimacy.type}, niveau ${char.legitimacy.level}, valeur ${char.legitimacy.value.toFixed(2)}`
    );
  }

  if (char.troops && char.troops.totalOwnedTroops > 0) items.push(troopsLine(char));

  if (char.laws && char.laws.length) {
    items.push(`lois: ${char.laws.map((l) => l.name).join(", ")}`);
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
      `modificateurs: ${char.modifiers
        .map((m) => `${m.name}${m.description ? ` (${m.description})` : ""}`)
        .join(", ")}`
    );
  }

  if (isCurrent && char.stress) {
    items.push(
      `stress: niveau ${char.stress.level}, valeur ${char.stress.value}, progression ${char.stress.progress}`
    );
  }
  if (!isCurrent && char.stress) {
    items.push(`stress: niveau ${char.stress.level}`);
  }

  const family = familyLine(char);
  if (family) items.push(family);

  return items.filter(Boolean);
}


function mainPosition(char) {
  if (char.isLandedRuler) {
    return char.isIndependentRuler
      ? `Souverain indépendant de ${char.primaryTitle}`
      : `Souverain de ${char.primaryTitle}, vassal de ${char.liege}`;
  }
  if (char.isKnight) {
    return `Chevalier de ${char.liege}`;
  }
  if (char.isRuler) {
    return `Dirigeant de ${char.primaryTitle}`;
  }
  return `Vassal de ${char.liege || "seigneur inconnu"}`;
}

function houseAndStatus(char) {
  let line = char.sheHe === "elle" ? "femme" : "homme";
  line += char.house ? `, de la maison ${char.house}` : ", de basse naissance";
  return line;
}

function marriage(char) {
  if (char.consort) return `${char.fullName} est marié(e) à ${char.consort}`;
  return `${char.fullName} est célibataire`;
}

function describeProwess(char) {
  const p = char.prowess || 0;
  if (p >= 15) return `prouesse: ${p} (guerrier redoutable)`;
  if (p >= 10) return `prouesse: ${p} (combattant compétent)`;
  if (p >= 5) return `prouesse: ${p} (combattant entraîné)`;
  if (p > 0) return `prouesse: ${p} (combattant inexpérimenté)`;
  return `prouesse: ${p} (non-combattant)`;
}

function goldStatus(char) {
  const gold = char.gold || 0;
  if (gold >= 1000) return `riche (or: ${gold})`;
  if (gold > 500) return `aisé (or: ${gold})`;
  if (gold > 100) return `fortune modérée (or: ${gold})`;
  if (gold > 0) return `pauvre (or: ${gold})`;
  if (gold === 0) return "sans or";
  return `endetté (or: ${gold})`;
}

function personalityDescription(char) {
  const traits = [];
  
  if (typeof char.boldness === "number") {
    if (char.boldness >= 70) traits.push("extrêmement courageux");
    else if (char.boldness >= 40) traits.push("courageux");
    else if (char.boldness >= 20) traits.push("quelque peu courageux");
    else if (char.boldness <= -70) traits.push("extrêmement lâche");
    else if (char.boldness <= -40) traits.push("lâche");
    else if (char.boldness <= -20) traits.push("quelque peu lâche");
  }
  
  if (typeof char.compassion === "number") {
    if (char.compassion >= 70) traits.push("extrêmement compatissant");
    else if (char.compassion >= 40) traits.push("compatissant");
    else if (char.compassion >= 20) traits.push("quelque peu compatissant");
    else if (char.compassion <= -70) traits.push("extrêmement impitoyable");
    else if (char.compassion <= -40) traits.push("impitoyable");
    else if (char.compassion <= -20) traits.push("quelque peu impitoyable");
  }
  
  if (typeof char.energy === "number") {
    if (char.energy >= 70) traits.push("extrêmement diligent");
    else if (char.energy >= 40) traits.push("diligent");
    else if (char.energy >= 20) traits.push("quelque peu diligent");
    else if (char.energy <= -70) traits.push("extrêmement paresseux");
    else if (char.energy <= -40) traits.push("paresseux");
    else if (char.energy <= -20) traits.push("quelque peu paresseux");
  }
  
  if (typeof char.greed === "number") {
    if (char.greed >= 70) traits.push("extrêmement avare");
    else if (char.greed >= 40) traits.push("avare");
    else if (char.greed >= 20) traits.push("quelque peu avare");
    else if (char.greed <= -70) traits.push("extrêmement généreux");
    else if (char.greed <= -40) traits.push("généreux");
    else if (char.greed <= -20) traits.push("quelque peu généreux");
  }
  
  if (typeof char.honor === "number") {
    if (char.honor >= 70) traits.push("extrêmement honnête");
    else if (char.honor >= 40) traits.push("honnête");
    else if (char.honor >= 20) traits.push("quelque peu honnête");
    else if (char.honor <= -70) traits.push("extrêmement fourbe");
    else if (char.honor <= -40) traits.push("fourbe");
    else if (char.honor <= -20) traits.push("quelque peu fourbe");
  }
  
  if (typeof char.rationality === "number") {
    if (char.rationality >= 70) traits.push("extrêmement rationnel");
    else if (char.rationality >= 40) traits.push("rationnel");
    else if (char.rationality >= 20) traits.push("quelque peu rationnel");
    else if (char.rationality <= -70) traits.push("extrêmement émotionnel");
    else if (char.rationality <= -40) traits.push("émotionnel");
    else if (char.rationality <= -20) traits.push("quelque peu émotionnel");
  }
  
  if (typeof char.sociability === "number") {
    if (char.sociability >= 70) traits.push("extrêmement sociable");
    else if (char.sociability >= 40) traits.push("sociable");
    else if (char.sociability >= 20) traits.push("quelque peu sociable");
    else if (char.sociability <= -70) traits.push("extrêmement timide");
    else if (char.sociability <= -40) traits.push("introverti");
    else if (char.sociability <= -20) traits.push("quelque peu timide");
  }
  
  if (typeof char.vengefulness === "number") {
    if (char.vengefulness >= 70) traits.push("extrêmement rancunier");
    else if (char.vengefulness >= 40) traits.push("rancunier");
    else if (char.vengefulness >= 20) traits.push("quelque peu rancunier");
    else if (char.vengefulness <= -70) traits.push("extrêmement indulgent");
    else if (char.vengefulness <= -40) traits.push("indulgent");
    else if (char.vengefulness <= -20) traits.push("quelque peu indulgent");
  }
  
  if (typeof char.zeal === "number") {
    if (char.zeal >= 70) traits.push("extrêmement zélé");
    else if (char.zeal >= 40) traits.push("zélé");
    else if (char.zeal >= 20) traits.push("quelque peu zélé");
    else if (char.zeal <= -70) traits.push("extrêmement cynique");
    else if (char.zeal <= -40) traits.push("cynique");
    else if (char.zeal <= -20) traits.push("quelque peu cynique");
  }
  
  if (traits.length === 0) return null;
  return `noyau de personnalité: ${traits.join(", ")}`;
}

function opinionBreakdownLine(char, targetId, gameData) {
  if (!char.opinionBreakdowns || char.opinionBreakdowns.length === 0) return null;
  const targetBreakdown = char.opinionBreakdowns.find((ob) => ob.id === targetId);
  if (!targetBreakdown || !targetBreakdown.breakdown) return null;
  const list = targetBreakdown.breakdown
    .map((m) => `${m.reason}: ${m.value > 0 ? "+" : ""}${m.value}`)
    .join(", ");
  return `analyse de l'opinion sur ${gameData.characters.get(targetId).shortName}: ${list}`;
}

function listRelationsToCharacters(char, gameData) {
  if (!char.relationsToCharacters || char.relationsToCharacters.length === 0) return null;
  const lines = char.relationsToCharacters
    .map((rel) => {
      const targetChar = gameData.characters.get(rel.id);
      if (targetChar) {
        return `${targetChar.shortName} est ${rel.relations.join(", ")}`.replace("votre", `de ${gameData.playerName}`).replace("vous", gameData.playerName);
      }
      return null;
    })
    .filter(Boolean);
  return lines.length > 0 ? `relations des personnages avec ${char.fullName}: ${lines.join("; ")}` : null;
}

function secretsLine(char) {
  if (!char.secrets || char.secrets.length === 0) return null;
  const list = char.secrets
    .map((s) => `${s.name} (${s.category}${s.isCriminal ? ", criminel" : ""}${s.isShunned ? ", honteux" : ""})`)
    .join(", ");
  return `secrets de ce personnage: ${list}`;
}

function knownSecretsLine(char) {
  if (!char.knownSecrets || char.knownSecrets.length === 0) return null;
  const list = char.knownSecrets
    .map(
      (s) =>
        `${s.name} de ${s.ownerName} (${s.category}${s.isCriminal ? ", criminel" : ""}${
          s.isShunned ? ", honteux" : ""
        })`
    )
    .join(", ");
  return `secrets connus: ${list}`;
}

function troopsLine(char) {
  if (!char.troops) return null;
  const total = char.troops.totalOwnedTroops || 0;
  const regiments = (char.troops.maaRegiments || [])
    .filter((r) => r.isPersonal)
    .map((r) => `${r.name}:${r.menAlive}`)
    .join(", ");
  return `troupes: total ${total}, MAA personnels: ${regiments}`;
}

function familyLine(char) {
  const parts = [];
  if (char.parents && char.parents.length > 0) {
    const parentsList = char.parents
      .map((p) => `${p.name}${p.deathDate ? ` (décédé ${p.deathDate}${p.deathReason ? `: ${p.deathReason}` : ""})` : ""}`)
      .join(", ");
    parts.push(`parents de ${char.fullName}: ${parentsList}`);
  }
  if (char.siblings && char.siblings.length > 0) {
    const siblingsList = char.siblings
      .map((s) => {
        const status = [s.sheHe === "il" ? "frère" : "sœur", s.maritalStatus || "célibataire"]
          .filter(Boolean)
          .join(", ");
        const death = s.deathDate ? `, décédé ${s.deathDate}${s.deathReason ? ` (${s.deathReason})` : ""}` : "";
        const traits = (s.traits || []).map((t) => t.name).join(", ");
        return `${s.name} (${status}${death}${traits ? `, traits: ${traits}` : ""})\n`;
      })
      .join(", ");
    parts.push(`frères et sœurs de ${char.fullName}: ${siblingsList}`);
  }
  if (char.children && char.children.length > 0) {
    const childrenList = char.children
      .map((c) => {
        const status = [c.sheHe === "il" ? "fils" : "fille", c.maritalStatus || "célibataire"]
          .filter(Boolean)
          .join(", ");
        const death = c.deathDate ? `, décédé ${c.deathDate}${c.deathReason ? ` (${c.deathReason})` : ""}` : "";
        const traits = (c.traits || []).map((t) => t.name).join(", ");
        return `${c.name} (${status}${death}${traits ? `, traits: ${traits}` : ""})\n`;
      })
      .join(", ");
    parts.push(`enfants de ${char.fullName}: ${childrenList}`);
  }
  return parts.length ? parts.join("; ") : null;
}

function getOpinionDescription(score) {
    if (score > 60) return "dévoué envers";
    if (score > 20) return "amical envers";
    if (score > -20) return "neutre envers";
    if (score > -60) return "méprisant envers";
    return "haineux envers";
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
                return `${char.shortName} est ${desc} ${targetCharacter.shortName}`;
            }
            return null;
        })
        .filter(Boolean);
        
    return lines.length > 0 ? `opinions[${lines.join(' | ')}]` : null;
}
