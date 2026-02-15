// Personality-based example messages. Returns an array of chat messages.
// Japanese localization - uses "性格特性" for personality trait category

/**@typedef {import('../../../src/main/gamedata_typedefs.js').GameData} GameData */
/**@param {GameData} gameData */
module.exports = (gameData, id) => {
    const ai = gameData.characters.get(id || gameData.aiID);

    /**
     * Build up to MAX_TRAITS personality-driven example exchanges.
     */
    const MAX_TRAITS = 5;
    const msgs = [];

    // Normalize and filter personality traits (Japanese localization)
    const normalizedTraits = (ai.traits || []).map(trait => {
        if (typeof trait === 'string') {
            return { name: trait, category: '性格特性' };
        }
        return {
            name: trait.name || '',
            category: trait.category || ''
        };
    });

    const personalityTraits = normalizedTraits.filter(trait =>
        trait.category && trait.category.includes("性格特性")
    );

    if (personalityTraits.length === 0) {
        return msgs;
    }

    const max = Math.min(MAX_TRAITS, personalityTraits.length);
    for (let i = 0; i < max; i++) {
        const trait = personalityTraits[i];
        const detail = traitMessageMap.get(trait.name) || `それは私の本質の一部です。`;
        const prompts = [
            "性格は？",
            "他には？",
            "それで全部？",
            "他になに？",
            "もう一つ？"
        ];

        msgs.push({
            role: "user",
            name: "Narrator",
            content: prompts[Math.min(i, prompts.length - 1)]
        });

        const connector = i === 0 ? "ええ、私は" : i === 1 ? "私もまた" : "私はまだ";
        const output = `*${ai.shortName}の目が輝く* ${connector}${trait.name}、${detail}`;

        msgs.push({
            role: "assistant",
            name: ai.shortName,
            content: output
        });
    }

    return msgs;
}

// custom trait descriptions (Japanese)
const traitMessageMap = new Map([
    ["貞節", "私は肉体的な接触を嫌い、肉欲を避けるようにしています。"],
    ["好色", "私の心の奥には肉欲の炎が燃えたぎっています。"],
    ["節制", "物事はほどほどに楽しむのが一番だと思っています。"],
    ["大食", "節制などというものはくだらない考えです。私が望むのは全てを手に入れることなのですから。"],
    ["太っ腹", "善行や慈善といったものは決して珍しいことではありません。"],
    ["強欲", "私は決して財布の口を緩めません。そして、常に財布をいっぱいに満たす方法を探しているのです。"],
    ["勤勉", "私は激務を厭いません。"],
    ["怠惰", "最も安易な生き方を選びます。"],
    ["憤怒", "私はすぐにカッとなります。"],
    ["穏和", "私は物事を前向きにとらえ、ゆったりと人生を送っています。"],
    ["短気", "物事というのは素早く起こるべきだと考えています。理想を言えば、今すぐに起こって欲しいのです。"],
    ["忍耐", "待って好機を窺うというのは私の得意とするところです。"],
    ["謙虚", "私は人生に多くを求めません。"],
    ["傲慢", "私は自らの価値観を信じて疑いません。"],
    ["嘘つき", "嘘をついたり人を欺いたりするのは私の性分です。"],
    ["正直", "私は真理や誠実さを強く尊重しています。"],
    ["臆病", "私は試されることに何の楽しみも見出しません。というよりも、とにかく怖いのです。"],
    ["勇敢", "挑戦も危険も、私が恐れるものは何もありません。"],
    ["内向的", "私は他人との交流を避けることを好みます。"],
    ["社交的", "私は他人と過ごす時間を楽しんでいます。"],
    ["野心的", "私は自らの望みが何なのかを知っていて、躊躇せずにそれを手に入れようとします。"],
    ["満足", "すでに持っているものが多かろうと少なかろうと、私にとってはそれで十分なのです。"],
    ["独善的", "私は自分のしたいことをし、他人のことを気に掛けることはほとんどありません。"],
    ["公正", "私は強い正義感を持っています。"],
    ["冷笑的", "私が最も信頼しているものは、他人の私利私欲です。"],
    ["狂信的", "私の心の中心では信仰の炎が燃え盛っています。"],
    ["疑心暗鬼", "私はあらゆる物陰に敵の姿を見ます。"],
    ["お人好し", "私はすぐに他人を信用します。"],
    ["慈悲", "慈悲深く、同情心が強い。私は温かい心を持っています。"],
    ["非情", "冷酷で冷血。私はほぼ全ての人間に興味を抱いていません。"],
    ["嗜虐的", "他人が苦しむ姿ほど私に喜びをもたらすものはありません。"],
    ["頑固", "私は決して引き下がることはありません。"],
    ["気まぐれ", "私はころころと気が変わる。全く予測不能です。"],
    ["執念深い", "私は軽蔑されたり不当に扱われたりしたことをなかなか忘れません。"],
    ["寛容", "私は何かあってもすぐに次の行動に移ることができます。"],
    ["奇才", "私の行動は他者には不規則で非合理的に見えますが、その狂気には何らかの道理があるように思われます。"],
    ["腕白", "私はいつも動き回っています。元気いっぱいのイタズラっ子です。何かをしようとして誰かを傷つけてしまうことも珍しいことではありません。"],
    ["甘え上手", "私は明らかに他人を思い通りに動かすすべを心得ています。その愛らしさと人懐っこさがあれば、どんなことをしても許されるのです。"],
    ["好奇心旺盛", "私と一緒にいると静かな時間はめったに訪れません。何にでも、誰にでも興味を持ち、絶えず質問しているのです。"],
    ["物静か", "私はしばしばじっと考え込んで、周囲の世界を理解しようと努めています。物事を理解するとき、本や道具に頼ることが多いです。"],
    ["仕切り屋", "私は周囲の子供たちに命令している姿がよく見かけられます。物事を正しい方法で行うことが大事だとわかってはいますが、自分のやり方で行うことも同じくらい大事だと思っているのです。"],
    ["忠実", "私は自分の関係を大抵の人より真剣に考えます。"],
    ["不忠実", "多くの人々が関係を見出すものは、私にとっては「機会」なのです。"],
]);
