// Detailed persona builder supporting multiple characters in conversation.
// Chinese localization
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
    output += `[${current.shortName}的角色信息：${buildCharacterItems(current, gameData, true).join("; \n")}]\n`;
    
    gameData.characters.forEach((char) => {
        if (char.id !== current.id) {
            output += `[${char.shortName}的角色信息：${buildCharacterItems(char, gameData, false).join("; \n")}]\n`;
        }
    });

    const scenarioLine = `[日期(${date}), 地点(${location}), 场景(${scenario()})]`;

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
                return `${mainChar.shortName}在${locationController}的王座大厅与${participantsListLine}在一起。`;
            case "garden":
                return `${mainChar.shortName}在${locationController}的城堡花园遇见${participantsListLine}。`;
            case "bedchamber":
                return `${mainChar.shortName}在私人卧室与${participantsListLine}在一起。`;
            case "feast":
                return `${mainChar.shortName}在${locationController}举办的宴会上与${participantsListLine}交谈。`;
            case "army_camp":
                return `${mainChar.shortName}在军营与${participantsListLine}在一起。`;
            case "hunt":
                return `${mainChar.shortName}在雾蒙蒙的森林中与${participantsListLine}一起狩猎。`;
            case "dungeon":
                return `${mainChar.shortName}在地牢与${participantsListLine}在一起。`;
            case "alley":
                return `${mainChar.shortName}在狭窄隐蔽的小巷遇见${participantsListLine}。`;
            default:
                return `${mainChar.shortName}在${scene}遇见${participantsListLine}。`;
        }
    }
};


function buildCharacterItems(char, gameData, isCurrent) {
  const items = [];

  items.push(`id(${char.id})`);
  items.push(`名字：${char.firstName}`);
  items.push(`全名：${char.fullName}`);
  items.push(mainPosition(char));

  if (char.heldCourtAndCouncilPositions) {
    items.push(`${char.liege || "未知领主"}的${char.heldCourtAndCouncilPositions}`);
  }

  items.push(houseAndStatus(char));
  if (char.primaryTitle !== "None of" || char.primaryTitle !== "None" || char.primaryTitle !== "None von" || char.primaryTitle !== "None de") items.push(`主要头衔：${char.primaryTitle}`);
  if (char.titleRankConcept !== "concept_none") items.push(`头衔等级：${char.titleRankConcept}`);
  if (char.capitalLocation) items.push(`首都：${char.capitalLocation}`);
  if (char.location) items.push(`当前位置：${char.location}`);

  const personalityTraits = (char.traits || []).filter((t) => t.category === "性格特质");
  if (personalityTraits.length) {
    items.push(
      `性格特质：${personalityTraits
        .map((t) => `${t.name}${t.desc ? ` (${t.desc})` : ""}`)
        .join("、")}`
    );
  }

  const otherTraits = (char.traits || []).filter((t) => t.category !== "性格特质");
  if (otherTraits.length) {
    items.push(
      `其他特质：${otherTraits
        .map((t) => `${t.name} [${t.category}]${t.desc ? ` (${t.desc})` : ""}`)
        .join("、")}`
    );
  }

  if (char.sexuality) items.push(`性取向：${char.sexuality}`);
  if (char.personality) items.push(`性格：${char.personality}`);
  
  const personalityDesc = personalityDescription(char);
  if (personalityDesc && isCurrent) items.push(personalityDesc);
  
  items.push(`婚姻状况：${marriage(char)}`);
  items.push(describeProwess(char));
  items.push(goldStatus(char));
  items.push(`年龄：${char.age}`);
  if (char.faith) items.push(`信仰：${char.faith}`);
  if (char.culture) items.push(`文化：${char.culture}`);

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
      `国库：${char.treasury.amount.toFixed(2)} (${char.treasury.tooltip || "无描述"})`
    );
  }

  if (char.income) {
    items.push(
      `收入：金币 ${char.income.gold.toFixed(2)}，余额 ${char.income.balance.toFixed(2)}`
    );
  }

  if (char.influence) items.push(`影响力：${char.influence.amount} ${char.influence.tooltip || ""}`.trim());
  if (char.herd) items.push(`牧群：${char.herd.amount} ${char.herd.breakdown || ""}`.trim());

  if (char.legitimacy) {
    items.push(
      `正统性：${char.legitimacy.type}，等级 ${char.legitimacy.level}，值 ${char.legitimacy.value.toFixed(2)}`
    );
  }

  if (char.troops && char.troops.totalOwnedTroops > 0) items.push(troopsLine(char));

  if (char.laws && char.laws.length) {
    items.push(`法律：${char.laws.map((l) => l.name).join("、")}`);
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
      `修正：${char.modifiers
        .map((m) => `${m.name}${m.description ? ` (${m.description})` : ""}`)
        .join("、")}`
    );
  }

  if (isCurrent && char.stress) {
    items.push(
      `压力：等级 ${char.stress.level}，值 ${char.stress.value}，进度 ${char.stress.progress}`
    );
  }
  if (!isCurrent && char.stress) {
    items.push(`压力：等级 ${char.stress.level}`);
  }

  const family = familyLine(char);
  if (family) items.push(family);

  return items.filter(Boolean);
}


function mainPosition(char) {
  if (char.isLandedRuler) {
    return char.isIndependentRuler
      ? `${char.primaryTitle}的独立统治者`
      : `${char.primaryTitle}的统治者，${char.liege}的封臣`;
  }
  if (char.isKnight) {
    return `${char.liege}的骑士`;
  }
  if (char.isRuler) {
    return `${char.primaryTitle}的领袖`;
  }
  return `${char.liege || "未知领主"}的追随者`;
}

function houseAndStatus(char) {
  let line = char.sheHe === "she" ? "女性" : "男性";
  line += char.house ? `，${char.house}家族` : "，平民";
  return line;
}

function marriage(char) {
  if (char.consort) return `已婚，配偶${char.consort}`;
  return "未婚";
}

function describeProwess(char) {
  const p = char.prowess || 0;
  if (p >= 15) return `勇武：${p}（可畏的战士）`;
  if (p >= 10) return `勇武：${p}（熟练的战士）`;
  if (p >= 5) return `勇武：${p}（受过训练的战士）`;
  if (p > 0) return `勇武：${p}（缺乏经验的战士）`;
  return `勇武：${p}（非战斗人员）`;
}

function goldStatus(char) {
  const gold = char.gold || 0;
  if (gold >= 1000) return `富有（金币：${gold}）`;
  if (gold > 500) return `富裕（金币：${gold}）`;
  if (gold > 100) return `中等财富（金币：${gold}）`;
  if (gold > 0) return `贫穷（金币：${gold}）`;
  if (gold === 0) return "没有金币";
  return `负债（金币：${gold}）`;
}

function personalityDescription(char) {
  const traits = [];
  
  if (typeof char.boldness === "number") {
    if (char.boldness >= 70) traits.push("极其勇敢");
    else if (char.boldness >= 40) traits.push("勇敢");
    else if (char.boldness >= 20) traits.push("有些勇敢");
    else if (char.boldness <= -70) traits.push("极其怯懦");
    else if (char.boldness <= -40) traits.push("怯懦");
    else if (char.boldness <= -20) traits.push("有些怯懦");
  }
  
  if (typeof char.compassion === "number") {
    if (char.compassion >= 70) traits.push("极其慈悲");
    else if (char.compassion >= 40) traits.push("慈悲");
    else if (char.compassion >= 20) traits.push("有些慈悲");
    else if (char.compassion <= -70) traits.push("极其冷酷");
    else if (char.compassion <= -40) traits.push("冷酷");
    else if (char.compassion <= -20) traits.push("有些冷酷");
  }
  
  if (typeof char.energy === "number") {
    if (char.energy >= 70) traits.push("极其勤勉");
    else if (char.energy >= 40) traits.push("勤勉");
    else if (char.energy >= 20) traits.push("有些勤勉");
    else if (char.energy <= -70) traits.push("极其懒惰");
    else if (char.energy <= -40) traits.push("懒惰");
    else if (char.energy <= -20) traits.push("有些懒惰");
  }
  
  if (typeof char.greed === "number") {
    if (char.greed >= 70) traits.push("极其贪婪");
    else if (char.greed >= 40) traits.push("贪婪");
    else if (char.greed >= 20) traits.push("有些贪婪");
    else if (char.greed <= -70) traits.push("极其慷慨");
    else if (char.greed <= -40) traits.push("慷慨");
    else if (char.greed <= -20) traits.push("有些慷慨");
  }
  
  if (typeof char.honor === "number") {
    if (char.honor >= 70) traits.push("极其诚实");
    else if (char.honor >= 40) traits.push("诚实");
    else if (char.honor >= 20) traits.push("有些诚实");
    else if (char.honor <= -70) traits.push("极其狡诈");
    else if (char.honor <= -40) traits.push("狡诈");
    else if (char.honor <= -20) traits.push("有些狡诈");
  }
  
  if (typeof char.rationality === "number") {
    if (char.rationality >= 70) traits.push("极其理性");
    else if (char.rationality >= 40) traits.push("理性");
    else if (char.rationality >= 20) traits.push("有些理性");
    else if (char.rationality <= -70) traits.push("极其感性");
    else if (char.rationality <= -40) traits.push("感性");
    else if (char.rationality <= -20) traits.push("有些感性");
  }
  
  if (typeof char.sociability === "number") {
    if (char.sociability >= 70) traits.push("极其合群");
    else if (char.sociability >= 40) traits.push("合群");
    else if (char.sociability >= 20) traits.push("有些合群");
    else if (char.sociability <= -70) traits.push("极其害羞");
    else if (char.sociability <= -40) traits.push("内向");
    else if (char.sociability <= -20) traits.push("有些害羞");
  }
  
  if (typeof char.vengefulness === "number") {
    if (char.vengefulness >= 70) traits.push("极其睚眦必报");
    else if (char.vengefulness >= 40) traits.push("睚眦必报");
    else if (char.vengefulness >= 20) traits.push("有些睚眦必报");
    else if (char.vengefulness <= -70) traits.push("极其宽宏大量");
    else if (char.vengefulness <= -40) traits.push("宽宏大量");
    else if (char.vengefulness <= -20) traits.push("有些宽宏大量");
  }
  
  if (typeof char.zeal === "number") {
    if (char.zeal >= 70) traits.push("极其狂热");
    else if (char.zeal >= 40) traits.push("狂热");
    else if (char.zeal >= 20) traits.push("有些狂热");
    else if (char.zeal <= -70) traits.push("极其愤世嫉俗");
    else if (char.zeal <= -40) traits.push("愤世嫉俗");
    else if (char.zeal <= -20) traits.push("有些愤世嫉俗");
  }
  
  if (traits.length === 0) return null;
  return `性格核心：${traits.join("、")}`;
}

function opinionBreakdownLine(char, targetId, gameData) {
  if (!char.opinionBreakdowns || char.opinionBreakdowns.length === 0) return null;
  const targetBreakdown = char.opinionBreakdowns.find((ob) => ob.id === targetId);
  if (!targetBreakdown || !targetBreakdown.breakdown) return null;
  const list = targetBreakdown.breakdown
    .map((m) => `${m.reason}：${m.value > 0 ? "+" : ""}${m.value}`)
    .join("、");
  return `对${gameData.characters.get(targetId).shortName}的好感度分解：${list}`;
}

function listRelationsToCharacters(char, gameData) {
  if (!char.relationsToCharacters || char.relationsToCharacters.length === 0) return null;
  const lines = char.relationsToCharacters
    .map((rel) => {
      const targetChar = gameData.characters.get(rel.id);
      if (targetChar) {
        return `${targetChar.shortName}是${rel.relations.join("、")}`.replace("你的", gameData.playerName + "的").replace("你", gameData.playerName);
      }
      return null;
    })
    .filter(Boolean);
  return lines.length > 0 ? `角色对${char.fullName}的关系：${lines.join("; ")}` : null;
}

function secretsLine(char) {
  if (!char.secrets || char.secrets.length === 0) return null;
  const list = char.secrets
    .map((s) => `${s.name}（${s.category}${s.isCriminal ? "，犯罪" : ""}${s.isShunned ? "，被鄙视" : ""}）`)
    .join("、");
  return `此角色的秘密：${list}`;
}

function knownSecretsLine(char) {
  if (!char.knownSecrets || char.knownSecrets.length === 0) return null;
  const list = char.knownSecrets
    .map(
      (s) =>
        `${s.ownerName}的${s.name}（${s.category}${s.isCriminal ? "，犯罪" : ""}${
          s.isShunned ? "，被鄙视" : ""
        }）`
    )
    .join("、");
  return `已知的秘密：${list}`;
}

function troopsLine(char) {
  if (!char.troops) return null;
  const total = char.troops.totalOwnedTroops || 0;
  const regiments = (char.troops.maaRegiments || [])
    .filter((r) => r.isPersonal)
    .map((r) => `${r.name}：${r.menAlive}`)
    .join("、");
  return `兵力：总计 ${total}，私人兵士：${regiments}`;
}

function familyLine(char) {
  const parts = [];
  if (char.parents && char.parents.length > 0) {
    const parentsList = char.parents
      .map((p) => `${p.name}${p.deathDate ? `（死于${p.deathDate}${p.deathReason ? `：${p.deathReason}` : ""}）` : ""}`)
      .join("、");
    parts.push(`${char.fullName}的父母：${parentsList}`);
  }
  if (char.siblings && char.siblings.length > 0) {
    const siblingsList = char.siblings
      .map((s) => {
        const status = [s.sheHe === "he" ? "兄弟" : "姐妹", s.maritalStatus || "未婚"]
          .filter(Boolean)
          .join("、");
        const death = s.deathDate ? `，死于${s.deathDate}${s.deathReason ? `（${s.deathReason}）` : ""}` : "";
        const traits = (s.traits || []).map((t) => t.name).join("、");
        return `${s.name}（${status}${death}${traits ? `，特质：${traits}` : ""}）\n`;
      })
      .join("、");
    parts.push(`${char.fullName}的兄弟姐妹：${siblingsList}`);
  }
  if (char.children && char.children.length > 0) {
    const childrenList = char.children
      .map((c) => {
        const status = [c.sheHe === "he" ? "儿子" : "女儿", c.maritalStatus || "未婚"]
          .filter(Boolean)
          .join("、");
        const death = c.deathDate ? `，死于${c.deathDate}${c.deathReason ? `（${c.deathReason}）` : ""}` : "";
        const traits = (c.traits || []).map((t) => t.name).join("、");
        return `${c.name}（${status}${death}${traits ? `，特质：${traits}` : ""}）\n`;
      })
      .join("、");
    parts.push(`${char.fullName}的子女：${childrenList}`);
  }
  return parts.length ? parts.join("; ") : null;
}

function getOpinionDescription(score) {
    if (score > 60) return "忠诚于";
    if (score > 20) return "友好于";
    if (score > -20) return "中立于";
    if (score > -60) return "鄙视";
    return "仇恨";
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
                return `${char.shortName}${desc}${targetCharacter.shortName}`;
            }
            return null;
        })
        .filter(Boolean);
        
    return lines.length > 0 ? `意见[${lines.join(' | ')}]` : null;
}
