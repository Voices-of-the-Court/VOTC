import React from 'react';
import { useTranslation } from 'react-i18next';

interface ConfirmDeleteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    presetName?: string;
}

const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({ isOpen, onClose, onConfirm, presetName }) => {
    const { t } = useTranslation();
    if (!isOpen) return null;

    return (
        <div className="modal-backdrop">
            <div className="modal-content">
                <h4>{t('modals.confirmDeletion')}</h4>
                <p>
                    {t('modals.areYouSureDeletePreset', { name: presetName })}
                </p>
                <div className="form-actions">
                    <button type="button" onClick={onConfirm} className="button-danger">
                        {t('common.delete')}
                    </button>
                    <button type="button" onClick={onClose}>
                        {t('common.cancel')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDeleteModal;
