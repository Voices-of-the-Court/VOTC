import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface PresetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (name: string) => void;
    currentConfigName?: string; // Optional: for pre-filling if editing a preset name or basing new on existing
}

const PresetModal: React.FC<PresetModalProps> = ({ isOpen, onClose, onSubmit, currentConfigName }) => {
    const { t } = useTranslation();
    const [name, setName] = useState(currentConfigName || '');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            onSubmit(name.trim());
            setName(''); // Reset after submit
        } else {
            alert(t('connection.presetNameRequired'));
        }
    };

    return (
        <div className="modal-backdrop">
            <div className="modal-content">
                <h4>{t('connection.createNewPreset')}</h4>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="presetName">{t('connection.presetName')}:</label>
                        <input
                            type="text"
                            id="presetName"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={t('connection.presetNamePlaceholder')}
                            autoFocus
                            required
                        />
                    </div>
                    <div className="form-actions">
                        <button type="submit">{t('connection.savePreset')}</button>
                        <button type="button" onClick={onClose}>{t('common.cancel')}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PresetModal;
