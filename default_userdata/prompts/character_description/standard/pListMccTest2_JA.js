// Detailed persona builder supporting multiple characters in conversation.
// Japanese localization
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
    output += `[${current.shortName}のキャラクター情報: ${buildCharacterItems(current, gameData, true).join("; \n")}]\n`;
    
    gameData.characters.forEach((char) => {
        if (char.id !== current.id) {
            output += `[${char.shortName}のキャラクター情報: ${buildCharacterItems(char, gameData, false).join("; \n")}]\n`;
        }
    });

    const scenarioLine = `[日付(${date}), 場所(${location}), シナリオ(${scenario()})]`;

    output += scenarioLine;
    return output;

    function scenario() {
      let participantsListLine = ""
      gameData.characters.forEach((char) => {
        if (char.id !== current.id)
        participantsListLine += `${char.shortName}、`
      })
      participantsListLine = participantsListLine.slice(0, -1);
        switch (scene) {
            case "throne_room":
                return `${mainChar.shortName}は${locationController}の玉座の間で${participantsListLine}と一緒にいます。`;
            case "garden":
                return `${mainChar.shortName}は${locationController}の城の庭で${participantsListLine}と出会います。`;
            case "bedchamber":
                return `${mainChar.shortName}は私室で${participantsListLine}と一緒にいます。`;
            case "feast":
                return `${mainChar.shortName}は${locationController}が主催する宴会で${participantsListLine}と話しています。`;
            case "army_camp":
                return `${mainChar.shortName}は軍営で${participantsListLine}と一緒にいます。`;
            case "hunt":
                return `${mainChar.shortName}は霧の立ち込める森で${participantsListLine}と狩りをしています。`;
            case "dungeon":
                return `${mainChar.shortName}は地下牢で${participantsListLine}と一緒にいます。`;
            case "alley":
                return `${mainChar.shortName}は狭く隠れた路地で${participantsListLine}と出会います。`;
            default:
                return `${mainChar.shortName}は${scene}で${participantsListLine}と出会います。`;
        }
    }
};


function buildCharacterItems(char, gameData, isCurrent) {
  const items = [];

  items.push(`id(${char.id})`);
  items.push(`名前: ${char.firstName}`);
  items.push(`完全な名前: ${char.fullName}`);
  items.push(mainPosition(char));

  if (char.heldCourtAndCouncilPositions) {
    items.push(`${char.liege || "不明な領主"}の${char.heldCourtAndCouncilPositions}`);
  }

  items.push(houseAndStatus(char));
  if (char.primaryTitle !== "None of" || char.primaryTitle !== "None" || char.primaryTitle !== "None von" || char.primaryTitle !== "None de") items.push(`主要な称号: ${char.primaryTitle}`);
  if (char.titleRankConcept !== "concept_none") items.push(`称号の階級: ${char.titleRankConcept}`);
  if (char.capitalLocation) items.push(`首都: ${char.capitalLocation}`);
  if (char.location) items.push(`現在の場所: ${char.location}`);

  const personalityTraits = (char.traits || []).filter((t) => t.category === "性格特性");
  if (personalityTraits.length) {
    items.push(
      `性格特性: ${personalityTraits
        .map((t) => `${t.name}${t.desc ? ` (${t.desc})` : ""}`)
        .join("、")}`
    );
  }

  const otherTraits = (char.traits || []).filter((t) => t.category !== "性格特性");
  if (otherTraits.length) {
    items.push(
      `その他の特性: ${otherTraits
        .map((t) => `${t.name} [${t.category}]${t.desc ? ` (${t.desc})` : ""}`)
        .join("、")}`
    );
  }

  if (char.sexuality) items.push(`性的指向: ${char.sexuality}`);
  if (char.personality) items.push(`性格: ${char.personality}`);
  
  const personalityDesc = personalityDescription(char);
  if (personalityDesc && isCurrent) items.push(personalityDesc);
  
  items.push(`婚姻状況: ${marriage(char)}`);
  items.push(describeProwess(char));
  items.push(goldStatus(char));
  items.push(`年齢: ${char.age}`);
  if (char.faith) items.push(`信仰: ${char.faith}`);
  if (char.culture) items.push(`文化: ${char.culture}`);

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
      `国庫: ${char.treasury.amount.toFixed(2)} (${char.treasury.tooltip || "説明なし"})`
    );
  }

  if (char.income) {
    items.push(
      `収入: 金貨 ${char.income.gold.toFixed(2)}, 収支 ${char.income.balance.toFixed(2)}`
    );
  }

  if (char.influence) items.push(`影響力: ${char.influence.amount} ${char.influence.tooltip || ""}`.trim());
  if (char.herd) items.push(`家畜: ${char.herd.amount} ${char.herd.breakdown || ""}`.trim());

  if (char.legitimacy) {
    items.push(
      `正統性: ${char.legitimacy.type}, レベル ${char.legitimacy.level}, 値 ${char.legitimacy.value.toFixed(2)}`
    );
  }

  if (char.troops && char.troops.totalOwnedTroops > 0) items.push(troopsLine(char));

  if (char.laws && char.laws.length) {
    items.push(`法律: ${char.laws.map((l) => l.name).join("、")}`);
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
      `修正: ${char.modifiers
        .map((m) => `${m.name}${m.description ? ` (${m.description})` : ""}`)
        .join("、")}`
    );
  }

  if (isCurrent && char.stress) {
    items.push(
      `ストレス: レベル ${char.stress.level}, 値 ${char.stress.value}, 進行度 ${char.stress.progress}`
    );
  }
  if (!isCurrent && char.stress) {
    items.push(`ストレス: レベル ${char.stress.level}`);
  }

  const family = familyLine(char);
  if (family) items.push(family);

  return items.filter(Boolean);
}


function mainPosition(char) {
  if (char.isLandedRuler) {
    return char.isIndependentRuler
      ? `${char.primaryTitle}の独立した支配者`
      : `${char.primaryTitle}の支配者、${char.liege}の家臣`;
  }
  if (char.isKnight) {
    return `${char.liege}の騎士`;
  }
  if (char.isRuler) {
    return `${char.primaryTitle}の指導者`;
  }
  return `${char.liege || "不明な領主"}の家来`;
}

function houseAndStatus(char) {
  let line = char.sheHe === "彼女" ? "女性" : "男性";
  line += char.house ? `、${char.house}家` : "、平民";
  return line;
}

function marriage(char) {
  if (char.consort) return `${char.fullName}は${char.consort}と結婚`;
  return `${char.fullName}は未婚`;
}

function describeProwess(char) {
  const p = char.prowess || 0;
  if (p >= 15) return `武勇: ${p} (恐るべき戦士)`;
  if (p >= 10) return `武勇: ${p} (熟練した戦士)`;
  if (p >= 5) return `武勇: ${p} (訓練された戦士)`;
  if (p > 0) return `武勇: ${p} (未熟な戦士)`;
  return `武勇: ${p} (非戦闘員)`;
}

function goldStatus(char) {
  const gold = char.gold || 0;
  if (gold >= 1000) return `富裕 (金貨: ${gold})`;
  if (gold > 500) return `裕福 (金貨: ${gold})`;
  if (gold > 100) return `普通の富 (金貨: ${gold})`;
  if (gold > 0) return `貧しい (金貨: ${gold})`;
  if (gold === 0) return "金貨なし";
  return `借金 (金貨: ${gold})`;
}

function personalityDescription(char) {
  const traits = [];
  
  if (typeof char.boldness === "number") {
    if (char.boldness >= 70) traits.push("極めて勇敢");
    else if (char.boldness >= 40) traits.push("勇敢");
    else if (char.boldness >= 20) traits.push("やや勇敢");
    else if (char.boldness <= -70) traits.push("極めて臆病");
    else if (char.boldness <= -40) traits.push("臆病");
    else if (char.boldness <= -20) traits.push("やや臆病");
  }
  
  if (typeof char.compassion === "number") {
    if (char.compassion >= 70) traits.push("極めて慈悲深い");
    else if (char.compassion >= 40) traits.push("慈悲深い");
    else if (char.compassion >= 20) traits.push("やや慈悲深い");
    else if (char.compassion <= -70) traits.push("極めて冷酷");
    else if (char.compassion <= -40) traits.push("冷酷");
    else if (char.compassion <= -20) traits.push("やや冷酷");
  }
  
  if (typeof char.energy === "number") {
    if (char.energy >= 70) traits.push("極めて勤勉");
    else if (char.energy >= 40) traits.push("勤勉");
    else if (char.energy >= 20) traits.push("やや勤勉");
    else if (char.energy <= -70) traits.push("極めて怠惰");
    else if (char.energy <= -40) traits.push("怠惰");
    else if (char.energy <= -20) traits.push("やや怠惰");
  }
  
  if (typeof char.greed === "number") {
    if (char.greed >= 70) traits.push("極めて貪欲");
    else if (char.greed >= 40) traits.push("貪欲");
    else if (char.greed >= 20) traits.push("やや貪欲");
    else if (char.greed <= -70) traits.push("極めて寛大");
    else if (char.greed <= -40) traits.push("寛大");
    else if (char.greed <= -20) traits.push("やや寛大");
  }
  
  if (typeof char.honor === "number") {
    if (char.honor >= 70) traits.push("極めて誠実");
    else if (char.honor >= 40) traits.push("誠実");
    else if (char.honor >= 20) traits.push("やや誠実");
    else if (char.honor <= -70) traits.push("極めて狡猾");
    else if (char.honor <= -40) traits.push("狡猾");
    else if (char.honor <= -20) traits.push("やや狡猾");
  }
  
  if (typeof char.rationality === "number") {
    if (char.rationality >= 70) traits.push("極めて理性的");
    else if (char.rationality >= 40) traits.push("理性的");
    else if (char.rationality >= 20) traits.push("やや理性的");
    else if (char.rationality <= -70) traits.push("極めて感情的");
    else if (char.rationality <= -40) traits.push("感情的");
    else if (char.rationality <= -20) traits.push("やや感情的");
  }
  
  if (typeof char.sociability === "number") {
    if (char.sociability >= 70) traits.push("極めて社交的");
    else if (char.sociability >= 40) traits.push("社交的");
    else if (char.sociability >= 20) traits.push("やや社交的");
    else if (char.sociability <= -70) traits.push("極めて内気");
    else if (char.sociability <= -40) traits.push("内気");
    else if (char.sociability <= -20) traits.push("やや内気");
  }
  
  if (typeof char.vengefulness === "number") {
    if (char.vengefulness >= 70) traits.push("極めて執念深い");
    else if (char.vengefulness >= 40) traits.push("執念深い");
    else if (char.vengefulness >= 20) traits.push("やや執念深い");
    else if (char.vengefulness <= -70) traits.push("極めて寛容");
    else if (char.vengefulness <= -40) traits.push("寛容");
    else if (char.vengefulness <= -20) traits.push("やや寛容");
  }
  
  if (typeof char.zeal === "number") {
    if (char.zeal >= 70) traits.push("極めて熱心");
    else if (char.zeal >= 40) traits.push("熱心");
    else if (char.zeal >= 20) traits.push("やや熱心");
    else if (char.zeal <= -70) traits.push("極めて冷笑的");
    else if (char.zeal <= -40) traits.push("冷笑的");
    else if (char.zeal <= -20) traits.push("やや冷笑的");
  }
  
  if (traits.length === 0) return null;
  return `性格の中核: ${traits.join("、")}`;
}

function opinionBreakdownLine(char, targetId, gameData) {
  if (!char.opinionBreakdowns || char.opinionBreakdowns.length === 0) return null;
  const targetBreakdown = char.opinionBreakdowns.find((ob) => ob.id === targetId);
  if (!targetBreakdown || !targetBreakdown.breakdown) return null;
  const list = targetBreakdown.breakdown
    .map((m) => `${m.reason}: ${m.value > 0 ? "+" : ""}${m.value}`)
    .join("、");
  return `${gameData.characters.get(targetId).shortName}への評価の内訳: ${list}`;
}

function listRelationsToCharacters(char, gameData) {
  if (!char.relationsToCharacters || char.relationsToCharacters.length === 0) return null;
  const lines = char.relationsToCharacters
    .map((rel) => {
      const targetChar = gameData.characters.get(rel.id);
      if (targetChar) {
        return `${targetChar.shortName}は${rel.relations.join("、")}`.replace("あなたの", gameData.playerName + "の").replace("あなた", gameData.playerName);
      }
      return null;
    })
    .filter(Boolean);
  return lines.length > 0 ? `${char.fullName}へのキャラクター関係: ${lines.join("; ")}` : null;
}

function secretsLine(char) {
  if (!char.secrets || char.secrets.length === 0) return null;
  const list = char.secrets
    .map((s) => `${s.name} (${s.category}${s.isCriminal ? "、犯罪" : ""}${s.isShunned ? "、忌避される" : ""})`)
    .join("、");
  return `このキャラクターの秘密: ${list}`;
}

function knownSecretsLine(char) {
  if (!char.knownSecrets || char.knownSecrets.length === 0) return null;
  const list = char.knownSecrets
    .map(
      (s) =>
        `${s.ownerName}の${s.name} (${s.category}${s.isCriminal ? "、犯罪" : ""}${
          s.isShunned ? "、忌避される" : ""
        })`
    )
    .join("、");
  return `知られている秘密: ${list}`;
}

function troopsLine(char) {
  if (!char.troops) return null;
  const total = char.troops.totalOwnedTroops || 0;
  const regiments = (char.troops.maaRegiments || [])
    .filter((r) => r.isPersonal)
    .map((r) => `${r.name}:${r.menAlive}`)
    .join("、");
  return `軍勢: 合計 ${total}, 私兵: ${regiments}`;
}

function familyLine(char) {
  const parts = [];
  if (char.parents && char.parents.length > 0) {
    const parentsList = char.parents
      .map((p) => `${p.name}${p.deathDate ? ` (${p.deathDate}に死亡${p.deathReason ? `: ${p.deathReason}` : ""})` : ""}`)
      .join("、");
    parts.push(`${char.fullName}の両親: ${parentsList}`);
  }
  if (char.siblings && char.siblings.length > 0) {
    const siblingsList = char.siblings
      .map((s) => {
        const status = [s.sheHe === "彼" ? "兄弟" : "姉妹", s.maritalStatus || "未婚"]
          .filter(Boolean)
          .join("、");
        const death = s.deathDate ? `、${s.deathDate}に死亡${s.deathReason ? ` (${s.deathReason})` : ""}` : "";
        const traits = (s.traits || []).map((t) => t.name).join("、");
        return `${s.name} (${status}${death}${traits ? `、特性: ${traits}` : ""})\n`;
      })
      .join("、");
    parts.push(`${char.fullName}の兄弟姉妹: ${siblingsList}`);
  }
  if (char.children && char.children.length > 0) {
    const childrenList = char.children
      .map((c) => {
        const status = [c.sheHe === "彼" ? "息子" : "娘", c.maritalStatus || "未婚"]
          .filter(Boolean)
          .join("、");
        const death = c.deathDate ? `、${c.deathDate}に死亡${c.deathReason ? ` (${c.deathReason})` : ""}` : "";
        const traits = (c.traits || []).map((t) => t.name).join("、");
        return `${c.name} (${status}${death}${traits ? `、特性: ${traits}` : ""})\n`;
      })
      .join("、");
    parts.push(`${char.fullName}の子供: ${childrenList}`);
  }
  return parts.length ? parts.join("; ") : null;
}

function getOpinionDescription(score) {
    if (score > 60) return "献身的";
    if (score > 20) return "友好的";
    if (score > -20) return "中立的";
    if (score > -60) return "軽蔑的";
    return "憎悪";
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
                return `${char.shortName}は${targetCharacter.shortName}に${desc}`;
            }
            return null;
        })
        .filter(Boolean);
        
    return lines.length > 0 ? `意見[${lines.join(' | ')}]` : null;
}
