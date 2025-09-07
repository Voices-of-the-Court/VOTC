import React, { useState } from 'react';

interface PresetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (name: string) => void;
    currentConfigName?: string; // Optional: for pre-filling if editing a preset name or basing new on existing
}

const PresetModal: React.FC<PresetModalProps> = ({ isOpen, onClose, onSubmit, currentConfigName }) => {
    const [name, setName] = useState(currentConfigName || '');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            onSubmit(name.trim());
            setName(''); // Reset after submit
        } else {
            alert("Preset name cannot be empty.");
        }
    };

    return (
        <div className="modal-backdrop">
            <div className="modal-content">
                <h4>Create New Preset</h4>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="presetName">Preset Name:</label>
                        <input
                            type="text"
                            id="presetName"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Enter preset name"
                            autoFocus
                            required
                        />
                    </div>
                    <div className="form-actions">
                        <button type="submit">Save Preset</button>
                        <button type="button" onClick={onClose}>Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PresetModal;
