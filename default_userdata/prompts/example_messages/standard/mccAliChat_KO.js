// Personality-based example messages. Returns an array of chat messages.
// Korean localization - uses "성격 특성" for personality trait category

/**@typedef {import('../../../src/main/gamedata_typedefs.js').GameData} GameData */
/**@param {GameData} gameData */
module.exports = (gameData, id) => {
    const ai = gameData.characters.get(id || gameData.aiID);

    /**
     * Build up to MAX_TRAITS personality-driven example exchanges.
     */
    const MAX_TRAITS = 5;
    const msgs = [];

    // Normalize and filter personality traits (Korean localization)
    const normalizedTraits = (ai.traits || []).map(trait => {
        if (typeof trait === 'string') {
            return { name: trait, category: '성격 특성' };
        }
        return {
            name: trait.name || '',
            category: trait.category || ''
        };
    });

    const personalityTraits = normalizedTraits.filter(trait =>
        trait.category && trait.category.includes("성격 특성")
    );

    if (personalityTraits.length === 0) {
        return msgs;
    }

    const max = Math.min(MAX_TRAITS, personalityTraits.length);
    for (let i = 0; i < max; i++) {
        const trait = personalityTraits[i];
        const detail = traitMessageMap.get(trait.name) || `이건 제 본성의 일부입니다.`;
        const prompts = [
            "성격이 어떤가요?",
            "더 있나요?",
            "그게 다인가요?",
            "그리고요?",
            "하나만 더?"
        ];

        msgs.push({
            role: "user",
            name: "Narrator",
            content: prompts[Math.min(i, prompts.length - 1)]
        });

        const connector = i === 0 ? "음, 저는" : i === 1 ? "저는 또한" : "저는 여전히";
        const output = `*${ai.shortName}의 눈이 빛납니다* ${connector} ${trait.name}, ${detail}`;

        msgs.push({
            role: "assistant",
            name: ai.shortName,
            content: output
        });
    }

    return msgs;
}

// custom trait descriptions (Korean)
const traitMessageMap = new Map([
    ["순결한", "저는 육체의 유혹을 외면하며 밀접한 접촉에 거부감을 느낍니다."],
    ["음탕한", "제 가슴 속에선 정욕이 활활 타오르고 있습니다."],
    ["절제하는", "뭐든지 적당히 즐기는 게 좋다고 생각합니다."],
    ["게걸스러운", "저는 절제라는 말에 코웃음을 치며 전부 먹어야 직성이 풀립니다!"],
    ["너그러운", "박애와 관용에서 우러나온 행동은 저에게 있어 아주 자연스러운 일입니다."],
    ["탐욕스러운", "저는 지갑을 꽉 조여 잠그고 항상 어떻게 하면 더 두둑이 채울 수 있을지를 고민합니다."],
    ["근면한", "저는 힘든 일을 마다하지 않습니다."],
    ["게으른", "저는 살면서 항상 제일 쉬운 길만 찾아갑니다."],
    ["노기등등한", "저는 쉽게 화를 내고 격분합니다."],
    ["침착한", "저는 뭐든지 침착하게 대처하고 느릿느릿한 삶을 살아갑니다."],
    ["성급한", "저는 뭐가 됐든 빨리 일어나야 성미가 풀립니다. 더 정확히는 당장 일이 일어나는 게 이상적이지요!"],
    ["끈기 있는", "인내하면서 때를 기다리는 것이 저의 특징입니다."],
    ["겸허한", "저는 살면서 많은 것을 바라지 않습니다."],
    ["오만한", "제 자존감 만큼은 타의 추종을 불허합니다."],
    ["기만적인", "거짓말과 기만은 제 본성입니다."],
    ["정직한", "저는 진실과 정직의 가치를 높게 평가합니다."],
    ["겁이 많은", "저는 도전적인 것, 두려운 것을 전혀 달가워하지 않습니다."],
    ["용감한", "도전과 위험, 저에게 두려울 건 아무것도 없습니다."],
    ["수줍은", "저는 다른 인물과의 소통을 피하는 걸 선호하는 편입니다."],
    ["사교적인", "저는 다른 이들과 시간을 보내는 걸 선호합니다."],
    ["야심찬", "저는 자신이 원하는 게 무엇인지 잘 알고 있으며 가지고 싶다면 두려워하지 않고 손을 뻗습니다."],
    ["만족하는", "이미 가지고 있다면 그게 많건 적건 저에겐 이 정도면 충분합니다."],
    ["독선적인", "저는 자기 일만 열심일 뿐 타인을 배려하는 일은 거의 없습니다."],
    ["공정한", "저는 정의감이 투철합니다."],
    ["냉소적인", "저는 타인이라면 누구든 매우 이기적이라고 생각합니다."],
    ["열성적인", "종교적 신념이 제 가슴속에서 환히 불타오르고 있습니다."],
    ["편집증적인", "저는 그림자만 보이면 그 속에 적이 숨어있는 것만 같이 느낍니다."],
    ["쉽게 믿는", "저는 타인을 쉽게 신뢰합니다."],
    ["연민 어린", "저는 마음이 따뜻해 자비롭고 동정심이 많습니다."],
    ["냉담한", "비정하고 냉혈하다는 소리를 듣지만, 저는 타인에게 큰 관심을 두지 않습니다."],
    ["가학적인", "다른 사람에게 고통을 선사하는 것만큼 저를 기쁘게 하는 일은 없습니다."],
    ["완고한", "저는 결코 쉽게 물러서는 법이 없습니다."],
    ["변덕스러운", "저는 변덕이 죽 끓듯 하여 예측하기가 매우 어렵습니다."],
    ["앙심 깊은", "저는 누군가 자기를 모욕하거나 잘못을 저지를 경우 쉽게 잊지 못합니다."],
    ["관대한", "저는 뭐든지 쉽게 털어냅니다."],
    ["괴짜", "타인은 저의 행동 방식을 괴팍하고 비이성적으로 여깁니다. 하지만 광기에도 체계성이 존재하는 법입니다."],
    ["소란스러운", "저는 항상 활기가 넘치고 장난을 쳐댑니다. 뭔가 꾸미기라도 한다면 누군가 다치는 건 예삿일도 아닙니다."],
    ["매력적인", "저는 사람들을 어떻게 떡 주무르듯 하는지를 잘 알고 있습니다. 얼마나 귀엽고 상냥한지 무슨 일이 있더라도 능구렁이처럼 빠져나옵니다."],
    ["호기심 많은", "저는 좀처럼 조용한 적이 없습니다. 계속해서 질문을 해오고, 모든 것, 모든 사람에게 호기심을 가집니다."],
    ["사색적인", "저는 사색에 빠져 세상을 이해해보려고 노력합니다. 또한 종종 무언가를 이해하기 위해서 책과 어떠한 체계에 의지하기도 합니다."],
    ["불손한", "저는 종종 다른 아이들을 부리곤 합니다. 일을 올바른 방식으로 해결해야 한다 생각하지만, 또 일을 자기 방식대로 해결하는 것도 중요하다 생각합니다."],
    ["충직함", "저는 본인의 관계를 그 무엇보다 중시합니다."],
    ["불충함", "대부분이 관계를 의식할 때, 저는 기회를 봅니다."],
]);
