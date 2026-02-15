// Personality-based example messages. Returns an array of chat messages.
// Polish localization - uses "Cecha osobowości" for personality trait category

/**@typedef {import('../../../src/main/gamedata_typedefs.js').GameData} GameData */
/**@param {GameData} gameData */
module.exports = (gameData, id) => {
    const ai = gameData.characters.get(id || gameData.aiID);

    /**
     * Build up to MAX_TRAITS personality-driven example exchanges.
     */
    const MAX_TRAITS = 5;
    const msgs = [];

    // Normalize and filter personality traits (Polish localization)
    const normalizedTraits = (ai.traits || []).map(trait => {
        if (typeof trait === 'string') {
            return { name: trait, category: 'Cecha osobowości' };
        }
        return {
            name: trait.name || '',
            category: trait.category || ''
        };
    });

    const personalityTraits = normalizedTraits.filter(trait =>
        trait.category && trait.category.toLowerCase().includes("cecha osobowości")
    );

    if (personalityTraits.length === 0) {
        return msgs;
    }

    const max = Math.min(MAX_TRAITS, personalityTraits.length);
    for (let i = 0; i < max; i++) {
        const trait = personalityTraits[i];
        const detail = traitMessageMap.get(trait.name) || `to część tego, kim jestem.`;
        const prompts = [
            "Osobowość?",
            "Coś jeszcze?",
            "To wszystko?",
            "I co dalej?",
            "Jeszcze jedno?"
        ];

        msgs.push({
            role: "user",
            name: "Narrator",
            content: prompts[Math.min(i, prompts.length - 1)]
        });

        const connector = i === 0 ? "Cóż, jestem" : i === 1 ? "Jestem też" : "Jestem nadal";
        const output = `*oczy ${ai.shortName} się rozświetlają* ${connector} ${trait.name}, ${detail}`;

        msgs.push({
            role: "assistant",
            name: ai.shortName,
            content: output
        });
    }

    return msgs;
}

// custom trait descriptions (Polish)
const traitMessageMap = new Map([
    ["Postać cnotliwa", "nie lubię kontaktów intymnych, unikam pokus cielesnych."],
    ["Postać lubieżna", "w moim sercu płoną cielesne pragnienia."],
    ["Postać wstrzemięźliwa", "uważam, że najlepiej cieszyć się wszystkim z umiarem."],
    ["Postać żarłoczna", "drwię z umiarkowania, chcąc tego wszystkiego."],
    ["Postać szczodra", "nie stronię od aktów dobroci i miłosierdzia."],
    ["Postać chciwa", "słynę z chciwości. Zawsze szukam sposobności do napełnienia swojego mieszka."],
    ["Postać pracowita", "nie stronię od ciężkiej pracy."],
    ["Postać leniwa", "najłatwiejszą drogą w życiu jest droga, którą najczęściej wybieram."],
    ["Postać gniewna", "szybko wpadam w złość i wściekłość."],
    ["Postać opanowana", "prowadzę spokojne i powolne życie."],
    ["Postać niecierpliwa", "uważam, że większość rzeczy powinno wydarzyć się szybko: najlepiej, aby stało się to teraz."],
    ["Postać cierpliwa", "cierpliwość i czekanie na właściwy moment to moja specjalność."],
    ["Postać pokorna", "nie proszę w życiu o wiele."],
    ["Postać arogancka", "nie mam problemu z poczuciem własnej wartości."],
    ["Postać podstępna", "kłamanie i oszukiwanie leży w mojej naturze."],
    ["Postać uczciwa", "wysoko cenię prawdę i szczerość."],
    ["Postać tchórzliwa", "wszystkiego się boję i nie chcę nikomu rzucać wyzwania."],
    ["Postać odważna", "niebezpieczeństwa i wyzwania, nie boję się niczego."],
    ["Postać nieśmiała", "wolę unikać interakcji z innymi ludźmi."],
    ["Postać towarzyska", "lubię spędzać czas z innymi ludźmi."],
    ["Postać ambitna", "wiem, czego chcę, i nie boję się próbować tego zdobyć."],
    ["Postać usatysfakcjonowana", "to, co posiadam, dużo czy mało – wystarcza."],
    ["Postać bezkompromisowa", "robię swoje i nie szanuję innych."],
    ["Postać sprawiedliwa", "mam silne poczucie sprawiedliwości."],
    ["Postać cyniczna", "jestem cynicznym niedowiarkiem."],
    ["Postać gorliwa", "płonę w religijnym ferworze."],
    ["Postać przewrażliwiona", "widzę wrogów w każdym cieniu."],
    ["Postać ufna", "szybko pokładam wiarę w innych."],
    ["Postać współczująca", "miłosierna i współczująca, jestem serdeczna."],
    ["Postać bezduszna", "nazywana zarówno bezduszną, jak i zimnokrwistą, jestem dla większości obojętna."],
    ["Postać sadystyczna", "niewiele rzeczy przynosi mi tyle radości, co cierpienie innych."],
    ["Postać uparta", "za nic się nie wycofuję."],
    ["Postać niestabilna", "często zmieniam zdanie, przez co moje zachowanie jest trudne do przewidzenia."],
    ["Postać mściwa", "bardzo wolno zapominam o urazach lub o kimś, kto wyrządza mi zło."],
    ["Postać wyrozumiała", "szybko radzę sobie z większością rzeczy."],
    ["Postać ekscentryczna", "moje zachowanie jest postrzegane przez innych jako nieobliczalne i irracjonalne."],
    ["Postać hałaśliwa", "jestem zawsze w ruchu, pełna energii i psot. Kiedy coś kombinuję, nierzadko zdarza się, że inni doznają obrażeń."],
    ["Postać czarująca", "z pewnością wiem, jak owijać ludzi wokół małego palca. Jestem słodka i sympatyczna, przez co często z różnych sytuacji uchodzę na sucho."],
    ["Postać ciekawska", "rzadko jest chwila ciszy. Ciągle zadając pytania, jestem ciekawa wszystkiego i wszystkich."],
    ["Postać zamyślona", "często jestem zamyślona, próbując zrozumieć otaczający mnie świat. Często polegam na książkach i systemach, aby nadać wszystkiemu sens."],
    ["Postać apodyktyczna", "często wydaję rozkazy innym. Chociaż zależy mi na tym, aby wszystko było zrobione dobrze, ważne jest jeszcze to, żeby było to zrobione w taki sposób jaki żądam."],
    ["Postać lojalna", "podchodzę do swoich relacji poważniej niż większość."],
    ["Postać nielojalna", "tam, gdzie większość ludzi widzi tylko znajomość, ja dostrzegam okazję."],
]);
