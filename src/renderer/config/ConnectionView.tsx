import React, { useState } from 'react';
import { useConfigStore, useSelection, useTestResult, useEditingConfig, useAppSettings } from "./store/useConfigStore";

import ProviderSidebar from './components/ProviderSidebar';
import ProviderConfigPanel from './components/ProviderConfigPanel';
import PresetModal from './components/PresetModal';
import ConfirmDeleteModal from './components/ConfirmDeleteModal';

const ConnectionView: React.FC = () => {
  const appSettings = useAppSettings();
  const editingConfig = useEditingConfig();
  const { selectedProviderType, selectedPresetId } = useSelection();
  const testResult = useTestResult();
  
  const selectProvider = useConfigStore((state) => state.selectProvider);
  const selectPreset = useConfigStore((state) => state.selectPreset);
  const updateEditingConfig = useConfigStore((state) => state.updateEditingConfig);
  const testConnection = useConfigStore((state) => state.testConnection);
  const createPreset = useConfigStore((state) => state.createPreset);
  const deletePreset = useConfigStore((state) => state.deletePreset);
  
  const actionsProviderInstanceId = useConfigStore((state) => state.actionsProviderInstanceId);
  const summaryProviderInstanceId = useConfigStore((state) => state.summaryProviderInstanceId);
  const setActionsProvider = useConfigStore((state) => state.setActionsProvider);
  const setSummaryProvider = useConfigStore((state) => state.setSummaryProvider);
  
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [presetToDelete, setPresetToDelete] = useState<{ id: string; name?: string } | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    if (name.startsWith('defaultParameters.')) {
      const paramName = name.split('.')[1];
      updateEditingConfig({
        defaultParameters: {
          ...(editingConfig.defaultParameters || { temperature: 0.7, max_tokens: 2048 }),
          [paramName]: type === 'number' ? parseFloat(value) : value,
        },
      });
    } else if (type === 'checkbox') {
      updateEditingConfig({ [name]: checked });
    } else if (type === 'number') {
      updateEditingConfig({ [name]: parseFloat(value) });
    } else {
      updateEditingConfig({ [name]: value });
    }
  };

  const handleContextLengthChange = (contextLength: number | undefined) => {
    if (contextLength === undefined) {
      const { customContextLength, ...rest } = editingConfig;
      updateEditingConfig(rest);
    } else {
      updateEditingConfig({ customContextLength: contextLength });
    }
  };

  const handleDeletePreset = (id: string) => {
    const preset = appSettings?.llmSettings.presets.find(p => p.instanceId === id);
    if (preset) {
      setPresetToDelete({ id: preset.instanceId, name: preset.customName || preset.providerType });
      setIsDeleteModalOpen(true);
    }
  };

  const confirmDelete = async () => {
    if (presetToDelete) {
      await deletePreset(presetToDelete.id);
      setIsDeleteModalOpen(false);
      setPresetToDelete(null);
    }
  };

  const handleCreatePreset = async (name: string) => {
    await createPreset(name);
    setIsPresetModalOpen(false);
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100% - 40px)' }}>
      <ProviderSidebar
        onSelectProviderType={selectProvider}
        onSelectPreset={selectPreset}
        onDeletePreset={handleDeletePreset}
        selectedProviderTypeForEditing={selectedProviderType}
        selectedPresetIdForEditing={selectedPresetId}
        actionsProviderInstanceId={actionsProviderInstanceId}
        summaryProviderInstanceId={summaryProviderInstanceId}
        onSetActionsProvider={setActionsProvider}
        onSetSummaryProvider={setSummaryProvider}
      />
      
      <ProviderConfigPanel
        config={editingConfig}
        testResult={testResult}
        onInputChange={handleInputChange}
        onContextLengthChange={handleContextLengthChange}
        onTestConnection={testConnection}
        onMakePreset={() => setIsPresetModalOpen(true)}
      />
      
      <PresetModal
        isOpen={isPresetModalOpen}
        onClose={() => setIsPresetModalOpen(false)}
        onSubmit={handleCreatePreset}
      />
      
      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        presetName={presetToDelete?.name}
      />
    </div>
  );
};

export default ConnectionView;
