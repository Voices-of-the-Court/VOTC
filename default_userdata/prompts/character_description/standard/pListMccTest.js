// Detailed persona builder supporting multiple characters in conversation.
// Exports a function (gameData, currentCharacterId?) => string

/**@typedef {import('../../../src/main/gamedata_typedefs.js').GameData} GameData */
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
    
    // current character as primary scope
    const current = mainChar;

    let currentPersona = buildPersona(current, true);
    let otherPersonas = [];

    if (gameData.characters.size > 1) {
        gameData.characters.forEach((value, key) => {
            if (key !== current.id) {
                otherPersonas.push(buildPersona(value, false));
            }
        })
    }

    const allBlocks = [
        `[${current.shortName}'s Persona (Current Speaker): ${currentPersona.join("; ")}]`,
        ...otherPersonas.map(p => `[${p.shortName}'s Persona: ${p.items.join("; ")}]`)
    ];

    const scenarioLine = `[date(${date}), location(${location}), scenario(${scenario()})]`;

    return "\n" + allBlocks.join("\n") + "\n" + scenarioLine;

    function buildPersona(char, isCurrent) {
        // Items are filtered; nulls are removed.
        const items = [
            `id(${char.id})`,
            mainPosition(char),
            courtAndCouncilPositions(char),
            houseAndStatus(char),
            personalityTraits(char, isCurrent),
            otherTraits(char, isCurrent),
            marriage(char),
            describeProwess(char),
            goldStatus(char),
            age(char),
            stressLine(char, isCurrent),
            legitimacyLine(char, isCurrent),
            troopsLine(char, isCurrent),
            // Resource lines hidden for others to preserve Fog of War
            incomeLine(char, isCurrent),
            treasuryLine(char, isCurrent),
            influenceLine(char, isCurrent),
            herdLine(char, isCurrent),
            // Secrets hidden for others
            secretsLine(char, isCurrent),
            knownSecretsLine(char, isCurrent),
            modifiersLine(char, isCurrent),
            lawsLine(char, isCurrent),
            memoriesLine(char, isCurrent),
            familyLine(char, isCurrent),
            listRelationsToPlayer(char),
            listRelationsToCharacters(char), // Includes relations to others
            listOpinionsToCharacters(char), // Textual opinions
            opinionOfPlayer(char), // Textual opinion of player
            `faith (${char.faith})`,
            `culture (${char.culture})`,
            `title(${char.titleRankConcept || 'N/A'})`,
            `capital(${char.capitalLocation || 'N/A'})`,
            `sex(${char.sexuality || 'unknown'})`
        ].filter(Boolean);

        return isCurrent ? items : {
            shortName: char.shortName,
            items
        };
    }

    // --- Position & Status ---

    function mainPosition(char) {
        if (isLandlessAdventurer(char)) {
            if (char.isRuler) {
                return `Leader of ${char.primaryTitle} (${char.liegeRealmLaw})`;
            } else {
                return `A follower of ${char.liege} (${char.liegeRealmLaw})`;
            }
        } else if (char.isLandedRuler) {
            if (char.isIndependentRuler) {
                return `Independent ruler of ${char.primaryTitle}`;
            } else {
                return `Ruler of ${char.primaryTitle}, vassal of ${char.liege}`;
            }
        } else if (char.isKnight) {
            return `Knight of ${char.liege}`;
        }
        return `Subject of ${char.liege}`;
    }

    function courtAndCouncilPositions(char) {
        if (char.heldCourtAndCouncilPositions) {
            return `${char.heldCourtAndCouncilPositions} of ${char.liege}`;
        }
        return null;
    }

    function houseAndStatus(char) {
        let output = char.house ? "noble " : "lowborn ";
        output += (char.sheHe === "she" ? "woman" : "man");
        if (char.house) {
            output += ` of house ${char.house}`;
        }
        return output;
    }

    // --- Opinions & Relations ---

    function getOpinionDescription(score) {
        if (score > 60) return "devoted to";
        if (score > 20) return "friendly toward";
        if (score > -20) return "neutral toward";
        if (score > -60) return "dislikes";
        return "hates";
    }

    function opinionOfPlayer(char) {
        if (char.id === player.id) return null;
        const desc = getOpinionDescription(char.opinionOfPlayer);
        return `opinion_of_player(${desc})`;
    }

    function listOpinionsToCharacters(char) {
        if (gameData.characters.size <= 2 || !char.opinions || char.opinions.length === 0) {
            return null;
        }
        const lines = char.opinions
            .map(opinionData => {
                const targetCharacter = gameData.characters.get(opinionData.id);
                // Exclude self and player (handled separately)
                if (targetCharacter && targetCharacter.id !== char.id && targetCharacter.id !== player.id) {
                    const desc = getOpinionDescription(opinionData.opinon);
                    return `${char.shortName} is ${desc} ${targetCharacter.shortName}`;
                }
                return null;
            })
            .filter(Boolean);
            
        return lines.length > 0 ? `opinions[${lines.slice(0, 3).join(' | ')}]` : null;
    }

    function listRelationsToCharacters(char) {
        if (!char.relationsToCharacters || char.relationsToCharacters.length === 0) {
            return null;
        }
        const lines = char.relationsToCharacters
            .map(relation => {
                const targetCharacter = gameData.characters.get(relation.id);
                if (targetCharacter) {
                    let relationTypes = relation.relations.join(', ');
                    if (relationTypes.includes("your")) {
                        relationTypes = relationTypes.replace("your", gameData.playerName + "'s");
                    }
                    return `${char.shortName} is ${relationTypes} to ${targetCharacter.shortName}`;
                }
                return null;
            })
            .filter(Boolean);
            
        return lines.length > 0 ? `relations[${lines.slice(0, 3).join(' | ')}]` : null;
    }

    function listRelationsToPlayer(char) {
        if (!char.relationsToPlayer || char.relationsToPlayer.length === 0) {
            return null;
        }
        return `${char.shortName} is ${char.relationsToPlayer.join(', ')} to ${player.shortName}`;
    }

    function marriage(char) {
        if (!char.consort) return `unmarried`;
        
        let spouseName = char.consort;
        if (char.consort === player.fullName) spouseName = player.shortName;
        else if (char.consort === mainChar.fullName) spouseName = mainChar.shortName;
        
        return `married to ${spouseName}`;
    }

    // --- Stats & Attributes ---

    function greediness(char) {
        if (char.greed > 75) return "very greedy";
        if (char.greed > 50) return "greedy";
        if (char.greed > 25) return "slightly greedy";
        return null;
    }

    function otherTraits(char, isCurrent) {
        const traits = (char.traits || []).filter((trait) => trait.category != "Personality Trait");
        if (traits.length === 0) return null;
        // Limit traits for others to keep prompt clean
        const top = isCurrent ? traits : traits.slice(0, 3);
        return `traits(${top.map(t => t.name).join(", ")})`;
    }

    function personalityTraits(char, isCurrent) {
        const pTraits = filterTraitsToCategory(char.traits || [], "Personality Trait");
        if (pTraits.length === 0) return null;
        
        const top = isCurrent ? pTraits.slice(0, 5) : pTraits.slice(0, 3);
        const greed = greediness(char);
        const names = top.map(t => t.name);
        if (greed) names.push(greed);
        
        return `personality(${names.join(", ")})`;
    }

    function describeProwess(char) {
        const p = char.prowess ?? 0;
        if (p >= 15) return `prowess(Formidable Warrior)`;
        if (p >= 10) return `prowess(Skilled Combatant)`;
        if (p >= 5) return `prowess(Trained Fighter)`;
        if (p > 0) return `prowess(Inexperienced Fighter)`;
        return `prowess(Non-combatant)`;
    }

    function goldStatus(char) {
        const gold = char.gold;
        if (gold >= 500) return `wealthy`;
        if (gold > 100) return `comfortable`;
        if (gold > 50) return `poor`;
        if (gold >= 0) return `struggling`;
        if (gold < -100) return `in great debt`;
        return `in debt`;
    }

    function age(char) {
        // Simplified age descriptor for token efficiency
        const age = char.age;
        let stage = "Adult";
        if (age < 3) stage = "Infant";
        else if (age < 10) stage = "Child";
        else if (age < 16) stage = "Adolescent";
        else if (age < 30) stage = "Young Adult";
        else if (age < 50) stage = "Adult";
        else if (age < 65) stage = "Mature Adult";
        else stage = "Elder";
        
        return `age(${age}, ${stage})`;
    }

    // --- Resources & Logic (Fog of War) ---

    function stressLine(char, isCurrent) {
        if (!char.stress) return null;
        
        const level = char.stress.level;
        let desc = "Composed";
        if (level === 1) desc = "Stressed";
        if (level === 2) desc = "Overwhelmed";
        if (level >= 3) desc = "Near Mental Break";

        // Current character gets full details
        if (isCurrent) {
            return `stress(value ${char.stress.value}, level ${level}, ${desc})`;
        }
        // Others only get the visible state
        return `stress(${desc})`;
    }

    function legitimacyLine(char, isCurrent) {
        if (!char.legitimacy) return null;
        // Legitimacy is abstract; others can roughly sense it (level), 
        // but current char knows exact value.
        const { value, level, type } = char.legitimacy;
        return `legitimacy(${type}, level ${level}, value ${value.toFixed ? value.toFixed(1) : value})`
    }

    function troopsLine(char, isCurrent) {
        if (!char.troops) return null;
        const total = char.troops.totalOwnedTroops ?? 0;
        
        // Others only see total count (Fog of War)
        if (!isCurrent) return `troops(approx. ${total})`;
        
        // Current character sees breakdown of personal regiments
        const regiments = (char.troops.maaRegiments || [])
            .filter(r => r.isPersonal)
            .slice(0, 4) // limit to avoid prompt bloat
            .map(r => `${r.name}:${r.menAlive}`)
            .join(', ');
            
        return `troops(total ${total}${regiments ? `, maa[${regiments}]` : ''})`;
    }

    function incomeLine(char, isCurrent) {
        // if (!isCurrent || !char.income) return null; // Hidden for others
        const { gold, balance } = char.income;
        return `income(gold ${gold}, monthly ${balance > 0 ? '+' : ''}${balance})`;
    }

    function treasuryLine(char, isCurrent) {
        // if (!isCurrent || !char.treasury) return null; // Hidden for others
        return `treasury_items(${char.treasury.amount})`;
    }

    function influenceLine(char, isCurrent) {
        // if (!isCurrent || !char.influence) return null; // Hidden for others
        return `influence(${char.influence.amount})`;
    }

    function herdLine(char, isCurrent) {
        // if (!isCurrent || !char.herd) return null; // Hidden for others
        return `herd(${char.herd.amount})`;
    }

    function secretsLine(char, isCurrent) {
        // STRICT FOG OF WAR: Only current character knows their own secrets
        if (!isCurrent) return null;
        if (!char.secrets || char.secrets.length === 0) return null;
        
        const list = char.secrets.map(s => `${s.name}(${s.category})`).join(', ');
        return `my_secrets(${list})`;
    }

    function knownSecretsLine(char, isCurrent) {
        // STRICT FOG OF WAR: Only current character sees what they know
        if (!isCurrent) return null;
        if (!char.knownSecrets || char.knownSecrets.length === 0) return null;
        
        const list = char.knownSecrets.map(s => `Known secret: ${s.name} of ${s.ownerName}`).join(', ');
        return `secrets_known_about_others(${list})`;
    }

    function modifiersLine(char, isCurrent) {
        if (!char.modifiers || char.modifiers.length === 0) return null;
        const list = char.modifiers.map(m => m.name).join(', ');
        return `modifiers(${list})`;
    }

    function lawsLine(char, isCurrent) {
        if (!char.laws || char.laws.length === 0) return null;
        const list = char.laws.slice(0, 3).map(l => l.name).join(', ');
        return `laws(${list})`;
    }

    function memoriesLine(char, isCurrent) {
        if (!char.memories || char.memories.length === 0) return null;
        const sorted = [...char.memories].sort((a, b) => b.relevanceWeight - a.relevanceWeight);
        const pick = isCurrent ? sorted.slice(0, 5) : sorted.slice(0, 3);
        
        // Memories help context, even for others (recent public events), but avoid deep internal thoughts if possible
        // Assuming memory 'desc' is what actually happened.
        return `recent_memories(${pick.map(m => `"${m.desc}"`).join(' | ')})`;
    }

    function familyLine(char, isCurrent) {
        // Only show family info for current character
        // if (!isCurrent) return null;
        
        const parts = [];
        
        if (char.parents && char.parents.length > 0) {
            const parentsList = char.parents
                .map(p => `${p.name}${p.deathDate ? ` (died ${p.deathDate})` : ''}`)
                .join(', ');
            parts.push(`parents: ${parentsList}`);
        }
        
        if (char.siblings && char.siblings.length > 0) {
            const siblingsList = char.siblings
                .map(s => {
                    const status = s.sheHe === "he" ? "brother" : "sister";
                    const death = s.deathDate ? ` (died ${s.deathDate})` : "";
                    return `${s.name} (${status}${death})`;
                })
                .join(', ');
            parts.push(`siblings: ${siblingsList}`);
        }
        
        if (char.children && char.children.length > 0) {
            const childrenList = char.children
                .map(c => {
                    const status = c.sheHe === "he" ? "son" : "daughter";
                    const death = c.deathDate ? ` (died ${c.deathDate})` : "";
                    return `${c.name} (${status}${death})`;
                })
                .join(', ');
            parts.push(`children: ${childrenList}`);
        }
        
        return parts.length > 0 ? `family(${parts.join('; ')})` : null;
    }

    // --- Scenario ---

    function scenario() {
        switch (scene) {
            case "throneroom":
                return `${mainChar.shortName} is in ${locationController}'s throneroom with ${player.shortName}.`;
            case "garden":
                return `${mainChar.shortName} meets ${player.shortName} in ${locationController}'s castle garden.`;
            case "bedchamber":
                return `${mainChar.shortName} is in the private bedchamber with ${player.shortName}.`;
            case "feast":
                return `${mainChar.shortName} talks to ${player.shortName} during a feast hosted by ${locationController}.`;
            case "army_camp":
                return `${mainChar.shortName} is in the army camp with ${player.shortName}.`;
            case "hunt":
                return `${mainChar.shortName} is hunting with ${player.shortName} in a foggy forest.`;
            case "dungeon":
                return `${mainChar.shortName} is in the dungeon with ${player.shortName}.`;
            case "alley":
                return `${mainChar.shortName} meets ${player.shortName} in a narrow, hidden alley.`;
            default:
                return `${mainChar.shortName} meets ${player.shortName} in ${scene}.`;
        }
    }

    // --- Helpers ---

    function filterTraitsToCategory(traits, category) {
        return traits.filter((trait) => trait.category == category);
    }

    function isLandlessAdventurer(char) {
        const landlessLaws = ["Wanderers", "Swords-for-Hire", "Scholars", "Explorers", "Freebooters", "Legitimists"];
        return landlessLaws.includes(char.liegeRealmLaw);
    }
}
