/**
 * Response Healing Utility
 * Automatically validates and repairs malformed JSON responses from AI models.
 * Inspired by OpenRouter's response healing feature.
 */

/**
 * Attempts to extract and repair JSON from potentially malformed content
 * @param content - The raw content from the LLM
 * @returns Parsed JSON object or null if unrepairable
 */
export function healJsonResponse(content: string): any | null {
  if (!content || typeof content !== 'string') {
    return null;
  }

  // Step 1: Try direct parsing first
  try {
    return JSON.parse(content);
  } catch {
    // Continue to healing attempts
  }

  // Step 2: Extract JSON from markdown code blocks
  const markdownMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (markdownMatch) {
    try {
      return JSON.parse(markdownMatch[1].trim());
    } catch {
      // Continue with the extracted content
      content = markdownMatch[1].trim();
    }
  }

  // Step 3: Extract JSON from mixed text (find first { or [ and last } or ])
  const jsonStart = Math.min(
    content.indexOf('{') !== -1 ? content.indexOf('{') : Infinity,
    content.indexOf('[') !== -1 ? content.indexOf('[') : Infinity
  );
  
  if (jsonStart !== Infinity) {
    const startChar = content[jsonStart];
    const endChar = startChar === '{' ? '}' : ']';
    const jsonEnd = content.lastIndexOf(endChar);
    
    if (jsonEnd > jsonStart) {
      const extracted = content.substring(jsonStart, jsonEnd + 1);
      try {
        return JSON.parse(extracted);
      } catch {
        content = extracted;
      }
    }
  }

  // Step 4: Apply common JSON repairs
  let repaired = content.trim();

  // Remove trailing commas before closing brackets/braces
  repaired = repaired.replace(/,(\s*[}\]])/g, '$1');

  // Fix unquoted keys (simple cases)
  repaired = repaired.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

  // Try to fix missing closing brackets/braces
  const openBraces = (repaired.match(/{/g) || []).length;
  const closeBraces = (repaired.match(/}/g) || []).length;
  const openBrackets = (repaired.match(/\[/g) || []).length;
  const closeBrackets = (repaired.match(/\]/g) || []).length;

  if (openBraces > closeBraces) {
    repaired += '}'.repeat(openBraces - closeBraces);
  }
  if (openBrackets > closeBrackets) {
    repaired += ']'.repeat(openBrackets - closeBrackets);
  }

  // Step 5: Try parsing the repaired content
  try {
    return JSON.parse(repaired);
  } catch {
    // If all healing attempts fail, return null
    return null;
  }
}

/**
 * Attempts to heal and parse JSON content with detailed logging
 * @param content - The raw content from the LLM
 * @param context - Context string for logging (e.g., "ActionEngine")
 * @returns Parsed JSON object or null if unrepairable
 */
export function healJsonResponseWithLogging(content: string, context: string = 'JSON'): any | null {
  console.log(`[${context}] Attempting to heal JSON response`);
  console.log(`[${context}] Original content length: ${content?.length || 0} characters`);
  
  const healed = healJsonResponse(content);
  
  if (healed !== null) {
    console.log(`[${context}] Successfully healed JSON response`);
    return healed;
  }
  
  console.error(`[${context}] Failed to heal JSON response`);
  console.error(`[${context}] Original content:`, content?.substring(0, 500));
  return null;
}