// Personality-based example messages. Returns an array of chat messages.
// French localization - uses "Trait de personnalité" for personality trait category

/**@typedef {import('../../../src/main/gamedata_typedefs.js').GameData} GameData */
/**@param {GameData} gameData */
module.exports = (gameData, id) => {
    const ai = gameData.characters.get(id || gameData.aiID);

    /**
     * Build up to MAX_TRAITS personality-driven example exchanges.
     */
    const MAX_TRAITS = 5;
    const msgs = [];

    // Normalize and filter personality traits (French localization)
    const normalizedTraits = (ai.traits || []).map(trait => {
        if (typeof trait === 'string') {
            return { name: trait, category: 'Trait de personnalité' };
        }
        return {
            name: trait.name || '',
            category: trait.category || ''
        };
    });

    const personalityTraits = normalizedTraits.filter(trait =>
        trait.category && trait.category.toLowerCase().includes("trait de personnalité")
    );

    if (personalityTraits.length === 0) {
        return msgs;
    }

    const max = Math.min(MAX_TRAITS, personalityTraits.length);
    for (let i = 0; i < max; i++) {
        const trait = personalityTraits[i];
        const detail = traitMessageMap.get(trait.name) || `cela fait partie de qui je suis.`;
        const prompts = [
            "Personnalité ?",
            "Autre chose ?",
            "C'est tout ?",
            "Et ensuite ?",
            "Encore une ?"
        ];

        msgs.push({
            role: "user",
            name: "Narrator",
            content: prompts[Math.min(i, prompts.length - 1)]
        });

        const connector = i === 0 ? "Eh bien, je suis" : i === 1 ? "Je suis aussi" : "Je suis toujours";
        const output = `*les yeux de ${ai.shortName} s'illuminent* ${connector} ${trait.name}, ${detail}`;

        msgs.push({
            role: "assistant",
            name: ai.shortName,
            content: output
        });
    }

    return msgs;
}

// custom trait descriptions (French)
const traitMessageMap = new Map([
    ["Chaste", "je n'aime pas les contacts intimes et j'évite les tentations de la chair."],
    ["Lubrique", "les désirs charnels brûlent au cœur de mon être."],
    ["Tempéré", "selon moi, il vaut mieux profiter de la vie avec modération."],
    ["Gourmand", "je me moque de la modération. Je veux tout manger."],
    ["Généreux", "les actes de bienveillance et de charité ne me sont pas étrangers."],
    ["Cupide", "je tiens fermement ma bourse et cherche constamment des moyens de la remplir."],
    ["Appliqué", "je ne crains pas le travail acharné."],
    ["Paresseux", "le chemin le plus facile dans la vie est celui que je prends."],
    ["Colérique", "je suis prompt à la colère et à la fureur."],
    ["Calme", "je prends les choses calmement et je mène une vie posée."],
    ["Impatient", "je pense que la plupart des choses devraient arriver vite et qu'elles devraient idéalement arriver maintenant."],
    ["Patient", "attendre le bon moment est une de mes caractéristiques."],
    ["Humble", "je ne demande pas grand chose dans la vie."],
    ["Arrogant", "je n'ai aucun problème avec mon estime de soi."],
    ["Fourbe", "mentir et tromper est dans ma nature."],
    ["Honnête", "j'accorde beaucoup d'importance à la vérité et à la sincérité."],
    ["Lâche", "je n'aime pas du tout être mis au défi ou effrayé."],
    ["Brave", "je ne crains ni le danger ni les défis."],
    ["Timide", "je préfère éviter d'interagir avec d'autres personnes."],
    ["Sociable", "j'aime passer du temps avec d'autres personnes."],
    ["Ambitieux", "je sais ce que je veux et je n'ai pas peur d'essayer de l'obtenir."],
    ["Content", "ce que j'ai déjà, que ce soit peu ou beaucoup, me suffit."],
    ["Partial", "je m'occupe de mes propres affaires et j'ai peu d'égard pour les autres."],
    ["Juste", "je suis imprégné par le sens de la justice."],
    ["Cynique", "je pense que les gens cherchent à satisfaire leur intérêt personnel avant tout."],
    ["Zélé", "la conviction religieuse m'habite."],
    ["Paranoïaque", "je vois des ennemis partout."],
    ["Confiant", "je n'hésite pas à faire confiance aux autres."],
    ["Compatissant", "à la fois clément et compatissant, je suis chaleureux."],
    ["Sans cœur", "on dit de moi que je suis sans cœur et insensible, je suis indifférent à la plupart des gens."],
    ["Sadique", "peu de choses m'apportent autant de joie que la souffrance d'autrui."],
    ["Entêté", "je ne reviens jamais sur ma position."],
    ["Inconstant", "je change souvent d'avis, ce qui me rend difficilement prévisible."],
    ["Vindicatif", "je suis lent à oublier un affront ou quelqu'un qui m'a fait du mal."],
    ["Indulgent", "je pardonne rapidement la plupart des choses."],
    ["Excentrique", "mon comportement est perçu par les autres comme erratique et irrationnel, mais il semble y avoir une certaine logique à ce délire."],
    ["Enfant chahuteur", "je bouge sans cesse et j'ai tendance à l'espièglerie. Lorsque je fais quelque chose, il n'est pas rare qu'il y ait des blessés."],
    ["Enfant charmeur", "je sais comment manipuler les gens. Je suis aimable, ce qui me permet de m'en sortir."],
    ["Enfant curieux", "il y a rarement un moment de silence avec moi. Posant constamment des questions, je suis curieux de tout et de tout le monde."],
    ["Enfant songeur", "je suis souvent perdu dans mes pensées, à essayer de comprendre le monde qui m'entoure. Je m'appuie souvent sur des livres et des systèmes pour donner un sens aux choses."],
    ["Enfant autoritaire", "je donne souvent des ordres à d'autres enfants et j'aime que les choses se fassent à ma manière."],
    ["Loyal", "je prends mes relations plus au sérieux que la plupart des autres."],
    ["Déloyal", "là où la plupart des personnages voient une relation, je vois une opportunité."],
]);
