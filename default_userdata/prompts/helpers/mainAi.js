// Helper to expose the main AI character in templates
module.exports = (Handlebars) => {
  // Register a helper that returns the main AI character
  Handlebars.registerHelper('mainAi', function() {
    const gameData = this.gameData;
    if (gameData && gameData.aiID) {
      return gameData.characters.get(gameData.aiID);
    }
    return null;
  });
  
  // Register a helper to get specific properties from the main AI character
  Handlebars.registerHelper('mainAiProperty', function(property) {
    const gameData = this.gameData;
    if (gameData && gameData.aiID) {
      const aiChar = gameData.characters.get(gameData.aiID);
      if (aiChar && aiChar[property]) {
        return aiChar[property];
      }
    }
    return '';
  });
};