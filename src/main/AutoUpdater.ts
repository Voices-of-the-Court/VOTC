import { autoUpdater } from 'electron-updater';
import { dialog, BrowserWindow } from 'electron';
import log from 'electron-log';

export class AppUpdater {
  private mainWindow: BrowserWindow | null = null;
  private updateAvailable = false;

  constructor() {
    // Configure auto updater
    autoUpdater.logger = log;
    autoUpdater.autoDownload = false; // We'll let the user choose when to download
    autoUpdater.autoInstallOnAppQuit = false; // We'll handle installation manually
   
    // Set up event handlers
    this.setupEventHandlers();
  }

  public setMainWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  public checkForUpdates() {
    log.info('Checking for updates...');
    autoUpdater.checkForUpdatesAndNotify();
  }

  public downloadUpdate() {
    if (this.updateAvailable) {
      log.info('Downloading update...');
      autoUpdater.downloadUpdate();
    }
  }

  public installUpdate() {
    if (this.updateAvailable) {
      log.info('Installing update...');
      autoUpdater.quitAndInstall(false, true);
    }
  }

  private setupEventHandlers() {
    autoUpdater.on('checking-for-update', () => {
      log.info('Checking for update...');
      this.sendStatusToWindow('Checking for update...');
    });

    autoUpdater.on('update-available', (info) => {
      log.info('Update available:', info);
      this.updateAvailable = true;
      this.sendStatusToWindow('Update available');
      
      // Notify the user about the update
      this.showUpdateAvailableDialog(info);
    });

    autoUpdater.on('update-not-available', (info) => {
      log.info('Update not available:', info);
      this.sendStatusToWindow('Update not available');
    });

    autoUpdater.on('error', (err) => {
      log.error('Error in auto-updater:', err);
      this.sendStatusToWindow(`Error: ${err.message}`);
    });

    autoUpdater.on('download-progress', (progressObj) => {
      let log_message = "Download speed: " + progressObj.bytesPerSecond;
      log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
      log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
      log.info(log_message);
      
      this.sendStatusToWindow(`Downloading ${Math.round(progressObj.percent)}%`);
    });

    autoUpdater.on('update-downloaded', (info) => {
      log.info('Update downloaded:', info);
      this.sendStatusToWindow('Update downloaded');
      
      // Notify the user that the update is ready to install
      this.showUpdateDownloadedDialog();
    });
  }

  private sendStatusToWindow(message: string) {
    log.info(message);
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('updater-status', message);
    }
  }

  private async showUpdateAvailableDialog(info: any) {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;

    const result = await dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: `A new version (${info.version}) is available!`,
      detail: 'Would you like to download the update now?',
      buttons: ['Download Update', 'Later'],
      defaultId: 0,
      cancelId: 1
    });

    switch (result.response) {
      case 0: // Download Update
        this.downloadUpdate();
        break;
      case 1: // Later
        // Do nothing, user will be notified next time app starts
        break;
    }
  }

  private async showUpdateDownloadedDialog() {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;

    const result = await dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: 'The update has been downloaded and is ready to install.',
      detail: 'Would you like to install the update now? The application will restart.',
      buttons: ['Install Now', 'Install on Exit'],
      defaultId: 0,
      cancelId: 1
    });

    switch (result.response) {
      case 0: // Install Now
        this.installUpdate();
        break;
      case 1: // Install on Exit
        // User chose to install on exit, set autoInstallOnAppQuit to true
        autoUpdater.autoInstallOnAppQuit = true;
        break;
    }
  }
}

// Create a singleton instance
export const appUpdater = new AppUpdater();