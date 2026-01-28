/**
 * Utility for estimating token counts in text
 * Uses a simple approximation: 1 token ≈ 4 characters
 * This matches the existing logic in Conversation.ts
 */

export interface MessageWithTokens {
  role: string;
  content: string;
  name?: string;
  tokens: number;
}

export class TokenCounter {
  /**
   * Estimate token count (simple approximation)
   * This matches the existing logic in Conversation.ts
   */
  static estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 4); // Rough estimate: 1 token ≈ 4 characters
  }

  /**
   * Estimate token count for a message object
   */
  static estimateMessageTokens(message: { role: string; content: string; name?: string }): number {
    const text = message.name ? `${message.name}: ${message.content}` : message.content;
    return this.estimateTokens(text);
  }

  /**
   * Calculate total tokens for an array of messages
   */
  static calculateTotalTokens(messages: Array<{ role: string; content: string; name?: string }>): number {
    return messages.reduce((total, message) => total + this.estimateMessageTokens(message), 0);
  }

  /**
   * Add token counts to an array of messages
   */
  static addTokensToMessages(messages: Array<{ role: string; content: string; name?: string }>): MessageWithTokens[] {
    return messages.map(message => ({
      ...message,
      tokens: this.estimateMessageTokens(message)
    }));
  }
}