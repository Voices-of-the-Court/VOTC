import React, { useState, useEffect } from 'react';
import { useConfigStore } from '../store/useConfigStore';
import type { SummaryMetadata } from '../../../main/llmProviders/types';

const SummariesManager: React.FC = () => {
  const listAllSummaries = useConfigStore((state) => state.listAllSummaries);
  const updateSummary = useConfigStore((state) => state.updateSummary);
  const deleteSummary = useConfigStore((state) => state.deleteSummary);
  const deleteCharacterSummaries = useConfigStore((state) => state.deleteCharacterSummaries);
  
  const [summaries, setSummaries] = useState<SummaryMetadata[]>([]);
  const [isLoadingSummaries, setIsLoadingSummaries] = useState(false);
  const [expandedCharacters, setExpandedCharacters] = useState<Set<string>>(new Set());
  const [editingEntry, setEditingEntry] = useState<{playerId: string, characterId: string, index: number, content: string} | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadSummaries();
  }, []);

  const loadSummaries = async () => {
    setIsLoadingSummaries(true);
    try {
      const summariesData = await listAllSummaries();
      setSummaries(summariesData);
    } catch (error) {
      console.error('Failed to load summaries:', error);
    } finally {
      setIsLoadingSummaries(false);
    }
  };

  const toggleCharacterExpanded = (key: string) => {
    setExpandedCharacters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const handleEditSummary = (playerId: string, characterId: string, index: number, content: string) => {
    setEditingEntry({ playerId, characterId, index, content });
  };

  const handleSaveEdit = async () => {
    if (!editingEntry) return;

    try {
      const result = await updateSummary(
        editingEntry.playerId,
        editingEntry.characterId,
        editingEntry.index,
        editingEntry.content
      );

      if (result.success) {
        await loadSummaries();
        setEditingEntry(null);
      } else {
        alert(`Failed to update summary: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to update summary:', error);
      alert('Failed to update summary');
    }
  };

  const handleDeleteSummary = async (playerId: string, characterId: string, index: number) => {
    if (!window.confirm('Are you sure you want to delete this summary?')) {
      return;
    }

    try {
      const result = await deleteSummary(playerId, characterId, index);

      if (result.success) {
        await loadSummaries();
      } else {
        alert(`Failed to delete summary: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to delete summary:', error);
      alert('Failed to delete summary');
    }
  };

  const handleDeleteCharacterSummaries = async (playerId: string, characterId: string) => {
    if (!window.confirm('Are you sure you want to delete all summaries for this character? This action cannot be undone.')) {
      return;
    }

    try {
      const result = await deleteCharacterSummaries(playerId, characterId);

      if (result.success) {
        await loadSummaries();
      } else {
        alert(`Failed to delete character summaries: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to delete character summaries:', error);
      alert('Failed to delete character summaries');
    }
  };

  // Filter summaries based on search query
  const filteredSummaries = summaries.filter(metadata => {
    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase();
    return (
      metadata.characterName.toLowerCase().includes(query) ||
      metadata.characterId.toLowerCase().includes(query) ||
      metadata.playerId.toLowerCase().includes(query) ||
      metadata.summaries.some(summary =>
        summary.content.toLowerCase().includes(query) ||
        summary.date.toLowerCase().includes(query)
      )
    );
  });

  // Group summaries by player
  const summariesByPlayer = filteredSummaries.reduce((acc, metadata) => {
    if (!acc[metadata.playerId]) {
      acc[metadata.playerId] = [];
    }
    acc[metadata.playerId].push(metadata);
    return acc;
  }, {} as Record<string, SummaryMetadata[]>);

  return (
    <div className="form-group summaries-manager">
      <div className="header-row">
        <div>
          <h4>Summaries Manager</h4>
          <p className="help-text">
            View, edit, and manage conversation summaries for all characters. Summaries are organized by your player characters.
          </p>
        </div>
        <div className="header-actions">
          <button onClick={loadSummaries} disabled={isLoadingSummaries}>
            {isLoadingSummaries ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="search-box">
        <input
          type="text"
          placeholder="Search by character name, player ID, or summary content..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>

      {Object.keys(summariesByPlayer).length === 0 ? (
        <div className="empty-state">
          {searchQuery ? 'No summaries found matching your search.' : 'No summaries found. Start a conversation to create summaries.'}
        </div>
      ) : (
        <div className="summaries-list">
          {Object.entries(summariesByPlayer).map(([playerId, playerSummaries]) => {
            const playerKey = `player-${playerId}`;
            const isPlayerExpanded = expandedCharacters.has(playerKey);
            const totalSummaries = playerSummaries.reduce((sum, m) => sum + m.summaries.length, 0);

            return (
              <div key={playerKey} className="player-summary-group">
                <div
                  className="player-header"
                  onClick={() => toggleCharacterExpanded(playerKey)}
                >
                  <span className="expand-icon">{isPlayerExpanded ? '▼' : '▶'}</span>
                  <span className="player-name">
                    {playerSummaries[0]?.playerName || `Player ID: ${playerId}`}
                  </span>
                  <span className="summary-count">
                    {playerSummaries.length} characters, {totalSummaries} summaries
                  </span>
                </div>

                {isPlayerExpanded && (
                  <div className="player-characters">
                    {playerSummaries.map((metadata) => {
                      const characterKey = `${metadata.playerId}-${metadata.characterId}`;
                      const isExpanded = expandedCharacters.has(characterKey);

                      return (
                        <div key={characterKey} className="character-summary-group">
                          <div
                            className="character-header"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCharacterExpanded(characterKey);
                            }}
                          >
                            <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                            <span className="character-name">
                              {metadata.characterName}
                            </span>
                            <span className="character-id">ID: {metadata.characterId}</span>
                            <span className="summary-count">{metadata.summaries.length} summaries</span>
                            <button
                              className="delete-all-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteCharacterSummaries(metadata.playerId, metadata.characterId);
                              }}
                            >
                              Delete All
                            </button>
                          </div>

                          {isExpanded && (
                            <div className="summaries-container">
                              {metadata.summaries.map((summary, index) => (
                                <div key={index} className="summary-item">
                                  <div className="summary-header">
                                    <span className="summary-date">
                                      📅 {summary.date}
                                    </span>
                                    <div className="summary-actions">
                                      <button
                                        onClick={() => handleEditSummary(
                                          metadata.playerId,
                                          metadata.characterId,
                                          index,
                                          summary.content
                                        )}
                                      >
                                        Edit
                                      </button>
                                      <button
                                        onClick={() => handleDeleteSummary(
                                          metadata.playerId,
                                          metadata.characterId,
                                          index
                                        )}
                                        className="danger-button"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                  <div className="summary-content">
                                    {summary.content.substring(0, 150)}
                                    {summary.content.length > 150 ? '...' : ''}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editingEntry && (
        <div className="modal-overlay">
          <div className="modal-content summary-edit-modal">
            <div className="modal-header">
              <h4>Edit Summary</h4>
              <button
                className="close-button"
                onClick={() => setEditingEntry(null)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="edit-info">
                <p><strong>Player ID:</strong> {editingEntry.playerId}</p>
                <p><strong>Character ID:</strong> {editingEntry.characterId}</p>
                <p><strong>Summary Index:</strong> {editingEntry.index + 1}</p>
              </div>
              <textarea
                value={editingEntry.content}
                onChange={(e) => setEditingEntry({...editingEntry, content: e.target.value})}
                rows={10}
                style={{ width: '100%', fontFamily: 'monospace' }}
              />
            </div>
            <div className="modal-footer">
              <button onClick={() => setEditingEntry(null)}>Cancel</button>
              <button onClick={handleSaveEdit} className="primary-button">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SummariesManager;
