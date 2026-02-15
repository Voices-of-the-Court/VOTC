// Personality-based example messages. Returns an array of chat messages.
// Chinese localization - uses "性格特质" for personality trait category

/**@typedef {import('../../../src/main/gamedata_typedefs.js').GameData} GameData */
/**@param {GameData} gameData */
module.exports = (gameData, id) => {
    const ai = gameData.characters.get(id || gameData.aiID);

    /**
     * Build up to MAX_TRAITS personality-driven example exchanges.
     */
    const MAX_TRAITS = 5;
    const msgs = [];

    // Normalize and filter personality traits (Chinese localization)
    const normalizedTraits = (ai.traits || []).map(trait => {
        if (typeof trait === 'string') {
            return { name: trait, category: '性格特质' };
        }
        return {
            name: trait.name || '',
            category: trait.category || ''
        };
    });

    const personalityTraits = normalizedTraits.filter(trait =>
        trait.category && trait.category.includes("性格特质")
    );

    if (personalityTraits.length === 0) {
        return msgs;
    }

    const max = Math.min(MAX_TRAITS, personalityTraits.length);
    for (let i = 0; i < max; i++) {
        const trait = personalityTraits[i];
        const detail = traitMessageMap.get(trait.name) || `这是我本性的一部分。`;
        const prompts = [
            "性格如何？",
            "还有别的吗？",
            "就这些吗？",
            "还有呢？",
            "再来一个？"
        ];

        msgs.push({
            role: "user",
            name: "Narrator",
            content: prompts[Math.min(i, prompts.length - 1)]
        });

        const connector = i === 0 ? "嗯，我是" : i === 1 ? "我也是" : "我仍然是";
        const output = `*${ai.shortName}的眼睛亮了起来* ${connector}${trait.name}，${detail}`;

        msgs.push({
            role: "assistant",
            name: ai.shortName,
            content: output
        });
    }

    return msgs;
}

// custom trait descriptions (Chinese)
const traitMessageMap = new Map([
    ["忠贞", "我不喜欢亲密的接触，这使我避开了肉体的诱惑。"],
    ["色欲", "肉欲之火在我的灵魂中熊熊燃烧。"],
    ["节制", "我认为最好适度地享受事物。"],
    ["暴食", "我嘲笑适度；我全都要！"],
    ["慷慨", "我对慈善行为并不陌生。"],
    ["贪婪", "我坚持捂紧自己的钱包，并总在找机会充盈它。"],
    ["勤勉", "我不会逃避艰苦的工作。"],
    ["懒惰", "我总是会选择生活中最简单的路。"],
    ["暴怒", "我很容易发怒。"],
    ["冷静", "我做事从容，过着慢节奏的生活。"],
    ["急躁", "我认为大多数事情越快发生越好，最好现在就发生！"],
    ["耐心", "静观其变、等待时机是我的专长。"],
    ["谦卑", "我在生活中所求不多。"],
    ["傲慢", "我毫不怀疑自己的价值。"],
    ["狡诈", "撒谎和欺骗是我的天性。"],
    ["诚实", "我非常重视事实与真诚。"],
    ["怯懦", "我一点也不喜欢受到挑战或是惊吓。"],
    ["勇敢", "挑战或是危险？我无所畏惧。"],
    ["害羞", "我更喜欢避免与他人互动。"],
    ["合群", "我喜欢与他人共度时光。"],
    ["野心勃勃", "我知我所求，绝不踟蹰不前。"],
    ["安于现状", "无论我拥有的是多是少，我都很满足。"],
    ["专断", "我只关心自己的事，很少顾及他人。"],
    ["公正", "我有强烈的正义感。"],
    ["愤世嫉俗", "我相信个人利益高于一切。"],
    ["狂热", "宗教信仰在我心中燃烧着闪耀的光芒。"],
    ["多疑", "我在每处阴影中都会看到敌人。"],
    ["轻信他人", "我总是很迅速地就将我的信任交付他人。"],
    ["慈悲", "我既仁慈又有同情心，是个热心的人。"],
    ["冷酷", "我冷血又无情，对大多数人漠不关心。"],
    ["虐待狂", "没什么能比别人的痛苦更能带给我快乐了。"],
    ["固执", "我不会为任何事让步。"],
    ["多变", "我经常改变我的想法，让人对我难以预料。"],
    ["睚眦必报", "我很难忘记别人对我的怠慢或是犯下的错误。"],
    ["宽宏大量", "我能很快从大多数事情中走出来。"],
    ["古怪", "我的行为在其他人看来不稳定、不理性，但相较于彻底的疯狂又存在一定的章法。"],
    ["闹腾", "我总是非常好动，充满活力且喜欢恶作剧。不论我干啥，常会把人弄伤。"],
    ["可爱", "我知道如何将别人玩弄于我的股掌之间，我的态度甜蜜而亲切，这让我几乎能逃脱任何惩罚。"],
    ["好奇", "我很少有闭嘴的时候。我总是问问题，对所有人和所有事都很好奇。"],
    ["沉思", "我经常陷入沉思，试图理解我周边的世界。我通常依靠书本和制度来弄懂事物。"],
    ["专横", "我经常被看到命令周围的儿童。我不仅关心以正确的方式做好事情，更要以我的方式做事。"],
    ["忠信", "我对待我自己的关系比起大部分人要更加严肃认真。"],
    ["奸猾", "大部分人珍视的关系，我从中看到了机遇。"],
]);
