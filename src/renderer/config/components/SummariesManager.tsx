import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useConfigStore } from '../store/useConfigStore';
import type { SummaryMetadata } from '../../../main/llmProviders/types';

const SummariesManager: React.FC = () => {
  const { t } = useTranslation();
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
        alert(t('summariesManager.failedUpdateSummary', { error: result.error }));
      }
    } catch (error) {
      console.error('Failed to update summary:', error);
      alert(t('summariesManager.failedUpdateSummary', { error: 'Unknown error' }));
    }
  };

  const handleDeleteSummary = async (playerId: string, characterId: string, index: number) => {
    if (!window.confirm(t('summariesManager.confirmDeleteSummary'))) {
      return;
    }

    try {
      const result = await deleteSummary(playerId, characterId, index);

      if (result.success) {
        await loadSummaries();
      } else {
        alert(t('summariesManager.failedDeleteSummary', { error: result.error }));
      }
    } catch (error) {
      console.error('Failed to delete summary:', error);
      alert(t('summariesManager.failedDeleteSummary', { error: 'Unknown error' }));
    }
  };

  const handleDeleteCharacterSummaries = async (playerId: string, characterId: string) => {
    if (!window.confirm(t('summariesManager.confirmDeleteCharacterSummaries'))) {
      return;
    }

    try {
      const result = await deleteCharacterSummaries(playerId, characterId);

      if (result.success) {
        await loadSummaries();
      } else {
        alert(t('summariesManager.failedDeleteCharacterSummaries', { error: result.error }));
      }
    } catch (error) {
      console.error('Failed to delete character summaries:', error);
      alert(t('summariesManager.failedDeleteCharacterSummaries', { error: 'Unknown error' }));
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
          <h4>{t('summariesManager.summariesManager')}</h4>
          <p className="help-text">
            {t('summariesManager.summariesManagerHelp')}
          </p>
        </div>
        <div className="header-actions">
          <button onClick={loadSummaries} disabled={isLoadingSummaries}>
            {isLoadingSummaries ? t('summaries.loadingSummaries') : t('summariesManager.refresh')}
          </button>
        </div>
      </div>

      <div className="search-box">
        <input
          type="text"
          placeholder={t('summariesManager.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>

      {Object.keys(summariesByPlayer).length === 0 ? (
        <div className="empty-state">
          {searchQuery ? t('summariesManager.noSearchResults') : t('summariesManager.noSummariesFound')}
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
                    {playerSummaries.length} {t('summariesManager.characters')}, {totalSummaries} {t('summariesManager.summariesCount')}
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
                            <span className="summary-count">{metadata.summaries.length} {t('summariesManager.summariesCount')}</span>
                            <button
                              className="delete-all-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteCharacterSummaries(metadata.playerId, metadata.characterId);
                              }}
                            >
                              {t('summariesManager.deleteAll')}
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
                                        {t('common.edit')}
                                      </button>
                                      <button
                                        onClick={() => handleDeleteSummary(
                                          metadata.playerId,
                                          metadata.characterId,
                                          index
                                        )}
                                        className="danger-button"
                                      >
                                        {t('common.delete')}
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
              <h4>{t('summariesManager.editSummary')}</h4>
              <button
                className="close-button"
                onClick={() => setEditingEntry(null)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="edit-info">
                <p><strong>{t('summariesManager.playerId')}:</strong> {editingEntry.playerId}</p>
                <p><strong>{t('summariesManager.characterId')}:</strong> {editingEntry.characterId}</p>
                <p><strong>{t('summariesManager.summaryIndex')}:</strong> {editingEntry.index + 1}</p>
              </div>
              <textarea
                value={editingEntry.content}
                onChange={(e) => setEditingEntry({...editingEntry, content: e.target.value})}
                rows={10}
                style={{ width: '100%', fontFamily: 'monospace' }}
              />
            </div>
            <div className="modal-footer">
              <button onClick={() => setEditingEntry(null)}>{t('common.cancel')}</button>
              <button onClick={handleSaveEdit} className="primary-button">{t('common.save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SummariesManager;
