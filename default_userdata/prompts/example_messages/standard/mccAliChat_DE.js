// Personality-based example messages. Returns an array of chat messages.
// German localization - uses "Persönlichkeitseigenschaft" for personality trait category

/**@typedef {import('../../../src/main/gamedata_typedefs.js').GameData} GameData */
/**@param {GameData} gameData */
module.exports = (gameData, id) => {
    const ai = gameData.characters.get(id || gameData.aiID);

    /**
     * Build up to MAX_TRAITS personality-driven example exchanges.
     */
    const MAX_TRAITS = 5;
    const msgs = [];

    // Normalize and filter personality traits (German localization)
    const normalizedTraits = (ai.traits || []).map(trait => {
        if (typeof trait === 'string') {
            return { name: trait, category: 'Persönlichkeitseigenschaft' };
        }
        return {
            name: trait.name || '',
            category: trait.category || ''
        };
    });

    const personalityTraits = normalizedTraits.filter(trait =>
        trait.category && trait.category.toLowerCase().includes("persönlichkeitseigenschaft")
    );

    if (personalityTraits.length === 0) {
        return msgs;
    }

    const max = Math.min(MAX_TRAITS, personalityTraits.length);
    for (let i = 0; i < max; i++) {
        const trait = personalityTraits[i];
        const detail = traitMessageMap.get(trait.name) || `das ist Teil von dem, wer ich bin.`;
        const prompts = [
            "Persönlichkeit?",
            "Noch etwas?",
            "Ist das alles?",
            "Und weiter?",
            "Noch eins?"
        ];

        msgs.push({
            role: "user",
            name: "Narrator",
            content: prompts[Math.min(i, prompts.length - 1)]
        });

        const connector = i === 0 ? "Nun, ich bin" : i === 1 ? "Ich bin auch" : "Ich bin immer noch";
        const output = `*${ai.shortName}s Augen leuchten auf* ${connector} ${trait.name}, ${detail}`;

        msgs.push({
            role: "assistant",
            name: ai.shortName,
            content: output
        });
    }

    return msgs;
}

// custom trait descriptions (German)
const traitMessageMap = new Map([
    ["Keusch", "ich habe keinen Gefallen an intimen Kontakten und meide die Verlockungen des Fleisches."],
    ["Lüstern", "fleischliche Gelüste lodern tief in meinem Herzen."],
    ["Maßvoll", "meiner Meinung nach ist es am besten, sämtliche Dinge nur in verträglichen Dosen zu genießen."],
    ["Unersättlich", "ich kann über Mäßigung nur lachen: Ich will einfach alles."],
    ["Großzügig", "Akte der Wohl- und Mildtätigkeit sind mir nicht fremd."],
    ["Gierig", "ich habe meinen Geldbeutel gut im Griff und suche ständig nach Wegen, ihn noch praller zu füllen."],
    ["Fleißig", "ich scheue vor harter Arbeit nicht zurück."],
    ["Faul", "ich entscheide mich zumeist für den Weg des geringsten Widerstands."],
    ["Zornig", "ich werde leicht ärgerlich und wütend."],
    ["Ruhig", "ich sehe die Dinge gelassen und führe ein geruhsames Leben."],
    ["Ungeduldig", "ich bin der festen Überzeugung, dass die meisten Dinge schnell vonstattengehen sollten – und zwar sofort."],
    ["Geduldig", "den richtigen Moment abzuwarten, ist ein besonderes Talent von mir."],
    ["Demütig", "ich verlange nicht viel vom Leben."],
    ["Arrogant", "ich habe keine Schwierigkeiten mit dem eigenen Selbstwert."],
    ["Hinterlistig", "Lügen und Betrügen liegen in meiner Natur."],
    ["Ehrlich", "ich messe Wahrhaftigkeit und Aufrichtigkeit einen hohen Wert bei."],
    ["Feige", "ich mag es überhaupt nicht, herausgefordert oder eingeschüchtert zu werden."],
    ["Tapfer", "ob nun Herausforderungen oder Gefahren: Ich fürchte nichts."],
    ["Schüchtern", "ich ziehe es vor, den Umgang mit anderen Menschen zu meiden."],
    ["Gesellig", "ich verbringe gern Zeit mit anderen Menschen."],
    ["Ehrgeizig", "ich weiß, was ich will, und ich habe keine Angst davor, einen Versuch zu unternehmen, es auch zu bekommen."],
    ["Zufrieden", "mir reicht, was ich habe – ob das nun viel oder wenig ist."],
    ["Eigenwillig", "ich mache mein eigenes Ding und habe nur wenig Achtung vor anderen."],
    ["Gerecht", "ich habe einen stark ausgeprägten Gerechtigkeitssinn."],
    ["Zynisch", "ich glaube zuvörderst an den Eigensinn anderer Menschen."],
    ["Religiöser Eiferer", "im Wesenskern von mir brennt eine tiefe religiöse Überzeugung."],
    ["Paranoid", "ich sehe mich ständig von Feinden umringt."],
    ["Treuherzig", "ich vertraue anderen rasch."],
    ["Mitfühlend", "ich bin warmherzig und zeige stets Mitleid und Anteilnahme."],
    ["Gefühllos", "ich werde oft herzlos und kaltblütig genannt und stehe den meisten Dingen gleichgültig gegenüber."],
    ["Sadistisch", "nur wenige Dinge bringen mir so viel Freude wie das Leid anderer Menschen."],
    ["Stur", "ich gebe niemals nach."],
    ["Sprunghaft", "ich entscheide mich ständig in allem um, was mein Verhalten schwierig vorherzusagen macht."],
    ["Rachsüchtig", "ich bin nachtragend, was Kränkungen anbelangt, und vergesse es nur langsam, wenn mir jemand Unrecht angetan hat."],
    ["Nachsichtig", "ich lasse schlimme Dinge schnell hinter mir."],
    ["Exzentrisch", "mein Verhalten wird von anderen als unberechenbar und unvernünftig gesehen, doch mein Wahnsinn scheint Methode zu haben."],
    ["Rauflustig", "ich bin immer in Bewegung, stecke voller Tatendrang und habe den Schalk im Nacken. Wenn ich etwas aushecke, kommt es nicht selten vor, dass andere dadurch Schaden nehmen."],
    ["Reizend", "ich weiß auf jeden Fall, wie man die Leute um den Finger wickelt. Ich bin süß und liebenswert, was es mir erlaubt, mit nahezu allem durchzukommen."],
    ["Neugierig", "mit mir gibt es kaum ruhige Momente. Ich stelle ständig Fragen und bin wissbegierig in Bezug auf alles und jeden."],
    ["Nachdenklich", "ich bin oft gedankenverloren, weil ich versuche, die Welt um mich herum zu begreifen. Ich verlasse mich oft auf Bücher und feste Regeln, um einen Sinn in den Dingen zu finden."],
    ["Herrisch", "man kann mich oft dabei beobachten, wie ich andere herumkommandiere. Es geht mir zwar auch darum, dass alles richtig gemacht wird, aber es ist mir genauso wichtig, den eigenen Willen zu bekommen."],
    ["Loyal", "ich nehme meine Beziehungen ernster als die meisten."],
    ["Untreu", "wo die meisten Menschen eine Beziehung sehen, sehe ich eine Gelegenheit."],
]);
