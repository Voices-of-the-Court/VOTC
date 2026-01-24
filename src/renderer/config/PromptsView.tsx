import { useEffect, useMemo, useRef, useState } from 'react';
import { useConfigStore } from './store/useConfigStore';
import type { PromptBlock, PromptPreset, PromptSettings } from '@llmTypes';

type BlockUpdater = (block: PromptBlock) => PromptBlock;

const PromptsView: React.FC = () => {
  const promptSettings = useConfigStore((state) => state.promptSettings);
  const letterPromptSettings = useConfigStore((state) => state.letterPromptSettings);
  const promptFiles = useConfigStore((state) => state.promptFiles);
  const promptPresets = useConfigStore((state) => state.promptPresets);
  const loadPromptSettings = useConfigStore((state) => state.loadPromptSettings);
  const loadLetterPromptSettings = useConfigStore((state) => state.loadLetterPromptSettings);
  const savePromptSettings = useConfigStore((state) => state.savePromptSettings);
  const saveLetterPromptSettings = useConfigStore((state) => state.saveLetterPromptSettings);
  const refreshPromptFiles = useConfigStore((state) => state.refreshPromptFiles);
  const loadPromptPresets = useConfigStore((state) => state.loadPromptPresets);
  const savePromptPreset = useConfigStore((state) => state.savePromptPreset);
  const deletePromptPreset = useConfigStore((state) => state.deletePromptPreset);
  const exportPromptsZip = useConfigStore((state) => state.exportPromptsZip);
  const openPromptsFolder = useConfigStore((state) => state.openPromptsFolder);
  const openPromptFile = useConfigStore((state) => state.openPromptFile);

  const [localSettings, setLocalSettings] = useState<PromptSettings | null>(null);
  const [mode, setMode] = useState<'conversation' | 'letter'>('conversation');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [presetName, setPresetName] = useState<string>('');
  const saveTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadPromptSettings();
    loadLetterPromptSettings();
    loadPromptPresets();
    // run once on mount
  }, []);

  useEffect(() => {
    if (promptSettings && mode === 'conversation') {
      setLocalSettings(promptSettings);
    }
  }, [promptSettings, mode]);

  useEffect(() => {
    if (letterPromptSettings && mode === 'letter') {
      setLocalSettings(letterPromptSettings);
    }
  }, [letterPromptSettings, mode]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setExpandedId(null);
    setSelectedPresetId(null);
    setPresetName('');
  }, [mode]);

  const selectedPreset = useMemo(
    () => promptPresets.find((p) => p.id === selectedPresetId) || null,
    [promptPresets, selectedPresetId]
  );

  if (!localSettings) {
    return <div>Loading prompt configuration...</div>;
  }

  const persist = (next: PromptSettings, immediate = false) => {
    setLocalSettings(next);
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }
    if (immediate) {
      (mode === 'conversation' ? savePromptSettings : saveLetterPromptSettings)(next);
      return;
    }
    saveTimer.current = setTimeout(() => {
      (mode === 'conversation' ? savePromptSettings : saveLetterPromptSettings)(next);
      saveTimer.current = null;
    }, 400);
  };

  const updateBlock = (id: string, updater: BlockUpdater) => {
    const blocks = localSettings.blocks.map((b) => (b.id === id ? updater(b) : b));
    persist({ ...localSettings, blocks });
  };

  const removeBlock = (id: string) => {
    const blocks = localSettings.blocks.filter((b) => b.id !== id);
    persist({ ...localSettings, blocks });
  };

  const moveBlock = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const blocks = [...localSettings.blocks];
    const fromIndex = blocks.findIndex((b) => b.id === fromId);
    const toIndex = blocks.findIndex((b) => b.id === toId);
    if (fromIndex === -1 || toIndex === -1) return;
    const [moved] = blocks.splice(fromIndex, 1);
    blocks.splice(toIndex, 0, moved);
    persist({ ...localSettings, blocks });
  };

  const moveBlockBy = (id: string, delta: number) => {
    const blocks = [...localSettings.blocks];
    const index = blocks.findIndex((b) => b.id === id);
    if (index === -1) return;
    const target = index + delta;
    if (target < 0 || target >= blocks.length) return;
    const [moved] = blocks.splice(index, 1);
    blocks.splice(target, 0, moved);
    persist({ ...localSettings, blocks });
  };

  const addCustomBlock = () => {
    const newBlock: PromptBlock = {
      id: `custom-${Date.now()}`,
      type: 'custom',
      label: 'Custom Text Block',
      enabled: true,
      role: 'system',
      template: '',
    };
    persist({ ...localSettings, blocks: [...localSettings.blocks, newBlock] });
    setExpandedId(newBlock.id);
  };

  const handleResetMain = async () => {
    const confirm = window.confirm('Reset main prompt to default template? This will replace current text.');
    if (!confirm) return;
    const defaultMain = mode === 'conversation' ? await window.promptsAPI.getDefaultMain() : await window.promptsAPI.getDefaultLetterMain();
    persist({ ...localSettings, mainTemplate: defaultMain });
  };

  const handleApplyPreset = (preset: PromptPreset) => {
    persist({ ...preset.settings }, true);
    setSelectedPresetId(preset.id);
    setPresetName(preset.name || '');
  };

  const handleSavePreset = async (mode: 'new' | 'update') => {
    if (!localSettings) return;
    const name = presetName?.trim() || selectedPreset?.name || 'Prompt Preset';

    const preset: PromptPreset = {
      id: mode === 'update' && selectedPreset ? selectedPreset.id : '',
      name,
      settings: localSettings,
      createdAt: selectedPreset?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = await savePromptPreset(preset);
    setSelectedPresetId(saved.id);
    setPresetName(saved.name || '');
  };

  const handleDeletePreset = async () => {
    if (!selectedPresetId) return;
    const confirm = window.confirm('Delete this preset?');
    if (!confirm) return;
    await deletePromptPreset(selectedPresetId);
    setSelectedPresetId(null);
    setPresetName('');
  };

  const handleExport = async () => {
    const result = await exportPromptsZip(localSettings);
    if (result?.cancelled) return;
    if (result?.success) {
      alert(`Exported to ${result.path}`);
    } else {
      alert('Failed to export prompts.');
    }
  };

  const handleScriptSelect = (blockId: string, scriptPath: string) => {
    updateBlock(blockId, (b) => ({ ...b, scriptPath }));
  };

  const renderBlockContent = (block: PromptBlock) => {
    switch (block.type) {
      case 'description':
        return (
          <div className="field-row compact">
            <select
              value={block.scriptPath || ''}
              onChange={(e) => handleScriptSelect(block.id, e.target.value)}
            >
              {promptFiles.descriptions.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <div className="mini-buttons">
              <button onClick={() => block.scriptPath && openPromptFile(block.scriptPath)}>Open</button>
              <button onClick={openPromptsFolder}>Folder</button>
            </div>
          </div>
        );
      case 'examples':
        return (
          <div className="field-row compact">
            <select
              value={block.scriptPath || ''}
              onChange={(e) => handleScriptSelect(block.id, e.target.value)}
            >
              {promptFiles.examples.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <div className="mini-buttons">
              <button onClick={() => block.scriptPath && openPromptFile(block.scriptPath)}>Open</button>
              <button onClick={openPromptsFolder}>Folder</button>
            </div>
          </div>
        );
      case 'memories':
        return (
          <>
            <label>Memories pretext (Handlebars)</label>
            <textarea
              value={block.template || ''}
              rows={3}
              onChange={(e) => updateBlock(block.id, (b) => ({ ...b, template: e.target.value }))}
            />
            <label>Memories to include</label>
            <input
              type="number"
              min={1}
              value={block.limit ?? 5}
              onChange={(e) => updateBlock(block.id, (b) => ({ ...b, limit: Number(e.target.value) || 1 }))}
            />
          </>
        );
      case 'rolling_summary':
        return (
          <>
            <label>Rolling summary pretext (Handlebars)</label>
            <textarea
              value={block.template || ''}
              rows={3}
              onChange={(e) => updateBlock(block.id, (b) => ({ ...b, template: e.target.value }))}
            />
          </>
        );
      case 'past_summaries':
        return (
          <>
            <label>Past summaries pretext (Handlebars)</label>
            <textarea
              value={block.template || ''}
              rows={3}
              placeholder="Leave empty to use default text"
              onChange={(e) => updateBlock(block.id, (b) => ({ ...b, template: e.target.value }))}
            />
          </>
        );
      case 'instruction':
        return (
          <>
            <label>Main instruction (Handlebars)</label>
            <textarea
              value={block.template || ''}
              rows={3}
              onChange={(e) => updateBlock(block.id, (b) => ({ ...b, template: e.target.value }))}
            />
            <div className="field-row compact">
              <label>Role</label>
              <select
                value={block.role || 'user'}
                onChange={(e) => updateBlock(block.id, (b) => ({ ...b, role: e.target.value as any }))}
              >
                <option value="user">user</option>
                <option value="system">system</option>
                <option value="assistant">assistant</option>
              </select>
            </div>
          </>
        );
      case 'custom':
        return (
          <>
            <label>Label</label>
            <input
              type="text"
              value={block.label || ''}
              onChange={(e) => updateBlock(block.id, (b) => ({ ...b, label: e.target.value }))}
            />
            <div className="field-row compact">
              <label>Role</label>
              <select
                value={block.role || 'system'}
                onChange={(e) => updateBlock(block.id, (b) => ({ ...b, role: e.target.value as any }))}
              >
                <option value="system">system</option>
                <option value="user">user</option>
                <option value="assistant">assistant</option>
              </select>
            </div>
            <label>Template (Handlebars)</label>
            <textarea
              value={block.template || ''}
              rows={4}
              onChange={(e) => updateBlock(block.id, (b) => ({ ...b, template: e.target.value }))}
            />
            <div className="mini-buttons spaced">
              <button onClick={() => removeBlock(block.id)}>Delete block</button>
            </div>
          </>
        );
      case 'main':
      case 'history':
        return <p className="muted-text">This block uses the main prompt text or conversation history.</p>;
      default:
        return null;
    }
  };

  const renderBlock = (block: PromptBlock, index: number) => {
    const isExpanded = expandedId === block.id;
    return (
      <div
        key={block.id}
        className={`prompt-block ${block.enabled ? '' : 'disabled'} ${draggingId === block.id ? 'dragging' : ''}`}
        draggable
        onDragStart={() => setDraggingId(block.id)}
        onDragOver={(e) => {
          e.preventDefault();
          if (draggingId && draggingId !== block.id) {
            moveBlock(draggingId, block.id);
          }
        }}
        onDragEnd={() => setDraggingId(null)}
      >
        <div className="block-header">
          <div className="block-title">
            <span className="drag-handle">↕</span>
            <strong>{index + 1}. {block.label}</strong>
            <span className="badge">{block.type}</span>
            {block.pinned && <span className="badge pinned">pinned</span>}
          </div>
          <div className="block-actions">
            <label className="toggle">
              <input
                type="checkbox"
                checked={block.enabled}
                onChange={(e) => updateBlock(block.id, (b) => ({ ...b, enabled: e.target.checked }))}
              />
              <span>Enabled</span>
            </label>
            <button onClick={() => moveBlockBy(block.id, -1)}>↑</button>
            <button onClick={() => moveBlockBy(block.id, 1)}>↓</button>
            <button onClick={() => setExpandedId(isExpanded ? null : block.id)}>{isExpanded ? 'Hide' : 'Edit'}</button>
          </div>
        </div>
        {isExpanded && (
          <div className="block-body">
            {renderBlockContent(block)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="prompts-view">
      <div className="header-row">
        <div>
          <h3>Prompt Builder</h3>
          <p className="muted-text">Reorder, toggle, and edit blocks that compose the prompt.</p>
        </div>
        <div className="header-actions">
          <button onClick={openPromptsFolder}>Open prompts folder</button>
          <button onClick={() => refreshPromptFiles()}>Refresh files</button>
          <button onClick={handleExport}>Export ZIP</button>
        </div>
      </div>
      <div className="field-row spaced">
        <label>Prompt set</label>
        <div className="mini-buttons">
          <button
            className={mode === 'conversation' ? 'primary' : ''}
            onClick={() => {
              setMode('conversation');
              if (promptSettings) setLocalSettings(promptSettings);
            }}
          >
            Conversation
          </button>
          <button
            className={mode === 'letter' ? 'primary' : ''}
            onClick={() => {
              setMode('letter');
              if (letterPromptSettings) setLocalSettings(letterPromptSettings);
            }}
          >
            Letters
          </button>
        </div>
      </div>

      <div className="main-prompt-card">
        <div className="card-header">
          <h4>Main prompt (Handlebars)</h4>
          <div className="mini-buttons">
            <button onClick={handleResetMain}>Reset to default</button>
          </div>
        </div>
        <textarea
          value={localSettings.mainTemplate}
          rows={8}
          onChange={(e) => persist({ ...localSettings, mainTemplate: e.target.value })}
        />
      </div>

      {mode === 'conversation' && (
        <div className="presets-bar">
          <div className="field-row">
            <label>Presets</label>
            <select
              value={selectedPresetId || ''}
              onChange={(e) => {
                const id = e.target.value || null;
                const preset = promptPresets.find((p) => p.id === id);
                setSelectedPresetId(id);
                setPresetName(preset?.name || '');
                if (preset) {
                  handleApplyPreset(preset);
                }
              }}
            >
              <option value="">Select preset...</option>
              {promptPresets.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Preset name"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
            />
          </div>
          <div className="mini-buttons">
            <button onClick={() => handleSavePreset(selectedPreset ? 'update' : 'new')}>
              {selectedPreset ? 'Update preset' : 'Save preset'}
            </button>
            <button onClick={() => handleSavePreset('new')}>Save as new</button>
            <button disabled={!selectedPresetId} onClick={handleDeletePreset}>Delete</button>
          </div>
        </div>
      )}

      <div className="blocks-list">
        {localSettings.blocks.map((block, idx) => renderBlock(block, idx))}
      </div>

      <div className="actions-row">
        <button onClick={addCustomBlock}>Add custom block</button>
      </div>

      <div className="suffix-card">
        <div className="card-header">
          <h4>Suffix</h4>
          <label className="toggle">
            <input
              type="checkbox"
              checked={localSettings.suffix?.enabled || false}
              onChange={(e) => persist({
                ...localSettings,
                suffix: { ...localSettings.suffix, enabled: e.target.checked }
              })}
            />
            <span>Enabled</span>
          </label>
        </div>
        {localSettings.suffix?.enabled && (
          <textarea
            value={localSettings.suffix?.template || ''}
            rows={4}
            onChange={(e) => persist({
              ...localSettings,
              suffix: { ...localSettings.suffix, template: e.target.value }
            })}
          />
        )}
      </div>
    </div>
  );
};

export default PromptsView;
