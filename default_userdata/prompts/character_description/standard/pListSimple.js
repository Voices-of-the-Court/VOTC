module.exports = (gameData, currentCharacterId) => {
  const mainChar = gameData.characters.get(currentCharacterId || gameData.aiID);
  if (!mainChar) return '';

  const lines = [
    `[Persona: ${mainChar.shortName}]`,
    `id(${mainChar.id}); ${mainChar.personality}; traits(${(mainChar.traits || []).map(t => t.name).slice(0,3).join(', ')})`,
    `faith(${mainChar.faith}), culture(${mainChar.culture}), sexuality(${mainChar.sexuality || 'unknown'})`,
    mainChar.isRuler ? `ruler(${mainChar.primaryTitle}${mainChar.isIndependentRuler ? ', independent' : ''})` : '',
    mainChar.liege ? `liege(${mainChar.liege})` : '',
    mainChar.consort ? `consort(${mainChar.consort})` : 'unmarried',
    `age(${mainChar.age}), gold(${mainChar.gold}), opinionOfPlayer(${mainChar.opinionOfPlayer})`,
    `scene(${gameData.scene}), location(${gameData.location})`
  ].filter(Boolean);

  const others = [];
  gameData.characters.forEach((c, id) => {
    if (id === mainChar.id) return;
    others.push(`[Other ${c.shortName}: traits(${(c.traits || []).map(t => t.name).slice(0,2).join(', ')})]`);
  });

  return lines.join(' | ') + (others.length ? '\n' + others.join('\n') : '');
};
