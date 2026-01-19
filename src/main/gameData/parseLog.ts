import { GameData, Memory, Trait, OpinionModifier, Secret, KnownSecret, SecretTarget, SecretKnower, Modifier, Stress, Legitimacy, Troops, MAARegiment, Law} from "./GameData";
import { Character } from "./Character";
const fs = require('fs');
const readline = require('readline');

export async function parseLog(debugLogPath: string): Promise<GameData>{
    let gameData!: GameData

    //some data are passed through multiple lines
    let multiLineTempStorage: any[] = [];
    let isWaitingForMultiLine: boolean = false;
    let multiLineType: string = ""; //relation or opinionModifier
    
    // Temporary storage for secret parsing
    let currentSecret: Partial<Secret> | null = null;
    let currentKnownSecret: Partial<KnownSecret> | null = null;
    
    // Temporary storage for troops parsing
    let currentTroops: Partial<Troops> | null = null;

    const fileStream = fs.createReadStream(debugLogPath);

    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    for await (const line of rl) {
        if(isWaitingForMultiLine){
            let value = line.split('#')[0]
            switch (multiLineType){
                case "new_relations":
                    value = removeTooltip(value)
                    // if (value.includes("your")) {

                    //     value = value.replace("your", gameData.playerName+"'s");
                    // }
                    multiLineTempStorage.push(value)
                break;
                case "relations":
                    multiLineTempStorage.push(removeTooltip(value))
                break;
                case "opinionBreakdown":
                        multiLineTempStorage.push(parseOpinionModifier(value));
                break;
            }

            if(line.includes('#ENDMULTILINE')){         
                isWaitingForMultiLine = false;
            }
           continue;
        }

        if(line.includes("VOTC:IN")){

            //0: VOTC:IN, 1: dataType, 3: rootID 4...: data
            let data = line.split("/;/")

            const dataType = data[1];

            data.splice(0,2)

            const rootID = Number(data[0]);

            for(let i=0;i<data.length;i++){
                data[i] = removeTooltip(data[i])
            }

            switch (dataType){
                case "init":
                    gameData = new GameData(data);
                break;
                case "character": 
                    let char = new Character(data);
                    gameData!.characters.set(char.id, char);
                break;
                case "memory": 
                    let memory = parseMemory(data)
                    gameData!.characters.get(rootID)!.memories.push(memory);
                break;
                case "secret":
                    currentSecret = parseSecretStart(data);
                break;
                case "secret_is_criminal":
                    if (currentSecret) currentSecret.isCriminal = true;
                break;
                case "secret_is_shunned":
                    if (currentSecret) currentSecret.isShunned = true;
                break;
                case "secret_target":
                    if (currentSecret) {
                        currentSecret.target = {
                            id: Number(data[1]),
                            name: data[2]
                        };
                    }
                break;
                case "secret_knower":
                    if (currentSecret) {
                        if (!currentSecret.knowers) currentSecret.knowers = [];
                        // Store knower info temporarily, will be updated with spent/exposed info
                        currentSecret.knowers.push({
                            id: Number(data[2]),
                            name: data[3],
                            isSpent: false,
                            canBeExposed: false
                        });
                    }
                break;
                case "secret_spent":
                    if (currentSecret && currentSecret.knowers && currentSecret.knowers.length > 0) {
                        const lastKnower = currentSecret.knowers[currentSecret.knowers.length - 1];
                        lastKnower.isSpent = data[1] === 'yes';
                    }
                break;
                case "secret_can_be_exposed":
                    if (currentSecret && currentSecret.knowers && currentSecret.knowers.length > 0) {
                        const lastKnower = currentSecret.knowers[currentSecret.knowers.length - 1];
                        lastKnower.canBeExposed = data[1] === 'yes';
                    }
                break;
                case "secret_eob":
                    if (currentSecret) {
                        // Ensure all required fields have default values
                        const secret: Secret = {
                            name: currentSecret.name || '',
                            desc: currentSecret.desc || '',
                            category: currentSecret.category || '',
                            type: currentSecret.type || '',
                            isCriminal: currentSecret.isCriminal || false,
                            isShunned: currentSecret.isShunned || false,
                            target: currentSecret.target,
                            knowers: currentSecret.knowers || []
                        };
                        gameData!.characters.get(rootID)!.secrets.push(secret);
                        currentSecret = null;
                    }
                break;
                case "k_secret":
                    currentKnownSecret = parseKnownSecretStart(data);
                break;
                case "k_secret_owner":
                    if (currentKnownSecret) {
                        currentKnownSecret.ownerId = Number(data[1]);
                        currentKnownSecret.ownerName = data[2];
                    }
                break;
                case "k_secret_is_criminal":
                    if (currentKnownSecret) currentKnownSecret.isCriminal = true;
                break;
                case "k_secret_is_shunned":
                    if (currentKnownSecret) currentKnownSecret.isShunned = true;
                break;
                case "k_secret_target":
                    if (currentKnownSecret) {
                        currentKnownSecret.target = {
                            id: Number(data[1]),
                            name: data[2]
                        };
                    }
                break;
                case "k_secret_spent":
                    if (currentKnownSecret) {
                        currentKnownSecret.isSpent = data[1] === 'yes';
                    }
                break;
                case "k_secret_can_be_exposed":
                    if (currentKnownSecret) {
                        currentKnownSecret.canBeExposed = data[1] === 'yes';
                    }
                break;
                case "k_secret_knower":
                    if (currentKnownSecret) {
                        if (!currentKnownSecret.knowers) currentKnownSecret.knowers = [];
                        currentKnownSecret.knowers.push({
                            id: Number(data[2]),
                            name: data[3],
                            isSpent: false, // Not applicable for known secrets
                            canBeExposed: false // Not applicable for known secrets
                        });
                    }
                break;
                case "k_secret_eob":
                    if (currentKnownSecret) {
                        // Ensure all required fields have default values
                        const knownSecret: KnownSecret = {
                            name: currentKnownSecret.name || '',
                            desc: currentKnownSecret.desc || '',
                            category: currentKnownSecret.category || '',
                            type: currentKnownSecret.type || '',
                            ownerId: currentKnownSecret.ownerId || 0,
                            ownerName: currentKnownSecret.ownerName || '',
                            isCriminal: currentKnownSecret.isCriminal || false,
                            isShunned: currentKnownSecret.isShunned || false,
                            target: currentKnownSecret.target,
                            isSpent: currentKnownSecret.isSpent || false,
                            canBeExposed: currentKnownSecret.canBeExposed || false,
                            knowers: currentKnownSecret.knowers || []
                        };
                        gameData!.characters.get(rootID)!.knownSecrets.push(knownSecret);
                        currentKnownSecret = null;
                    }
                break;
                case "modifier":
                    const modifier: Modifier = {
                        id: data[1],
                        name: data[2],
                        description: data[3]
                    };
                    gameData!.characters.get(rootID)!.modifiers.push(modifier);
                break;
                case "stress":
                    const stress: Stress = {
                        value: Number(data[1]),
                        level: Number(data[2]),
                        progress: Number(data[3])
                    };
                    gameData!.characters.get(rootID)!.stress = stress;
                break;
                case "legitimacy":
                    if (data[1] === 'no') {
                        // Character has no legitimacy
                        gameData!.characters.get(rootID)!.legitimacy = undefined;
                    } else {
                        const legitimacy: Legitimacy = {
                            value: Number(data[1]),
                            level: Number(data[2]),
                            type: data[3],
                            avgPowerfulVassalExpectation: Number(data[4]),
                            avgVassalExpectation: Number(data[5]),
                            liegeExpectation: Number(data[6])
                        };
                        gameData!.characters.get(rootID)!.legitimacy = legitimacy;
                    }
                break;
                case "levies_vassals":
                    if (!currentTroops) {
                        currentTroops = {
                            leviesVassals: 0,
                            leviesDomain: [],
                            leviesTheocratic: 0,
                            maaRegiments: []
                        };
                    }
                    currentTroops.leviesVassals = Number(data[1]);
                break;
                case "levies_dom":
                    if (!currentTroops) {
                        currentTroops = {
                            leviesVassals: 0,
                            leviesDomain: [],
                            leviesTheocratic: 0,
                            maaRegiments: []
                        };
                    }
                    if (!currentTroops.leviesDomain) {
                        currentTroops.leviesDomain = [];
                    }
                    currentTroops.leviesDomain.push(Number(data[1]));
                break;
                case "levies_theo":
                    if (!currentTroops) {
                        currentTroops = {
                            leviesVassals: 0,
                            leviesDomain: [],
                            leviesTheocratic: 0,
                            maaRegiments: []
                        };
                    }
                    currentTroops.leviesTheocratic = Number(data[1]);
                break;
                case "maa":
                    if (!currentTroops) {
                        currentTroops = {
                            leviesVassals: 0,
                            leviesDomain: [],
                            leviesTheocratic: 0,
                            maaRegiments: []
                        };
                    }
                    if (!currentTroops.maaRegiments) {
                        currentTroops.maaRegiments = [];
                    }
                    const regiment: MAARegiment = {
                        name: data[1],
                        isPersonal: data[2] === '1',
                        menAlive: Number(data[3])
                    };
                    currentTroops.maaRegiments.push(regiment);
                break;
                case "laws":
                    if (data[1] === '') {
                        break; // Skip if no law name provided
                    }
                    const law: Law = {
                        name: data[1]
                    };
                    gameData!.characters.get(rootID)!.laws.push(law);
                break;
                case "troops_eob":
                    if (currentTroops) {
                        // Calculate sum of domain levies
                        const leviesDomainSum = (currentTroops.leviesDomain || []).reduce((sum, val) => sum + val, 0);
                        
                        // Calculate total owned troops (all levies + only personal MAA)
                        const personalMAATotal = (currentTroops.maaRegiments || [])
                            .filter(regiment => regiment.isPersonal)
                            .reduce((sum, regiment) => sum + regiment.menAlive, 0);
                        
                        const totalOwnedTroops = leviesDomainSum + (currentTroops.leviesTheocratic || 0) + personalMAATotal;
                        
                        const troops: Troops = {
                            leviesVassals: currentTroops.leviesVassals || 0,
                            leviesDomain: currentTroops.leviesDomain || [],
                            leviesDomainSum: leviesDomainSum,
                            leviesTheocratic: currentTroops.leviesTheocratic || 0,
                            maaRegiments: currentTroops.maaRegiments || [],
                            totalOwnedTroops: totalOwnedTroops
                        };
                        gameData!.characters.get(rootID)!.troops = troops;
                        currentTroops = null;
                    }
                break;
                case "trait":
                    gameData!.characters.get(rootID)!.traits.push(parseTrait(data));
                break;
                case "opinions":
                    gameData!.characters.get(rootID)!.opinions.push({id: Number(data[1]), opinon: Number(data[2])});
                break;
                case "relations":
                    
                    if(line.split('#')[1] !== ''){
                        gameData!.characters.get(rootID)!.relationsToPlayer = [removeTooltip(line.split('#')[1])]
                    }
                    
                    if(!line.includes("#ENDMULTILINE")){
                        multiLineTempStorage = gameData!.characters.get(rootID)!.relationsToPlayer
                        isWaitingForMultiLine = true;
                        multiLineType = "relations";
                    }
                break;
                case "new_relations":
                var tmpTargetId = Number(data[1])
                if(line.split('#')[1] !== ''){
                    console.log("Adding new relation for char "+rootID+" towards "+tmpTargetId+": "+removeTooltip(line.split('#')[1]))
                    console.log(gameData!.characters)
                    gameData!.characters.get(rootID)!.relationsToCharacters.push({id: tmpTargetId, relations: [removeTooltip(line.split('#')[1])]})
                    //gameData!.characters.get(rootID)!.relationsToPlayer = [removeTooltip(line.split('#')[1])]
                }
                
                if(!line.includes("#ENDMULTILINE")){
                    multiLineTempStorage = gameData!.characters.get(rootID)!.relationsToCharacters.find(x => x.id == tmpTargetId)!.relations
                    isWaitingForMultiLine = true;
                    multiLineType = "new_relations";
                }
                break;

                case "opinionBreakdown":
                    if(line.split('#')[1] !== ''){
                        gameData!.characters.get(rootID)!.opinionBreakdownToPlayer = [parseOpinionModifier(line.split('#')[1])]
                    }
                    
                    if(!line.includes("#ENDMULTILINE")){
                        multiLineTempStorage = gameData!.characters.get(rootID)!.opinionBreakdownToPlayer
                        isWaitingForMultiLine = true;
                        multiLineType = "opinionBreakdown";
                    }
            }
        }
    } 

    
    function parseMemory(data: string[]): Memory{
        const memory: Memory = {
            type: data[1],
            creationDate: data[2],
            desc: data[3],
            relevanceWeight: Number(data[4]),
            creationDateTotalDays: Number(data[5])
        }
        return memory
    }

    function parseSecretStart(data: string[]): Partial<Secret>{
        return {
            name: data[1],
            desc: data[2],
            category: data[3],
            type: data[4] || '',
            isCriminal: false,
            isShunned: false,
            knowers: []
        }
    }

    function parseKnownSecretStart(data: string[]): Partial<KnownSecret>{
        return {
            name: data[1],
            desc: data[2],
            category: data[3],
            type: data[4] || '',
            isCriminal: false,
            isShunned: false,
            isSpent: false,
            canBeExposed: false,
            knowers: []
        }
    }

    
    function parseTrait(data: string[]): Trait{
        return {
            category: data[1],
            name: data[2],
            desc: data[3],
        }
    }

    function parseOpinionModifier(line: string): OpinionModifier{
        line = line.replace(/ *\([^)]*\) */g, "");

        let splits = line.split(": ");

        for(let i=0;i<splits.length;i++){
            splits[i] = removeTooltip(splits[i])
        }
  
        return {
            reason: splits[0],
            value: Number(splits[1])
        }
    }

    console.log(gameData!);
    return gameData!;
}


export function removeTooltip(str: string): string{
    let newWords: string[] = []
    str.split(" ").forEach( (word) =>{
        if(word.includes('')){
            newWords.push(word.split('')[0])
        }else{
            newWords.push(word)
        }
    })

    return newWords.join(' ').replace(/ +(?= )/g,'').trim();
}

export async function cleanLogFile(filePath: string) {
    const fileContent = await fs.promises.readFile(filePath, 'utf-8');
    const lines = fileContent.split('\n');
    const stringsToRemove = [
        'Running console command: run votc.txt',
        'console_failure: Effect is empty. Check error log',
        'Running console command: gui.createwidget gui/custom_gui/talk_window_v2.gui talk_window_counter',
        'console_success: Executing effect',
        'Trying to trigger an animation with glow_alpha for a widget which has no glow',
        'No sound alias named \'river_node\' configured! Please check you sound alias database'
    ];
  
  const cleaned = lines.filter(line => {
    return !stringsToRemove.some(str => line.includes(str));
  });
  
  await fs.promises.writeFile(filePath, cleaned.join('\n'), 'utf-8');
}
