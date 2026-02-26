// Detailed persona builder supporting multiple characters in conversation.
// Spanish localization
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
    output += `[Información del personaje de ${current.shortName}: ${buildCharacterItems(current, gameData, true).join("; \n")}]\n`;
    
    gameData.characters.forEach((char) => {
        if (char.id !== current.id) {
            output += `[Información del personaje de ${char.shortName}: ${buildCharacterItems(char, gameData, false).join("; \n")}]\n`;
        }
    });

    const scenarioLine = `[fecha(${date}), ubicación(${location}), escenario(${scenario()})]`;

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
                return `${mainChar.shortName} está en el salón del trono de ${locationController} con ${participantsListLine}.`;
            case "garden":
                return `${mainChar.shortName} se encuentra con ${participantsListLine} en el jardín del castillo de ${locationController}.`;
            case "bedchamber":
                return `${mainChar.shortName} está en la cámara privada con ${participantsListLine}.`;
            case "feast":
                return `${mainChar.shortName} habla con ${participantsListLine} durante un banquete organizado por ${locationController}.`;
            case "army_camp":
                return `${mainChar.shortName} está en el campamento militar con ${participantsListLine}.`;
            case "hunt":
                return `${mainChar.shortName} está cazando con ${participantsListLine} en un bosque brumoso.`;
            case "dungeon":
                return `${mainChar.shortName} está en la mazmorra con ${participantsListLine}.`;
            case "alley":
                return `${mainChar.shortName} se encuentra con ${participantsListLine} en un callejón estrecho y oculto.`;
            default:
                return `${mainChar.shortName} se encuentra con ${participantsListLine} en ${scene}.`;
        }
    }
};


function buildCharacterItems(char, gameData, isCurrent) {
  const items = [];

  items.push(`id(${char.id})`);
  items.push(`nombre: ${char.firstName}`);
  items.push(`nombre completo: ${char.fullName}`);
  items.push(mainPosition(char));

  if (char.heldCourtAndCouncilPositions) {
    items.push(`${char.heldCourtAndCouncilPositions} de ${char.liege || "señor desconocido"}`);
  }

  items.push(houseAndStatus(char));
  if (char.primaryTitle !== "None of" || char.primaryTitle !== "None" || char.primaryTitle !== "None von" || char.primaryTitle !== "None de") items.push(`título principal: ${char.primaryTitle}`);
  if (char.titleRankConcept !== "concept_none") items.push(`rango del título: ${char.titleRankConcept}`);
  if (char.capitalLocation) items.push(`capital: ${char.capitalLocation}`);
  if (char.location) items.push(`ubicación actual: ${char.location}`);

  const personalityTraits = (char.traits || []).filter((t) => t.category === "Rasgo de personalidad");
  if (personalityTraits.length) {
    items.push(
      `rasgos de personalidad: ${personalityTraits
        .map((t) => `${t.name}${t.desc ? ` (${t.desc})` : ""}`)
        .join(", ")}`
    );
  }

  const otherTraits = (char.traits || []).filter((t) => t.category !== "Rasgo de personalidad");
  if (otherTraits.length) {
    items.push(
      `otros rasgos: ${otherTraits
        .map((t) => `${t.name} [${t.category}]${t.desc ? ` (${t.desc})` : ""}`)
        .join(", ")}`
    );
  }

  if (char.sexuality) items.push(`sexualidad: ${char.sexuality}`);
  if (char.personality) items.push(`personalidad: ${char.personality}`);
  
  const personalityDesc = personalityDescription(char);
  if (personalityDesc && isCurrent) items.push(personalityDesc);
  
  items.push(`estado civil: ${marriage(char)}`);
  items.push(describeProwess(char));
  items.push(goldStatus(char));
  items.push(`edad: ${char.age}`);
  if (char.faith) items.push(`fe: ${char.faith}`);
  if (char.culture) items.push(`cultura: ${char.culture}`);

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
      `tesoro: ${char.treasury.amount.toFixed(2)} (${char.treasury.tooltip || "sin descripción"})`
    );
  }

  if (char.income) {
    items.push(
      `ingresos: oro ${char.income.gold.toFixed(2)}, balance ${char.income.balance.toFixed(2)}`
    );
  }

  if (char.influence) items.push(`influencia: ${char.influence.amount} ${char.influence.tooltip || ""}`.trim());
  if (char.herd) items.push(`rebaño: ${char.herd.amount} ${char.herd.breakdown || ""}`.trim());

  if (char.legitimacy) {
    items.push(
      `legitimidad: ${char.legitimacy.type}, nivel ${char.legitimacy.level}, valor ${char.legitimacy.value.toFixed(2)}`
    );
  }

  if (char.troops && char.troops.totalOwnedTroops > 0) items.push(troopsLine(char));

  if (char.laws && char.laws.length) {
    items.push(`leyes: ${char.laws.map((l) => l.name).join(", ")}`);
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
      `modificadores: ${char.modifiers
        .map((m) => `${m.name}${m.description ? ` (${m.description})` : ""}`)
        .join(", ")}`
    );
  }

  if (isCurrent && char.stress) {
    items.push(
      `estrés: nivel ${char.stress.level}, valor ${char.stress.value}, progreso ${char.stress.progress}`
    );
  }
  if (!isCurrent && char.stress) {
    items.push(`estrés: nivel ${char.stress.level}`);
  }

  const family = familyLine(char);
  if (family) items.push(family);

  return items.filter(Boolean);
}


function mainPosition(char) {
  if (char.isLandedRuler) {
    return char.isIndependentRuler
      ? `Gobernante independiente de ${char.primaryTitle}`
      : `Gobernante de ${char.primaryTitle}, vasallo de ${char.liege}`;
  }
  if (char.isKnight) {
    return `Caballero de ${char.liege}`;
  }
  if (char.isRuler) {
    return `Líder de ${char.primaryTitle}`;
  }
  return `Seguidor de ${char.liege || "señor desconocido"}`;
}

function houseAndStatus(char) {
  let line = char.sheHe === "ella" ? "mujer" : "hombre";
  line += char.house ? `, de la casa ${char.house}` : ", de origen humilde";
  return line;
}

function marriage(char) {
  if (char.consort) return `${char.fullName} está casado con ${char.consort}`;
  return `${char.fullName} está soltero`;
}

function describeProwess(char) {
  const p = char.prowess || 0;
  if (p >= 15) return `destreza: ${p} (guerrero formidable)`;
  if (p >= 10) return `destreza: ${p} (combatiente hábil)`;
  if (p >= 5) return `destreza: ${p} (luchador entrenado)`;
  if (p > 0) return `destreza: ${p} (luchador inexperto)`;
  return `destreza: ${p} (no combatiente)`;
}

function goldStatus(char) {
  const gold = char.gold || 0;
  if (gold >= 1000) return `rico (oro: ${gold})`;
  if (gold > 500) return `acomodado (oro: ${gold})`;
  if (gold > 100) return `riqueza moderada (oro: ${gold})`;
  if (gold > 0) return `pobre (oro: ${gold})`;
  if (gold === 0) return "sin oro";
  return `endeudado (oro: ${gold})`;
}

function personalityDescription(char) {
  const traits = [];
  
  if (typeof char.boldness === "number") {
    if (char.boldness >= 70) traits.push("excepcionalmente valiente");
    else if (char.boldness >= 40) traits.push("valiente");
    else if (char.boldness >= 20) traits.push("algo valiente");
    else if (char.boldness <= -70) traits.push("extremadamente pusilánime");
    else if (char.boldness <= -40) traits.push("cobarde");
    else if (char.boldness <= -20) traits.push("algo tímido");
  }
  
  if (typeof char.compassion === "number") {
    if (char.compassion >= 70) traits.push("excepcionalmente compasivo");
    else if (char.compassion >= 40) traits.push("compasivo");
    else if (char.compassion >= 20) traits.push("algo compasivo");
    else if (char.compassion <= -70) traits.push("extremadamente insensible");
    else if (char.compassion <= -40) traits.push("cruel");
    else if (char.compassion <= -20) traits.push("algo insensible");
  }
  
  if (typeof char.energy === "number") {
    if (char.energy >= 70) traits.push("excepcionalmente diligente");
    else if (char.energy >= 40) traits.push("diligente");
    else if (char.energy >= 20) traits.push("algo diligente");
    else if (char.energy <= -70) traits.push("extremadamente vago");
    else if (char.energy <= -40) traits.push("vago");
    else if (char.energy <= -20) traits.push("algo vago");
  }
  
  if (typeof char.greed === "number") {
    if (char.greed >= 70) traits.push("excepcionalmente codicioso");
    else if (char.greed >= 40) traits.push("codicioso");
    else if (char.greed >= 20) traits.push("algo codicioso");
    else if (char.greed <= -70) traits.push("excepcionalmente generoso");
    else if (char.greed <= -40) traits.push("generoso");
    else if (char.greed <= -20) traits.push("algo generoso");
  }
  
  if (typeof char.honor === "number") {
    if (char.honor >= 70) traits.push("excepcionalmente honesto");
    else if (char.honor >= 40) traits.push("honesto");
    else if (char.honor >= 20) traits.push("algo honesto");
    else if (char.honor <= -70) traits.push("extremadamente falso");
    else if (char.honor <= -40) traits.push("falso");
    else if (char.honor <= -20) traits.push("algo falso");
  }
  
  if (typeof char.rationality === "number") {
    if (char.rationality >= 70) traits.push("excepcionalmente racional");
    else if (char.rationality >= 40) traits.push("racional");
    else if (char.rationality >= 20) traits.push("algo racional");
    else if (char.rationality <= -70) traits.push("extremadamente emocional");
    else if (char.rationality <= -40) traits.push("emocional");
    else if (char.rationality <= -20) traits.push("algo emocional");
  }
  
  if (typeof char.sociability === "number") {
    if (char.sociability >= 70) traits.push("excepcionalmente gregario");
    else if (char.sociability >= 40) traits.push("gregario");
    else if (char.sociability >= 20) traits.push("algo gregario");
    else if (char.sociability <= -70) traits.push("extremadamente tímido");
    else if (char.sociability <= -40) traits.push("introvertido");
    else if (char.sociability <= -20) traits.push("algo tímido");
  }
  
  if (typeof char.vengefulness === "number") {
    if (char.vengefulness >= 70) traits.push("excepcionalmente revanchista");
    else if (char.vengefulness >= 40) traits.push("revanchista");
    else if (char.vengefulness >= 20) traits.push("algo revanchista");
    else if (char.vengefulness <= -70) traits.push("excepcionalmente indulgente");
    else if (char.vengefulness <= -40) traits.push("indulgente");
    else if (char.vengefulness <= -20) traits.push("algo indulgente");
  }
  
  if (typeof char.zeal === "number") {
    if (char.zeal >= 70) traits.push("excepcionalmente ferviente");
    else if (char.zeal >= 40) traits.push("ferviente");
    else if (char.zeal >= 20) traits.push("algo ferviente");
    else if (char.zeal <= -70) traits.push("extremadamente cínico");
    else if (char.zeal <= -40) traits.push("cínico");
    else if (char.zeal <= -20) traits.push("algo cínico");
  }
  
  if (traits.length === 0) return null;
  return `núcleo de personalidad: ${traits.join(", ")}`;
}

function opinionBreakdownLine(char, targetId, gameData) {
  if (!char.opinionBreakdowns || char.opinionBreakdowns.length === 0) return null;
  const targetBreakdown = char.opinionBreakdowns.find((ob) => ob.id === targetId);
  if (!targetBreakdown || !targetBreakdown.breakdown) return null;
  const list = targetBreakdown.breakdown
    .map((m) => `${m.reason}: ${m.value > 0 ? "+" : ""}${m.value}`)
    .join(", ");
  return `desglose de opinión sobre ${gameData.characters.get(targetId).shortName}: ${list}`;
}

function listRelationsToCharacters(char, gameData) {
  if (!char.relationsToCharacters || char.relationsToCharacters.length === 0) return null;
  const lines = char.relationsToCharacters
    .map((rel) => {
      const targetChar = gameData.characters.get(rel.id);
      if (targetChar) {
        return `${targetChar.shortName} es ${rel.relations.join(", ")}`.replace("tu", `de ${gameData.playerName}`).replace("ti", gameData.playerName);
      }
      return null;
    })
    .filter(Boolean);
  return lines.length > 0 ? `relaciones de personajes con ${char.fullName}: ${lines.join("; ")}` : null;
}

function secretsLine(char) {
  if (!char.secrets || char.secrets.length === 0) return null;
  const list = char.secrets
    .map((s) => `${s.name} (${s.category}${s.isCriminal ? ", criminal" : ""}${s.isShunned ? ", vergonzoso" : ""})`)
    .join(", ");
  return `secretos de este personaje: ${list}`;
}

function knownSecretsLine(char) {
  if (!char.knownSecrets || char.knownSecrets.length === 0) return null;
  const list = char.knownSecrets
    .map(
      (s) =>
        `${s.name} de ${s.ownerName} (${s.category}${s.isCriminal ? ", criminal" : ""}${
          s.isShunned ? ", vergonzoso" : ""
        })`
    )
    .join(", ");
  return `secretos conocidos: ${list}`;
}

function troopsLine(char) {
  if (!char.troops) return null;
  const total = char.troops.totalOwnedTroops || 0;
  const regiments = (char.troops.maaRegiments || [])
    .filter((r) => r.isPersonal)
    .map((r) => `${r.name}:${r.menAlive}`)
    .join(", ");
  return `tropas: total ${total}, MAA personales: ${regiments}`;
}

function familyLine(char) {
  const parts = [];
  if (char.parents && char.parents.length > 0) {
    const parentsList = char.parents
      .map((p) => `${p.name}${p.deathDate ? ` (murió ${p.deathDate}${p.deathReason ? `: ${p.deathReason}` : ""})` : ""}`)
      .join(", ");
    parts.push(`padres de ${char.fullName}: ${parentsList}`);
  }
  if (char.siblings && char.siblings.length > 0) {
    const siblingsList = char.siblings
      .map((s) => {
        const status = [s.sheHe === "él" ? "hermano" : "hermana", s.maritalStatus || "soltero"]
          .filter(Boolean)
          .join(", ");
        const death = s.deathDate ? `, murió ${s.deathDate}${s.deathReason ? ` (${s.deathReason})` : ""}` : "";
        const traits = (s.traits || []).map((t) => t.name).join(", ");
        return `${s.name} (${status}${death}${traits ? `, rasgos: ${traits}` : ""})\n`;
      })
      .join(", ");
    parts.push(`hermanos de ${char.fullName}: ${siblingsList}`);
  }
  if (char.children && char.children.length > 0) {
    const childrenList = char.children
      .map((c) => {
        const status = [c.sheHe === "él" ? "hijo" : "hija", c.maritalStatus || "soltero"]
          .filter(Boolean)
          .join(", ");
        const death = c.deathDate ? `, murió ${c.deathDate}${c.deathReason ? ` (${c.deathReason})` : ""}` : "";
        const traits = (c.traits || []).map((t) => t.name).join(", ");
        return `${c.name} (${status}${death}${traits ? `, rasgos: ${traits}` : ""})\n`;
      })
      .join(", ");
    parts.push(`hijos de ${char.fullName}: ${childrenList}`);
  }
  return parts.length ? parts.join("; ") : null;
}

function getOpinionDescription(score) {
    if (score > 60) return "devoto de";
    if (score > 20) return "amistoso con";
    if (score > -20) return "neutral hacia";
    if (score > -60) return "desprecio hacia";
    return "odio hacia";
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
                return `${char.shortName} parece ${desc} ${targetCharacter.shortName}`;
            }
            return null;
        })
        .filter(Boolean);
        
    return lines.length > 0 ? `opiniones[${lines.join(' | ')}]` : null;
}
