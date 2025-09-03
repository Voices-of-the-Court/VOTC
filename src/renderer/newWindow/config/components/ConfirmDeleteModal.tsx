import React from 'react';

interface ConfirmDeleteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    presetName?: string;
}

const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({ isOpen, onClose, onConfirm, presetName }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-backdrop">
            <div className="modal-content">
                <h4>Confirm Deletion</h4>
                <p>
                    Are you sure you want to delete the preset 
                    {presetName ? <strong> "{presetName}"</strong> : " this preset"}?
                </p>
                <div className="form-actions">
                    <button type="button" onClick={onConfirm} className="button-danger">
                        Delete
                    </button>
                    <button type="button" onClick={onClose}>
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDeleteModal;
