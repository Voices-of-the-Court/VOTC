/**
 * Usage in templates:
 *   - {{randomTrue [probability]}}   → returns true/false
 *   - {{randomChoice value1 value2 ...}} → returns one of the given values
 *   - {{#maybe probability}}...{{/maybe}} → conditionally renders the block
 *   - {{randomInt min max}} → integer between min and max (inclusive)
 *   - {{randomFloat min max}} → float between min (inclusive) and max (exclusive)
 */

module.exports = (Handlebars) => {

  /**
   * randomTrue
   * ----------
   * Returns true with a given probability, otherwise false.
   * 
   * @param {number} [probability=0.5] - A number between 0 and 1.
   * @returns {boolean}
   * 
   * Template example:
   *   {{#if (randomTrue 0.3)}}
   *     This text appears 30% of the time.
   *   {{/if}}
   */
  Handlebars.registerHelper('randomTrue', function(probability = 0.5) {
    return Math.random() < probability;
  });

  /**
   * randomChoice
   * ------------
   * Picks one of the supplied values at random.
   * 
   * @param {...any} values - A list of values (strings, numbers, etc.).
   * @returns {any} A randomly selected value from the list.
   * 
   * Template example:
   *   <p>{{randomChoice "Hello" "Hi" "Greetings"}}, user!</p>
   *   → Shows one of the three greetings.
   */
  Handlebars.registerHelper('randomChoice', function(...args) {
    // The last argument is the Handlebars options object – strip it.
    const values = args.slice(0, -1);
    if (values.length === 0) return '';
    return values[Math.floor(Math.random() * values.length)];
  });

  /**
   * maybe (block helper)
   * --------------------
   * Conditionally renders its block content based on a given probability.
   * 
   * @param {number} probability - A number between 0 and 1.
   * @param {Object} options - Handlebars block options (provided automatically).
   * @returns {string} The rendered block content, or an empty string if not rendered.
   * 
   * Template example:
   *   {{#maybe 0.2}}
   *     <aside>This tip only shows up 20% of the time.</aside>
   *   {{/maybe}}
   * 
   * You can also provide an {{else}} block that renders when the condition fails:
   *   {{#maybe 0.5}}
   *     Heads!
   *   {{else}}
   *     Tails!
   *   {{/maybe}}
   */
  Handlebars.registerHelper('maybe', function(probability, options) {
    if (Math.random() < probability) {
      return options.fn(this);
    } else {
      return options.inverse(this);
    }
  });

  /**
   * randomInt
   * ---------
   * Returns a random integer between min and max (inclusive).
   * 
   * @param {number} min - Lower bound (inclusive).
   * @param {number} max - Upper bound (inclusive).
   * @returns {number} A random integer.
   * 
   * Template example:
   *   Your lucky number: {{randomInt 1 100}}
   */
  Handlebars.registerHelper('randomInt', function(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  });

  /**
   * randomFloat
   * -----------
   * Returns a random floating‑point number between min (inclusive) and max (exclusive).
   * 
   * @param {number} min - Lower bound (inclusive).
   * @param {number} max - Upper bound (exclusive).
   * @returns {number} A random float.
   * 
   * Template example:
   *   A random price: ${{randomFloat 0.99 9.99}}
   */
  Handlebars.registerHelper('randomFloat', function(min, max) {
    return Math.random() * (max - min) + min;
  });

};