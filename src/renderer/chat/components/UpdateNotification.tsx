import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface UpdateNotificationProps {
  onClose: () => void;
}

export const UpdateNotification: React.FC<UpdateNotificationProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const [updateStatus, setUpdateStatus] = useState<string>('');
  const [updateAvailable, setUpdateAvailable] = useState<boolean>(false);
  const [updateDownloaded, setUpdateDownloaded] = useState<boolean>(false);

  useEffect(() => {
    // Listen for update status messages from the main process
    const handleUpdateStatus = (_event: any, status: string) => {
      setUpdateStatus(status);
      if (status === 'Update available') {
        setUpdateAvailable(true);
      }
      if (status === 'Update downloaded') {
        setUpdateDownloaded(true);
        setUpdateAvailable(false);
      }
    };

    // Add event listener
    (window as any).electronAPI?.onUpdaterStatus?.(handleUpdateStatus);

    return () => {
      // Clean up event listener
      (window as any).electronAPI?.removeUpdaterStatusListener?.(handleUpdateStatus);
    };
  }, []);

  const checkForUpdates = () => {
    (window as any).electronAPI?.updaterCheckForUpdates?.();
    setUpdateAvailable(false);
    setUpdateDownloaded(false);
  };

  const downloadUpdate = () => {
    (window as any).electronAPI?.updaterDownloadUpdate?.();
  };

  const installUpdate = () => {
    (window as any).electronAPI?.updaterInstallUpdate?.();
  };

  const handleMouseEnter = () => {
    (window as any).electronAPI?.setIgnoreMouseEvents?.(false);
  };

  const handleMouseLeave = () => {
    (window as any).electronAPI?.setIgnoreMouseEvents?.(true);
  };

  return (
    <div
      className="update-notification"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ pointerEvents: 'auto' }}
    >
      <div className="update-notification-content">
        <div className="update-notification-header">
          <h3>{t('updateNotification.applicationUpdate')}</h3>
          <button className="update-close-button" onClick={onClose}>✕</button>
        </div>
        
        {updateStatus && (
          <p className="update-status">{t('updateNotification.status')}: {updateStatus}</p>
        )}
        
        {!updateAvailable && !updateDownloaded && (
          <div className="update-actions">
            <button onClick={checkForUpdates} className="update-button">
              {t('updateNotification.checkForUpdates')}
            </button>
            <button onClick={onClose} className="update-button secondary">
              {t('updateNotification.close')}
            </button>
          </div>
        )}
        
        {updateAvailable && !updateDownloaded && (
          <div className="update-actions">
            <p>{t('updateNotification.newVersionAvailable')}</p>
            <button onClick={downloadUpdate} className="update-button primary">
              {t('updateNotification.downloadUpdate')}
            </button>
            <button onClick={onClose} className="update-button secondary">
              {t('updateNotification.later')}
            </button>
          </div>
        )}
        
        {updateDownloaded && (
          <div className="update-actions">
            <p>{t('updateNotification.updateDownloaded')}</p>
            <button onClick={installUpdate} className="update-button primary">
              {t('updateNotification.installNow')}
            </button>
            <button onClick={onClose} className="update-button secondary">
              {t('updateNotification.installOnExit')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
