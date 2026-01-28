import React, { useState, useEffect } from 'react';
import './PromptPreview.scss';

interface PromptPreviewProps {
  onCharacterChange?: (characterId: number) => void;
  promptSettingsVersion?: number; // Used to trigger refresh when settings change
}

interface PromptBlock {
  block: any;
  content: string;
  tokens: number;
}

interface PreviewData {
  characterId: number;
  characterName: string;
  messages: Array<{ role: string; content: string; name?: string }>;
  blocks: PromptBlock[];
  totalTokens: number;
}

interface ConversationData {
  characters: Array<{ id: number; fullName: string; shortName: string }>;
  playerID: number;
  aiID: number;
  historyLength: number;
}

const PromptPreview: React.FC<PromptPreviewProps> = ({ onCharacterChange, promptSettingsVersion }) => {
  const [conversationData, setConversationData] = useState<ConversationData | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedBlocks, setExpandedBlocks] = useState<Set<number>>(new Set());

  // Load conversation data on mount
  useEffect(() => {
    loadConversationData();
  }, []);

  // Update preview when character selection or settings change
  useEffect(() => {
    if (selectedCharacterId !== null) {
      loadPromptPreview(selectedCharacterId);
      if (onCharacterChange) {
        onCharacterChange(selectedCharacterId);
      }
    }
  }, [selectedCharacterId, promptSettingsVersion]);

  const loadConversationData = async () => {
    try {
      const data = await window.conversationAPI.getActiveConversationData();
      setConversationData(data);
      
      // Select the first AI character by default
      if (data && data.characters.length > 0) {
        const aiCharacter = data.characters.find((c: any) => c.id !== data.playerID);
        if (aiCharacter) {
          setSelectedCharacterId(aiCharacter.id);
        }
      }
    } catch (err) {
      setError('Failed to load conversation data');
      console.error('Failed to load conversation data:', err);
    }
  };

  const loadPromptPreview = async (characterId: number) => {
    setLoading(true);
    setError(null);
    
    try {
      const preview = await window.conversationAPI.getPromptPreview(characterId);
      setPreviewData(preview);
    } catch (err) {
      setError('Failed to generate prompt preview');
      console.error('Failed to generate prompt preview:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCharacterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCharacterId(Number(e.target.value));
  };

  const toggleBlockExpanded = (index: number) => {
    const newExpanded = new Set(expandedBlocks);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedBlocks(newExpanded);
  };

  const toggleAllBlocks = () => {
    if (previewData && expandedBlocks.size === previewData.blocks.length) {
      setExpandedBlocks(new Set());
    } else if (previewData) {
      setExpandedBlocks(new Set(previewData.blocks.map((_, i) => i)));
    }
  };

  if (!conversationData) {
    return (
      <div className="prompt-preview">
        <div className="prompt-preview-header">
          <h3>Prompt Preview</h3>
        </div>
        <div className="prompt-preview-content">
          <p className="muted-text">No active conversation. Start a conversation to preview prompts.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="prompt-preview">
      <div className="prompt-preview-header">
        <h3>Prompt Preview</h3>
        <div className="character-selector">
          <label>Character:</label>
          <select value={selectedCharacterId || ''} onChange={handleCharacterChange}>
            {conversationData.characters
              .filter((c: any) => c.id !== conversationData.playerID)
              .map((character: any) => (
                <option key={character.id} value={character.id}>
                  {character.fullName}
                </option>
              ))}
          </select>
        </div>
      </div>
      
      <div className="prompt-preview-content">
        {loading && <p>Loading preview...</p>}
        {error && <p className="error-text">{error}</p>}
        
        {previewData && (
          <div className="preview-results">
            <div className="token-summary">
              <h4>Total Tokens: <span className="token-count-large">{previewData.totalTokens}</span></h4>
              <button className="toggle-all-btn" onClick={toggleAllBlocks}>
                {expandedBlocks.size === previewData.blocks.length ? 'Collapse All' : 'Expand All'}
              </button>
            </div>
            
            <div className="preview-blocks">
              <h4>Prompt Blocks ({previewData.blocks.length}):</h4>
              {previewData.blocks.map((block, index) => (
                <div key={index} className={`preview-block ${expandedBlocks.has(index) ? 'expanded' : ''}`}>
                  <div className="block-header" onClick={() => toggleBlockExpanded(index)}>
                    <div className="block-title">
                      <span className="expand-icon">{expandedBlocks.has(index) ? '▼' : '▶'}</span>
                      <strong>{block.block.label}</strong>
                      <span className="badge">{block.block.type}</span>
                    </div>
                    <span className="token-count">{block.tokens} tokens</span>
                  </div>
                  {expandedBlocks.has(index) && (
                    <div className="block-content">
                      <pre>{block.content}</pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PromptPreview;
