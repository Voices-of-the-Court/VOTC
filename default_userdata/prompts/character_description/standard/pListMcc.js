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
    if(locationController === player.fullName){
        locationController = player.shortName;
    }
    else if(locationController === mainChar.fullName){
        locationController = mainChar.shortName;
    }
    const scene = gameData.scene;
    
    // current character as primary scope
    const current = mainChar;

    let currentPersona = buildPersona(current, true);
    let otherPersonas = [];

    if (gameData.characters.size > 1){
        gameData.characters.forEach((value, key) => {
            if(key !== current.id){
                otherPersonas.push(buildPersona(value, false));
            }
        })
    }

    const allBlocks = [
        `[${current.shortName}'s Persona: ${currentPersona.join("; ")}]`,
        ...otherPersonas.map(p => `[${p.shortName}'s Persona: ${p.items.join("; ")}]`)
    ];

    const scenarioLine = `[date(${date}), location(${location}), scenario(${scenario()})]`;

    return "\n" + allBlocks.join("\n") + "\n" + scenarioLine;

    function buildPersona(char, isCurrent){
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
            incomeLine(char, isCurrent),
            treasuryLine(char, isCurrent),
            influenceLine(char, isCurrent),
            herdLine(char, isCurrent),
            secretsLine(char, isCurrent),
            knownSecretsLine(char, isCurrent),
            modifiersLine(char, isCurrent),
            lawsLine(char, isCurrent),
            memoriesLine(char, isCurrent),
            listRelationsToPlayer(char), 
            listRelationsToCharacters(char),
            listOpinionsToCharacters(char),
            `faith (${char.faith})`, 
            `culture (${char.culture})`,
            `title(${char.titleRankConcept || 'N/A'})`,
            `capital(${char.capitalLocation || 'N/A'})`,
            `sex(${char.sexuality || 'unknown'})`
        ].filter(Boolean);

        return isCurrent ? items : { shortName: char.shortName, items };
    }
    
    function mainPosition(char){
        if(isLandlessAdventurer(char)){
            if(char.isRuler){
                return `Leader of ${char.primaryTitle}, a group of ${char.liegeRealmLaw}`
            }
            else{
                return `A follower of ${char.liege}, they are a group of ${char.liegeRealmLaw}`
            }
        }
        else if(char.isLandedRuler){
            if(char.isIndependentRuler){
                return `Independent ruler of ${char.primaryTitle}`
            }
            else{
                return `Ruler of ${char.primaryTitle}, vassal of ${char.liege}`
            }
            
        }
        else if(char.isKnight){
            return `Knight of ${char.liege}`
        }        
    }

    function courtAndCouncilPositions(char){
        if(char.heldCourtAndCouncilPositions){
            return `${char.heldCourtAndCouncilPositions} of ${char.liege}`
        }
        else{
            return ``
        }
    }

    function houseAndStatus(char){
        let output="";
        if(char.house){
            output+="noble";
        }
        else{
            output+="lowborn ";
        }
    
        if(char.sheHe === "she"){
            output+= "woman";
        }
        else if(char.sheHe === "he"){
            output+= "man";
        }

        if(char.house){
            output+=` of house ${char.house}`
        }
    
        return output;
    }

    function opinion(char){
        const op = char.opinionOfPlayer;

        if(op>60){
            return `${char.shortName} has a very favorable opinion of ${player.shortName}`
        }
        else if(op>20){
            return `${char.shortName} has a slightly positive opinion of ${player.shortName}`
        }
        else if(op>-20){
            return `${char.shortName} has a neutral opinion of ${player.shortName}`
        }
        else if(op>-60){
            return `${char.shortName} has a slight hatred towards ${player.shortName}`
        }
        else{
             return `${char.shortName} has a very strong hatred towards ${player.shortName}`
        }
    }
    
    
    function greedines(char){
        if(char.greed>75){
            return "very greedy";
        }
        else if(char.greed>50){
            return "greedy";
        }
        else if(char.greed>25){
            return "slightly greedy";
        }
        else{
            return null;
        }
    }
    
    function marriage(char){
        if(char.consort){
            if(char.consort == player.fullName){
                return `married to ${player.shortName}`;
            }
            else if(char.consort == mainChar.fullName){
                return `married to ${mainChar.shortName}`;
            }
            else{
                return `married to ${char.consort}`
            }
        }
        else{
            return `unmarried`;
        }
    }
    
    function otherTraits(char, isCurrent){
        const traits = (char.traits || []).filter((trait) => trait.category != "Personality Trait");
        if (traits.length === 0) return null;
        const top = isCurrent ? traits : traits.slice(0, 3);
        const traitNames = top.map(trait => trait.name);
    
        let output = "traits("
        output+= traitNames.join(", ");
        output+=")";
    
        return output;
    }
    
    function personalityTraits(char, isCurrent){
        const personalityTraits = filterTraitsToCategory(char.traits || [], "Personality Trait");
        if (personalityTraits.length === 0) return null;
        const top = isCurrent ? personalityTraits.slice(0, 5) : personalityTraits.slice(0, 3);
        const traitNames = top.map(trait => trait.name);
    
        let output = "personality("
        output+= traitNames.join(", ");
        output+=")";
    
        return output;
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
                        relationTypes = relationTypes.replace("your", gameData.playerName+"'s");
                    }
                    return `${char.shortName} is ${relationTypes} for ${targetCharacter.shortName}`;
                } else {
                    return `${char.shortName} has relations to an unknown character (ID: ${relation.id})`;
                }
            });
        return lines.slice(0, 3).join(' | ');
    }


    function listOpinionsToCharacters(char) {
        if (gameData.characters.size <= 2 || !char.opinions || char.opinions.length === 0) {
            return null; // Not enough characters to analyze opinions
        }  
        const lines = char.opinions
            .map(opinionData => {
                const targetCharacter = gameData.characters.get(opinionData.id);
                if (targetCharacter && targetCharacter.id !== char.id && targetCharacter.id !== player.id) {
                    const op = opinionData.opinon; // Opinion score
                    if (op > 60) {
                        return `${char.shortName} has a very favorable opinion of ${targetCharacter.shortName}`;
                    } else if (op > 20) {
                        return `${char.shortName} has a slightly positive opinion of ${targetCharacter.shortName}`;
                    } else if (op > -20) {
                        return `${char.shortName} has a neutral opinion of ${targetCharacter.shortName}`;
                    } else if (op > -60) {
                        return `${char.shortName} has a slight hatred towards ${targetCharacter.shortName}`;
                    } else {
                        return `${char.shortName} has a very strong hatred towards ${targetCharacter.shortName}`;
                    }
                } else {
                    return `${char.shortName} has an opinion about an unknown character (ID: ${opinionData.id})`;
                }
            });
        return lines.slice(0, 3).join(' | ');
    }
    
        
    function listRelationsToPlayer(char){
        if(!char.relationsToPlayer || char.relationsToPlayer.length === 0){
            return null;
        }
        else{
            return `${char.shortName} is the ${char.relationsToPlayer.join(', ')} of ${player.shortName}`;
        }
    }


    function scenario(){
        switch (scene){
            case "throneroom":
                return `${mainChar.shortName} meets ${player.shortName} in ${locationController}'s throneroom.`;
            case "garden":
                return `${mainChar.shortName} meets ${player.shortName} in ${locationController}'s castle garden.`;
            case "bedchamber":
                return `${mainChar.shortName} meets ${player.shortName} in their private bedchamber.`;
            case "feast":
                return `${mainChar.shortName} talks to ${player.shortName} during the feast hosted by ${locationController}.`;
            case "army_camp":
                return `${mainChar.shortName} meets ${player.shortName} in the army camp.`;
            case "hunt":
                return `${mainChar.shortName} meets ${player.shortName} while hunting in the foggy forest. Their weapons are bows.`;
            case "dungeon":
                return `${mainChar.shortName} meets ${player.shortName} in the dungeon, where ${mainChar.shortName} is held as a prisoner.`;
            case "alley":
                return `${mainChar.shortName} meets ${player.shortName} in the narrow alley, hidden from everyone`;
        }
    }

    function goldStatus(char) {
        const gold = char.gold;
        if (gold >= 500) {
            return `${char.shortName} is wealthy (gold: ${gold})`;
        } else if (gold > 100) {
            return `${char.shortName} is comfortable (gold: ${gold})`;
        } else if (gold > 50) {
            return `${char.shortName} is poor (gold: ${gold})`;
        } else if (gold > 0) {
            return `${char.shortName} is struggling (gold: ${gold})`;
        } else if (gold === 0) {
            return `${char.shortName} has no gold`;
        } else {
            // Character is in debt
            if (gold < -100) {
                return `${char.shortName} has great debt (gold: ${gold})`;
            } else {
                return `${char.shortName} has little debt (gold: ${gold})`;
            }
        }
    }
    
    function age(char) {
        const age = char.age;
    
        if (age < 3) {
            return `${char.shortName} is an infant, unable to speak but quick to babble, cry, or smile to convey needs. They spend their time observing and reaching out for what's near.`;
        } else if (age < 6) {
            return `${char.shortName} is a small child, learning to speak in simple phrases and curious about their surroundings. They play often, imitating the actions of adults with innocence and energy.`;
        } else if (age < 10) {
            return `${char.shortName} is a child, capable of speaking clearly and enjoying games or tales. They understand basic duties and may help with simple tasks, but they still rely heavily on guidance.`;
        } else if (age < 13) {
            return `${char.shortName} is a preteen, beginning to take on minor tasks or skills training. They speak with more confidence and show a budding sense of duty, often eager to earn approval from elders.`;
        } else if (age < 16) {
            return `${char.shortName} is an adolescent, showing independence in their speech and actions. They are likely training for future duties and may show pride in taking on early responsibilities.`;
        } else if (age < 20) {
            return `${char.shortName} is a young adult, confident and often ready to make decisions. They handle day-to-day responsibilities, and their speech reflects a mix of ambition and youthfulness.`;
        } else if (age < 30) {
            return `${char.shortName} is a mature young adult, acting with intent and clarity. They often balance work and personal matters independently, speaking with purpose and conviction.`;
        } else if (age < 40) {
            return `${char.shortName} is experienced and settled in their ways. Their speech is straightforward, and they carry out their tasks steadily, with reliability.`;
        } else if (age < 60) {
            return `${char.shortName} is a seasoned adult, deliberate in both speech and action. They carry a quiet confidence and tend to offer advice or guidance to those younger.`;
        } else {
            return `${char.shortName} is an elder, often reflective and thoughtful. They may be more reserved, speaking only when necessary, but carry a calm presence that reflects a life of experience.`;
        }
    }
    
    function stressLine(char, isCurrent){
        if (!char.stress) return null;
        if (!isCurrent) return `stress(level ${char.stress.level})`;
        return `stress(value ${char.stress.value}, level ${char.stress.level}, progress ${char.stress.progress})`;
    }

    function describeProwess(char){
        const p = char.prowess ?? 0;
        if (p >= 15) return `prowess(${p}, formidable warrior)`;
        if (p >= 10) return `prowess(${p}, skilled combatant)`;
        if (p >= 5) return `prowess(${p}, trained fighter)`;
        if (p > 0) return `prowess(${p}, inexperienced fighter)`;
        return `prowess(${p}, non-combatant)`;
    }

    function legitimacyLine(char, isCurrent){
        if (!char.legitimacy) return null;
        const { value, level, type } = char.legitimacy;
        return isCurrent ? `legitimacy(${type}, level ${level}, value ${value.toFixed ? value.toFixed(2) : value})` : `legitimacy(level ${level})`;
    }

    function troopsLine(char, isCurrent){
        if (!char.troops) return null;
        const total = char.troops.totalOwnedTroops ?? 0;
        if (!isCurrent) return `troops(total ${total})`;
        const regiments = (char.troops.maaRegiments || []).slice(0,3).map(r => `${r.name}:${r.menAlive}${r.isPersonal?'(personal)':''}`).join(', ');
        return `troops(total ${total}, maa[${regiments}])`;
    }

    function incomeLine(char, isCurrent){
        if (!char.income) return null;
        const { gold, balance, balanceBreakdown } = char.income;
        return isCurrent ? `income(gold ${gold}, balance ${balance}; ${balanceBreakdown.replace(/\\s+/g,' ').trim()})` : `income(balance ${balance})`;
    }

    function treasuryLine(char, isCurrent){
        if (!char.treasury) return null;
        const { amount, tooltip } = char.treasury;
        return isCurrent ? `treasury(${amount}; ${tooltip.replace(/\\s+/g,' ').trim()})` : `treasury(${amount})`;
    }

    function influenceLine(char, isCurrent){
        if (!char.influence) return null;
        const { amount, tooltip } = char.influence;
        return isCurrent ? `influence(${amount}; ${tooltip.replace(/\\s+/g,' ').trim()})` : `influence(${amount})`;
    }

    function herdLine(char, isCurrent){
        if (!char.herd) return null;
        const { amount, breakdown } = char.herd;
        return isCurrent ? `herd(${amount}; ${breakdown.replace(/\\s+/g,' ').trim()})` : `herd(${amount})`;
    }

    function secretsLine(char, isCurrent){
        if (!char.secrets || char.secrets.length === 0) return null;
        const list = (isCurrent ? char.secrets : char.secrets.slice(0,2)).map(s => `${s.name}${s.category?`(${s.category})`:''}`).join(', ');
        return `secrets(${list})`;
    }

    function knownSecretsLine(char, isCurrent){
        if (!char.knownSecrets || char.knownSecrets.length === 0) return null;
        const list = (isCurrent ? char.knownSecrets : char.knownSecrets.slice(0,2)).map(s => `${s.name}${s.ownerName?` of ${s.ownerName}`:''}`).join(', ');
        return `knownSecrets(${list})`;
    }

    function modifiersLine(char, isCurrent){
        if (!char.modifiers || char.modifiers.length === 0) return null;
        const list = (isCurrent ? char.modifiers : char.modifiers.slice(0,3)).map(m => m.name).join(', ');
        return `modifiers(${list})`;
    }

    function lawsLine(char, isCurrent){
        if (!char.laws || char.laws.length === 0) return null;
        const list = (isCurrent ? char.laws : char.laws.slice(0,3)).map(l => l.name).join(', ');
        return `laws(${list})`;
    }

    function memoriesLine(char, isCurrent){
        if (!char.memories || char.memories.length === 0) return null;
        const sorted = [...char.memories].sort((a,b)=> b.relevanceWeight - a.relevanceWeight);
        const pick = isCurrent ? sorted.slice(0,5) : sorted.slice(0,3);
        return `memories(${pick.map(m => `${m.type}:${m.desc}`).join(' | ')})`;
    }
    }
    
    
    //help functions
    
    function filterTraitsToCategory(traits, category){
        return traits.filter((trait) => trait.category == category);
    }

    function isLandlessAdventurer(char){
        const landlessLaws = ["Wanderers", "Swords-for-Hire", "Scholars", "Explorers", "Freebooters", "Legitimists"]
        return landlessLaws.includes(char.liegeRealmLaw);
    }
