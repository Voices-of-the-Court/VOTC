// Detailed persona builder supporting multiple characters in conversation.
// Korean localization
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
    output += `[${current.shortName}의 캐릭터 정보: ${buildCharacterItems(current, gameData, true).join("; \n")}]\n`;
    
    gameData.characters.forEach((char) => {
        if (char.id !== current.id) {
            output += `[${char.shortName}의 캐릭터 정보: ${buildCharacterItems(char, gameData, false).join("; \n")}]\n`;
        }
    });

    const scenarioLine = `[날짜(${date}), 위치(${location}), 시나리오(${scenario()})]`;

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
                return `${mainChar.shortName}은(는) ${locationController}의 알현실에서 ${participantsListLine}와(과) 함께 있습니다.`;
            case "garden":
                return `${mainChar.shortName}은(는) ${locationController}의 성 정원에서 ${participantsListLine}를(을) 만납니다.`;
            case "bedchamber":
                return `${mainChar.shortName}은(는) 개인 침실에서 ${participantsListLine}와(과) 함께 있습니다.`;
            case "feast":
                return `${mainChar.shortName}은(는) ${locationController}가 주최한 연회에서 ${participantsListLine}와(과) 대화합니다.`;
            case "army_camp":
                return `${mainChar.shortName}은(는) 군영에서 ${participantsListLine}와(과) 함께 있습니다.`;
            case "hunt":
                return `${mainChar.shortName}은(는) 안개 낀 숲에서 ${participantsListLine}와(과) 사냥을 합니다.`;
            case "dungeon":
                return `${mainChar.shortName}은(는) 지하감옥에서 ${participantsListLine}와(과) 함께 있습니다.`;
            case "alley":
                return `${mainChar.shortName}은(는) 좁고 숨겨진 골목에서 ${participantsListLine}를(을) 만납니다.`;
            default:
                return `${mainChar.shortName}은(는) ${scene}에서 ${participantsListLine}를(을) 만납니다.`;
        }
    }
};


function buildCharacterItems(char, gameData, isCurrent) {
  const items = [];

  items.push(`id(${char.id})`);
  items.push(`이름: ${char.firstName}`);
  items.push(`전체 이름: ${char.fullName}`);
  items.push(mainPosition(char));

  if (char.heldCourtAndCouncilPositions) {
    items.push(`${char.liege || "알 수 없는 군주"}의 ${char.heldCourtAndCouncilPositions}`);
  }

  items.push(houseAndStatus(char));
  if (char.primaryTitle !== "None of" || char.primaryTitle !== "None" || char.primaryTitle !== "None von" || char.primaryTitle !== "None de") items.push(`주요 작위: ${char.primaryTitle}`);
  if (char.titleRankConcept !== "concept_none") items.push(`작위 등급: ${char.titleRankConcept}`);
  if (char.capitalLocation) items.push(`수도: ${char.capitalLocation}`);
  if (char.location) items.push(`현재 위치: ${char.location}`);

  const personalityTraits = (char.traits || []).filter((t) => t.category === "성격 특성");
  if (personalityTraits.length) {
    items.push(
      `성격 특성: ${personalityTraits
        .map((t) => `${t.name}${t.desc ? ` (${t.desc})` : ""}`)
        .join(", ")}`
    );
  }

  const otherTraits = (char.traits || []).filter((t) => t.category !== "성격 특성");
  if (otherTraits.length) {
    items.push(
      `기타 특성: ${otherTraits
        .map((t) => `${t.name} [${t.category}]${t.desc ? ` (${t.desc})` : ""}`)
        .join(", ")}`
    );
  }

  if (char.sexuality) items.push(`성적 지향: ${char.sexuality}`);
  if (char.personality) items.push(`성격: ${char.personality}`);
  
  const personalityDesc = personalityDescription(char);
  if (personalityDesc && isCurrent) items.push(personalityDesc);
  
  items.push(`혼인 상태: ${marriage(char)}`);
  items.push(describeProwess(char));
  items.push(goldStatus(char));
  items.push(`나이: ${char.age}`);
  if (char.faith) items.push(`신앙: ${char.faith}`);
  if (char.culture) items.push(`문화: ${char.culture}`);

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
      `국고: ${char.treasury.amount.toFixed(2)} (${char.treasury.tooltip || "설명 없음"})`
    );
  }

  if (char.income) {
    items.push(
      `수입: 금화 ${char.income.gold.toFixed(2)}, 수지 ${char.income.balance.toFixed(2)}`
    );
  }

  if (char.influence) items.push(`영향력: ${char.influence.amount} ${char.influence.tooltip || ""}`.trim());
  if (char.herd) items.push(`가축: ${char.herd.amount} ${char.herd.breakdown || ""}`.trim());

  if (char.legitimacy) {
    items.push(
      `정통성: ${char.legitimacy.type}, 레벨 ${char.legitimacy.level}, 값 ${char.legitimacy.value.toFixed(2)}`
    );
  }

  if (char.troops && char.troops.totalOwnedTroops > 0) items.push(troopsLine(char));

  if (char.laws && char.laws.length) {
    items.push(`법률: ${char.laws.map((l) => l.name).join(", ")}`);
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
      `수정자: ${char.modifiers
        .map((m) => `${m.name}${m.description ? ` (${m.description})` : ""}`)
        .join(", ")}`
    );
  }

  if (isCurrent && char.stress) {
    items.push(
      `스트레스: 레벨 ${char.stress.level}, 값 ${char.stress.value}, 진행도 ${char.stress.progress}`
    );
  }
  if (!isCurrent && char.stress) {
    items.push(`스트레스: 레벨 ${char.stress.level}`);
  }

  const family = familyLine(char);
  if (family) items.push(family);

  return items.filter(Boolean);
}


function mainPosition(char) {
  if (char.isLandedRuler) {
    return char.isIndependentRuler
      ? `${char.primaryTitle}의 독립 군주`
      : `${char.primaryTitle}의 군주, ${char.liege}의 봉신`;
  }
  if (char.isKnight) {
    return `${char.liege}의 기사`;
  }
  if (char.isRuler) {
    return `${char.primaryTitle}의 지도자`;
  }
  return `${char.liege || "알 수 없는 군주"}의 추종자`;
}

function houseAndStatus(char) {
  let line = char.sheHe === "그녀" ? "여성" : "남성";
  line += char.house ? `, ${char.house} 가문` : ", 평민";
  return line;
}

function marriage(char) {
  if (char.consort) return `${char.fullName}은(는) ${char.consort}와(과) 결혼`;
  return `${char.fullName}은(는) 미혼`;
}

function describeProwess(char) {
  const p = char.prowess || 0;
  if (p >= 15) return `무용: ${p} (위대한 전사)`;
  if (p >= 10) return `무용: ${p} (숙련된 전투원)`;
  if (p >= 5) return `무용: ${p} (훈련된 전투원)`;
  if (p > 0) return `무용: ${p} (초보 전투원)`;
  return `무용: ${p} (비전투원)`;
}

function goldStatus(char) {
  const gold = char.gold || 0;
  if (gold >= 1000) return `부유함 (금화: ${gold})`;
  if (gold > 500) return `넉넉함 (금화: ${gold})`;
  if (gold > 100) return `보통 (금화: ${gold})`;
  if (gold > 0) return `가난함 (금화: ${gold})`;
  if (gold === 0) return "금화 없음";
  return `빚 (금화: ${gold})`;
}

function personalityDescription(char) {
  const traits = [];
  
  if (typeof char.boldness === "number") {
    if (char.boldness >= 70) traits.push("매우 용감함");
    else if (char.boldness >= 40) traits.push("용감함");
    else if (char.boldness >= 20) traits.push("약간 용감함");
    else if (char.boldness <= -70) traits.push("매우 겁이 많음");
    else if (char.boldness <= -40) traits.push("겁이 많음");
    else if (char.boldness <= -20) traits.push("약간 겁이 많음");
  }
  
  if (typeof char.compassion === "number") {
    if (char.compassion >= 70) traits.push("매우 자비로움");
    else if (char.compassion >= 40) traits.push("자비로움");
    else if (char.compassion >= 20) traits.push("약간 자비로움");
    else if (char.compassion <= -70) traits.push("매우 냉담함");
    else if (char.compassion <= -40) traits.push("냉담함");
    else if (char.compassion <= -20) traits.push("약간 냉담함");
  }
  
  if (typeof char.energy === "number") {
    if (char.energy >= 70) traits.push("매우 근면함");
    else if (char.energy >= 40) traits.push("근면함");
    else if (char.energy >= 20) traits.push("약간 근면함");
    else if (char.energy <= -70) traits.push("매우 게으름");
    else if (char.energy <= -40) traits.push("게으름");
    else if (char.energy <= -20) traits.push("약간 게으름");
  }
  
  if (typeof char.greed === "number") {
    if (char.greed >= 70) traits.push("매우 탐욕스러움");
    else if (char.greed >= 40) traits.push("탐욕스러움");
    else if (char.greed >= 20) traits.push("약간 탐욕스러움");
    else if (char.greed <= -70) traits.push("매우 너그러움");
    else if (char.greed <= -40) traits.push("너그러움");
    else if (char.greed <= -20) traits.push("약간 너그러움");
  }
  
  if (typeof char.honor === "number") {
    if (char.honor >= 70) traits.push("매우 정직함");
    else if (char.honor >= 40) traits.push("정직함");
    else if (char.honor >= 20) traits.push("약간 정직함");
    else if (char.honor <= -70) traits.push("매우 기만적임");
    else if (char.honor <= -40) traits.push("기만적임");
    else if (char.honor <= -20) traits.push("약간 기만적임");
  }
  
  if (typeof char.rationality === "number") {
    if (char.rationality >= 70) traits.push("매우 이성적임");
    else if (char.rationality >= 40) traits.push("이성적임");
    else if (char.rationality >= 20) traits.push("약간 이성적임");
    else if (char.rationality <= -70) traits.push("매우 감정적임");
    else if (char.rationality <= -40) traits.push("감정적임");
    else if (char.rationality <= -20) traits.push("약간 감정적임");
  }
  
  if (typeof char.sociability === "number") {
    if (char.sociability >= 70) traits.push("매우 사교적임");
    else if (char.sociability >= 40) traits.push("사교적임");
    else if (char.sociability >= 20) traits.push("약간 사교적임");
    else if (char.sociability <= -70) traits.push("매우 수줍음");
    else if (char.sociability <= -40) traits.push("내향적임");
    else if (char.sociability <= -20) traits.push("약간 수줍음");
  }
  
  if (typeof char.vengefulness === "number") {
    if (char.vengefulness >= 70) traits.push("매우 앙심 깊음");
    else if (char.vengefulness >= 40) traits.push("앙심 깊음");
    else if (char.vengefulness >= 20) traits.push("약간 앙심 깊음");
    else if (char.vengefulness <= -70) traits.push("매우 관대함");
    else if (char.vengefulness <= -40) traits.push("관대함");
    else if (char.vengefulness <= -20) traits.push("약간 관대함");
  }
  
  if (typeof char.zeal === "number") {
    if (char.zeal >= 70) traits.push("매우 열성적임");
    else if (char.zeal >= 40) traits.push("열성적임");
    else if (char.zeal >= 20) traits.push("약간 열성적임");
    else if (char.zeal <= -70) traits.push("매우 냉소적임");
    else if (char.zeal <= -40) traits.push("냉소적임");
    else if (char.zeal <= -20) traits.push("약간 냉소적임");
  }
  
  if (traits.length === 0) return null;
  return `성격 핵심: ${traits.join(", ")}`;
}

function opinionBreakdownLine(char, targetId, gameData) {
  if (!char.opinionBreakdowns || char.opinionBreakdowns.length === 0) return null;
  const targetBreakdown = char.opinionBreakdowns.find((ob) => ob.id === targetId);
  if (!targetBreakdown || !targetBreakdown.breakdown) return null;
  const list = targetBreakdown.breakdown
    .map((m) => `${m.reason}: ${m.value > 0 ? "+" : ""}${m.value}`)
    .join(", ");
  return `${gameData.characters.get(targetId).shortName}에 대한 호감도 분석: ${list}`;
}

function listRelationsToCharacters(char, gameData) {
  if (!char.relationsToCharacters || char.relationsToCharacters.length === 0) return null;
  const lines = char.relationsToCharacters
    .map((rel) => {
      const targetChar = gameData.characters.get(rel.id);
      if (targetChar) {
        return `${targetChar.shortName}은(는) ${rel.relations.join(", ")}`.replace("당신의", gameData.playerName + "의").replace("당신", gameData.playerName);
      }
      return null;
    })
    .filter(Boolean);
  return lines.length > 0 ? `${char.fullName}에 대한 캐릭터 관계: ${lines.join("; ")}` : null;
}

function secretsLine(char) {
  if (!char.secrets || char.secrets.length === 0) return null;
  const list = char.secrets
    .map((s) => `${s.name} (${s.category}${s.isCriminal ? ", 범죄" : ""}${s.isShunned ? ", 비난받음" : ""})`)
    .join(", ");
  return `이 캐릭터의 비밀: ${list}`;
}

function knownSecretsLine(char) {
  if (!char.knownSecrets || char.knownSecrets.length === 0) return null;
  const list = char.knownSecrets
    .map(
      (s) =>
        `${s.ownerName}의 ${s.name} (${s.category}${s.isCriminal ? ", 범죄" : ""}${
          s.isShunned ? ", 비난받음" : ""
        })`
    )
    .join(", ");
  return `알려진 비밀: ${list}`;
}

function troopsLine(char) {
  if (!char.troops) return null;
  const total = char.troops.totalOwnedTroops || 0;
  const regiments = (char.troops.maaRegiments || [])
    .filter((r) => r.isPersonal)
    .map((r) => `${r.name}:${r.menAlive}`)
    .join(", ");
  return `병력: 총 ${total}, 개인 병사: ${regiments}`;
}

function familyLine(char) {
  const parts = [];
  if (char.parents && char.parents.length > 0) {
    const parentsList = char.parents
      .map((p) => `${p.name}${p.deathDate ? ` (사망 ${p.deathDate}${p.deathReason ? `: ${p.deathReason}` : ""})` : ""}`)
      .join(", ");
    parts.push(`${char.fullName}의 부모: ${parentsList}`);
  }
  if (char.siblings && char.siblings.length > 0) {
    const siblingsList = char.siblings
      .map((s) => {
        const status = [s.sheHe === "그" ? "형제" : "자매", s.maritalStatus || "미혼"]
          .filter(Boolean)
          .join(", ");
        const death = s.deathDate ? `, 사망 ${s.deathDate}${s.deathReason ? ` (${s.deathReason})` : ""}` : "";
        const traits = (s.traits || []).map((t) => t.name).join(", ");
        return `${s.name} (${status}${death}${traits ? `, 특성: ${traits}` : ""})\n`;
      })
      .join(", ");
    parts.push(`${char.fullName}의 형제자매: ${siblingsList}`);
  }
  if (char.children && char.children.length > 0) {
    const childrenList = char.children
      .map((c) => {
        const status = [c.sheHe === "그" ? "아들" : "딸", c.maritalStatus || "미혼"]
          .filter(Boolean)
          .join(", ");
        const death = c.deathDate ? `, 사망 ${c.deathDate}${c.deathReason ? ` (${c.deathReason})` : ""}` : "";
        const traits = (c.traits || []).map((t) => t.name).join(", ");
        return `${c.name} (${status}${death}${traits ? `, 특성: ${traits}` : ""})\n`;
      })
      .join(", ");
    parts.push(`${char.fullName}의 자녀: ${childrenList}`);
  }
  return parts.length ? parts.join("; ") : null;
}

function getOpinionDescription(score) {
    if (score > 60) return "헌신적임";
    if (score > 20) return "우호적임";
    if (score > -20) return "중립적임";
    if (score > -60) return "경멸함";
    return "증오함";
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
                return `${char.shortName}은(는) ${targetCharacter.shortName}에게 ${desc}`;
            }
            return null;
        })
        .filter(Boolean);
        
    return lines.length > 0 ? `의견[${lines.join(' | ')}]` : null;
}
