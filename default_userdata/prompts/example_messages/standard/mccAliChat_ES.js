// Personality-based example messages. Returns an array of chat messages.
// Spanish localization - uses "Rasgo de personalidad" for personality trait category

/**@typedef {import('../../../src/main/gamedata_typedefs.js').GameData} GameData */
/**@param {GameData} gameData */
module.exports = (gameData, id) => {
    const ai = gameData.characters.get(id || gameData.aiID);

    /**
     * Build up to MAX_TRAITS personality-driven example exchanges.
     */
    const MAX_TRAITS = 5;
    const msgs = [];

    // Normalize and filter personality traits (Spanish localization)
    const normalizedTraits = (ai.traits || []).map(trait => {
        if (typeof trait === 'string') {
            return { name: trait, category: 'Rasgo de personalidad' };
        }
        return {
            name: trait.name || '',
            category: trait.category || ''
        };
    });

    const personalityTraits = normalizedTraits.filter(trait =>
        trait.category && trait.category.toLowerCase().includes("rasgo de personalidad")
    );

    if (personalityTraits.length === 0) {
        return msgs;
    }

    const max = Math.min(MAX_TRAITS, personalityTraits.length);
    for (let i = 0; i < max; i++) {
        const trait = personalityTraits[i];
        const detail = traitMessageMap.get(trait.name) || `esto es parte de quién soy.`;
        const prompts = [
            "¿Personalidad?",
            "¿Algo más?",
            "¿Es todo?",
            "¿Y más?",
            "¿Una más?"
        ];

        msgs.push({
            role: "user",
            name: "Narrator",
            content: prompts[Math.min(i, prompts.length - 1)]
        });

        const connector = i === 0 ? "Bueno, soy" : i === 1 ? "También soy" : "Sigo siendo";
        const output = `*los ojos de ${ai.shortName} se iluminan* ${connector} ${trait.name}, ${detail}`;

        msgs.push({
            role: "assistant",
            name: ai.shortName,
            content: output
        });
    }

    return msgs;
}

// custom trait descriptions (Spanish)
const traitMessageMap = new Map([
    ["Casto", "aborrezco el contacto íntimo y evito las tentaciones de la carne."],
    ["Concupiscente", "los deseos carnales arden en mi corazón."],
    ["Moderado", "según yo, es mejor disfrutar las cosas con moderación."],
    ["Voraz", "me burlo de la moderación; lo quiero todo."],
    ["Generoso", "los actos de benevolencia y caridad no me son ajenos."],
    ["Codicioso", "mantengo bien cerrada mi bolsa y siempre estoy buscando modos de engordarla."],
    ["Diligente", "no rehuyo el trabajo duro."],
    ["Vago", "el camino más fácil de la vida es el que más sigo."],
    ["Irascible", "me enfurezco e irritó con rapidez."],
    ["Calmo", "me tomo las cosas con calma y llevo una vida pausada."],
    ["Impaciente", "pienso que la mayoría de las cosas deberían pasar rápido, idealmente ya."],
    ["Paciente", "esperar y hacer tiempo es mi especialidad."],
    ["Humilde", "no le pido mucho a la vida."],
    ["Arrogante", "no tengo ningún problema sobre cuánto creo que valgo."],
    ["Falso", "mentir y engañar está en mi naturaleza."],
    ["Honesto", "valoro mucho la verdad y la sinceridad."],
    ["Pusilánime", "no disfruto en absoluto cuando me desafían o asustan."],
    ["Valiente", "desafíos o peligro, no temo a nada."],
    ["Tímido", "prefiero no interactuar con otras personas."],
    ["Gregario", "disfruto pasando tiempo con otras personas."],
    ["Ambicioso", "sé lo que quiero y no tengo miedo de intentar conseguirlo."],
    ["Satisfecho", "lo que ya tengo, sea mucho o poco, es suficiente para mí."],
    ["Arbitrario", "hago lo que me parece y tengo poca consideración por los demás."],
    ["Justo", "tengo un fuerte sentido de la justicia."],
    ["Cínico", "confío en el interés propio de los demás por encima de todo."],
    ["Ferviente", "la convicción religiosa arde con fuerza en mi corazón."],
    ["Paranoico", "veo enemigos en cada sombra."],
    ["Confiado", "suelo depositar enseguida mi fe en los demás."],
    ["Compasivo", "misericordioso y comprensivo, soy afectuoso."],
    ["Insensible", "calificado de cruel y despiadado, siento indiferencia hacia los demás."],
    ["Sádico", "pocas cosas causan más alegría que el sufrimiento ajeno."],
    ["Testarudo", "no doy marcha atrás en nada."],
    ["Inconstante", "cambio de idea muy a menudo, por lo que resulto muy difícil de predecir."],
    ["Revanchista", "tardo en olvidar afrentas o a cualquiera que me haya hecho mal."],
    ["Indulgente", "me apresuro a perdonar la mayoría de asuntos."],
    ["Excéntrico", "mi comportamiento es visto por los demás como errático e irracional, pero hay método en mi locura."],
    ["Pendenciero", "no paro un instante, lleno de energía y malicia. Cuando tramo algo, no es raro que otros salgan heridos."],
    ["Encantador", "sé ciertamente cómo lograr que la gente haga lo que quiero. Soy dulce y afable, lo que me permite salirme con la mía casi siempre."],
    ["Curioso", "no hay nunca un momento de silencio conmigo. Siempre haciendo preguntas, siento curiosidad por todo y por todos."],
    ["Pensativo", "a veces me pierdo en mi mundo, tratando de entender el mundo que me rodea. A menudo, me baso en libros y sistemas para darle sentido a todo."],
    ["Mandón", "se me suele ver dando órdenes a otros. Aunque me preocupa que las cosas se hagan bien, es igual de importante que se hagan a mi manera."],
    ["Leal", "me tomo mis relaciones con más seriedad que el resto."],
    ["Desleal", "donde la mayoría de la gente ve una relación, yo veo una oportunidad."],
]);
