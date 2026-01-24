import React, { useState, useEffect } from 'react';

interface UpdateNotificationProps {
  onClose: () => void;
}

export const UpdateNotification: React.FC<UpdateNotificationProps> = ({ onClose }) => {
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
          <h3>Application Update</h3>
          <button className="update-close-button" onClick={onClose}>✕</button>
        </div>
        
        {updateStatus && (
          <p className="update-status">Status: {updateStatus}</p>
        )}
        
        {!updateAvailable && !updateDownloaded && (
          <div className="update-actions">
            <button onClick={checkForUpdates} className="update-button">
              Check for Updates
            </button>
            <button onClick={onClose} className="update-button secondary">
              Close
            </button>
          </div>
        )}
        
        {updateAvailable && !updateDownloaded && (
          <div className="update-actions">
            <p>A new version is available!</p>
            <button onClick={downloadUpdate} className="update-button primary">
              Download Update
            </button>
            <button onClick={onClose} className="update-button secondary">
              Later
            </button>
          </div>
        )}
        
        {updateDownloaded && (
          <div className="update-actions">
            <p>Update has been downloaded and is ready to install.</p>
            <button onClick={installUpdate} className="update-button primary">
              Install Now
            </button>
            <button onClick={onClose} className="update-button secondary">
              Install on Exit
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
