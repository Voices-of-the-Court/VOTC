import { useEffect } from 'react';
import type { AppSettings, LLMProviderConfig } from '@llmTypes';

const DEFAULT_PARAMETERS_AUTOSAVE = { temperature: 0.7, max_tokens: 2048 };

interface UseAutoSaveProps {
    editingConfig: Partial<LLMProviderConfig>;
    initialEditingConfig: Partial<LLMProviderConfig>;
    setAppSettings: React.Dispatch<React.SetStateAction<AppSettings | null>>;
    setInitialEditingConfig: React.Dispatch<React.SetStateAction<Partial<LLMProviderConfig>>>; // To update after save
}

export const useAutoSave = ({
    editingConfig,
    initialEditingConfig,
    setAppSettings,
    setInitialEditingConfig,
}: UseAutoSaveProps) => {
    useEffect(() => {
        // Don't save if config is empty, lacks essential info, or hasn't changed
        if (
            !editingConfig ||
            !editingConfig.providerType ||
            !editingConfig.instanceId ||
            JSON.stringify(editingConfig) === JSON.stringify(initialEditingConfig)
        ) {
            return;
        }

        const handler = setTimeout(async () => {
            console.log('Auto-saving config (changed):', editingConfig);
            const configToSave: LLMProviderConfig = {
                instanceId: editingConfig.instanceId!,
                providerType: editingConfig.providerType!,
                customName: editingConfig.customName,
                apiKey: editingConfig.apiKey || '',
                baseUrl: editingConfig.baseUrl || '',
                defaultModel: editingConfig.defaultModel || '',
                defaultParameters: editingConfig.defaultParameters || { ...DEFAULT_PARAMETERS_AUTOSAVE },
            };

            try {
                const saved = await window.llmConfigAPI.saveProviderConfig(configToSave);
                setAppSettings(prev => {
                    if (!prev) return null;
                    let newProviders = [...prev.llmSettings.providers];
                    let newPresets = [...prev.llmSettings.presets];
                    const baseProviderTypes = ['openrouter', 'ollama', 'openai-compatible'];

                    if (baseProviderTypes.includes(saved.instanceId)) {
                        const index = newProviders.findIndex(p => p.instanceId === saved.instanceId);
                        if (index > -1) newProviders[index] = saved;
                        else newProviders.push(saved);
                    } else {
                        const index = newPresets.findIndex(p => p.instanceId === saved.instanceId);
                        if (index > -1) newPresets[index] = saved;
                        else newPresets.push(saved);
                    }
                    return { ...prev, llmSettings: { ...prev.llmSettings, providers: newProviders, presets: newPresets } };
                });
                setInitialEditingConfig(saved); // Update initial config to the saved state
                console.log(`Settings for "${saved.customName || saved.providerType}" auto-saved.`);
            } catch (error) {
                console.error("Auto-save failed:", error);
            }
        }, 1000); // 3-second debounce

        return () => {
            clearTimeout(handler);
        };
    }, [editingConfig, initialEditingConfig, setAppSettings, setInitialEditingConfig]);
};
