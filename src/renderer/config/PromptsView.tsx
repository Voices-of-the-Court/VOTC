import { useEffect, useState } from 'react';
import TemplateEditorModal from './components/TemplateEditorModal';
import { useConfigStore } from './store/useConfigStore';
import type { PromptSettings } from '@llmTypes';

const PromptsView: React.FC = () => {
  const promptSettings = useConfigStore((state) => state.promptSettings);
  const promptFiles = useConfigStore((state) => state.promptFiles);
  const loadPromptSettings = useConfigStore((state) => state.loadPromptSettings);
  const savePromptSettings = useConfigStore((state) => state.savePromptSettings);
  const refreshPromptFiles = useConfigStore((state) => state.refreshPromptFiles);
  const readPromptFile = useConfigStore((state) => state.readPromptFile);
  const savePromptFile = useConfigStore((state) => state.savePromptFile);

  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState<string>('');

  useEffect(() => {
    loadPromptSettings();
    // run once on mount
  }, []);

  if (!promptSettings) {
    return <div>Loading prompt configuration...</div>;
  }

  const updateSettings = (updates: Partial<PromptSettings>) => {
    savePromptSettings({ ...promptSettings, ...updates });
  };

  const handleEdit = async (path: string) => {
    const content = await readPromptFile(path);
    setEditingPath(path);
    setEditorContent(content);
  };

  const handleCreate = async (category: 'system' | 'character_description' | 'example_messages') => {
    const name = window.prompt('Enter new file name (e.g. custom/myTemplate.hbs or custom/myScript.js)');
    if (!name) return;
    const relative = `${category === 'system' ? 'system' : category}/${name}`.replace(/\\/g, '/');
    await savePromptFile(relative, '');
    await refreshPromptFiles();
    await handleEdit(relative);
  };

  const onSaveEditor = async (content: string) => {
    if (!editingPath) return;
    await savePromptFile(editingPath, content);
    setEditingPath(null);
    setEditorContent('');
  };

  return (
    <div className="prompts-view">
      <h3>Prompt Configuration</h3>

      <div className="form-group">
        <label>System Prompt Template</label>
        <select
          value={promptSettings.systemPromptTemplate}
          onChange={(e) => updateSettings({ systemPromptTemplate: e.target.value })}
        >
          {promptFiles.system.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <div className="button-row">
          <button onClick={() => handleEdit(promptSettings.systemPromptTemplate)}>Edit</button>
          <button onClick={() => handleCreate('system')}>New</button>
        </div>
      </div>

      <div className="form-group">
        <label>Character Description Script</label>
        <select
          value={promptSettings.characterDescriptionScript}
          onChange={(e) => updateSettings({ characterDescriptionScript: e.target.value })}
        >
          {promptFiles.descriptions.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <div className="button-row">
          <button onClick={() => handleEdit(promptSettings.characterDescriptionScript)}>Edit</button>
          <button onClick={() => handleCreate('character_description')}>New</button>
        </div>
      </div>

      <div className="form-group">
        <label>Example Messages Script</label>
        <select
          value={promptSettings.exampleMessagesScript}
          onChange={(e) => updateSettings({ exampleMessagesScript: e.target.value })}
        >
          {promptFiles.examples.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <div className="button-row">
          <button onClick={() => handleEdit(promptSettings.exampleMessagesScript)}>Edit</button>
          <button onClick={() => handleCreate('example_messages')}>New</button>
        </div>
      </div>

      <div className="form-group">
        <h4>Advanced</h4>
        <label>
          <input
            type="checkbox"
            checked={promptSettings.enableSuffixPrompt}
            onChange={(e) => updateSettings({ enableSuffixPrompt: e.target.checked })}
          />
          Enable Suffix Prompt
        </label>
        {promptSettings.enableSuffixPrompt && (
          <textarea
            value={promptSettings.suffixPrompt}
            onChange={(e) => updateSettings({ suffixPrompt: e.target.value })}
            rows={4}
            style={{ width: '100%' }}
          />
        )}
      </div>

      <div className="form-group">
        <label>Memories Insert Depth</label>
        <input
          type="number"
          value={promptSettings.memoriesInsertDepth}
          onChange={(e) => updateSettings({ memoriesInsertDepth: Number(e.target.value) })}
        />

        <label>Summaries Insert Depth</label>
        <input
          type="number"
          value={promptSettings.summariesInsertDepth}
          onChange={(e) => updateSettings({ summariesInsertDepth: Number(e.target.value) })}
        />

        <label>Description Insert Depth</label>
        <input
          type="number"
          value={promptSettings.descInsertDepth}
          onChange={(e) => updateSettings({ descInsertDepth: Number(e.target.value) })}
        />
      </div>

      <button onClick={() => refreshPromptFiles()}>Refresh Files</button>

      {editingPath && (
        <TemplateEditorModal
          path={editingPath}
          content={editorContent}
          onChange={setEditorContent}
          onSave={onSaveEditor}
          onClose={() => setEditingPath(null)}
        />
      )}
    </div>
  );
};

export default PromptsView;
