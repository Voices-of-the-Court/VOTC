import { autoUpdater } from 'electron-updater';
import { dialog, BrowserWindow, shell } from 'electron';
import log from 'electron-log';
import { settingsRepository } from './SettingsRepository';

// Localization strings for updater dialogs
const updaterTranslations: Record<string, {
  updateAvailable: { title: string; message: string; detail: string; download: string; viewChangelog: string; later: string };
  updateAvailablePrerelease: { title: string; message: string; detail: string; download: string; viewChangelog: string; later: string };
  updateDownloaded: { title: string; message: string; detail: string; installNow: string; installOnExit: string };
  checkingForUpdate: string;
  updateNotAvailable: string;
  downloadProgress: string;
}> = {
  en: {
    updateAvailable: {
      title: 'Update Available',
      message: 'A new version ({version}) is available!',
      detail: 'Release notes:\n{releaseNotes}\n\nWould you like to download the update now?',
      download: 'Download Update',
      viewChangelog: 'View Changelog',
      later: 'Later'
    },
    updateAvailablePrerelease: {
      title: 'Pre-release Update Available',
      message: 'A new pre-release version ({version}) is available!',
      detail: 'This is a pre-release version and may be less stable.\n\nRelease notes:\n{releaseNotes}\n\nWould you like to download the update now?',
      download: 'Download Pre-release',
      viewChangelog: 'View Changelog',
      later: 'Later'
    },
    updateDownloaded: {
      title: 'Update Ready',
      message: 'The update has been downloaded and is ready to install.',
      detail: 'Would you like to install the update now? The application will restart.',
      installNow: 'Install Now',
      installOnExit: 'Install on Exit'
    },
    checkingForUpdate: 'Checking for update...',
    updateNotAvailable: 'You are running the latest version.',
    downloadProgress: 'Downloading {percent}%'
  },
  de: {
    updateAvailable: {
      title: 'Update verfügbar',
      message: 'Eine neue Version ({version}) ist verfügbar!',
      detail: 'Versionshinweise:\n{releaseNotes}\n\nMöchten Sie das Update jetzt herunterladen?',
      download: 'Update herunterladen',
      viewChangelog: 'Änderungsprotokoll anzeigen',
      later: 'Später'
    },
    updateAvailablePrerelease: {
      title: 'Vorabversion verfügbar',
      message: 'Eine neue Vorabversion ({version}) ist verfügbar!',
      detail: 'Dies ist eine Vorabversion und möglicherweise weniger stabil.\n\nVersionshinweise:\n{releaseNotes}\n\nMöchten Sie das Update jetzt herunterladen?',
      download: 'Vorabversion herunterladen',
      viewChangelog: 'Änderungsprotokoll anzeigen',
      later: 'Später'
    },
    updateDownloaded: {
      title: 'Update bereit',
      message: 'Das Update wurde heruntergeladen und ist bereit zur Installation.',
      detail: 'Möchten Sie das Update jetzt installieren? Die Anwendung wird neu gestartet.',
      installNow: 'Jetzt installieren',
      installOnExit: 'Beim Beenden installieren'
    },
    checkingForUpdate: 'Suche nach Updates...',
    updateNotAvailable: 'Sie verwenden die aktuelle Version.',
    downloadProgress: 'Herunterladen {percent}%'
  },
  es: {
    updateAvailable: {
      title: 'Actualización disponible',
      message: '¡Una nueva versión ({version}) está disponible!',
      detail: 'Notas de la versión:\n{releaseNotes}\n\n¿Desea descargar la actualización ahora?',
      download: 'Descargar actualización',
      viewChangelog: 'Ver registro de cambios',
      later: 'Más tarde'
    },
    updateAvailablePrerelease: {
      title: 'Actualización preliminar disponible',
      message: '¡Una nueva versión preliminar ({version}) está disponible!',
      detail: 'Esta es una versión preliminar y puede ser menos estable.\n\nNotas de la versión:\n{releaseNotes}\n\n¿Desea descargar la actualización ahora?',
      download: 'Descargar preliminar',
      viewChangelog: 'Ver registro de cambios',
      later: 'Más tarde'
    },
    updateDownloaded: {
      title: 'Actualización lista',
      message: 'La actualización se ha descargado y está lista para instalar.',
      detail: '¿Desea instalar la actualización ahora? La aplicación se reiniciará.',
      installNow: 'Instalar ahora',
      installOnExit: 'Instalar al salir'
    },
    checkingForUpdate: 'Buscando actualizaciones...',
    updateNotAvailable: 'Está utilizando la última versión.',
    downloadProgress: 'Descargando {percent}%'
  },
  fr: {
    updateAvailable: {
      title: 'Mise à jour disponible',
      message: 'Une nouvelle version ({version}) est disponible !',
      detail: 'Notes de version :\n{releaseNotes}\n\nVoulez-vous télécharger la mise à jour maintenant ?',
      download: 'Télécharger la mise à jour',
      viewChangelog: 'Voir le journal des modifications',
      later: 'Plus tard'
    },
    updateAvailablePrerelease: {
      title: 'Mise à jour préliminaire disponible',
      message: 'Une nouvelle version préliminaire ({version}) est disponible !',
      detail: 'Il s\'agit d\'une version préliminaire et elle peut être moins stable.\n\nNotes de version :\n{releaseNotes}\n\nVoulez-vous télécharger la mise à jour maintenant ?',
      download: 'Télécharger la préliminaire',
      viewChangelog: 'Voir le journal des modifications',
      later: 'Plus tard'
    },
    updateDownloaded: {
      title: 'Mise à jour prête',
      message: 'La mise à jour a été téléchargée et est prête à être installée.',
      detail: 'Voulez-vous installer la mise à jour maintenant ? L\'application va redémarrer.',
      installNow: 'Installer maintenant',
      installOnExit: 'Installer à la fermeture'
    },
    checkingForUpdate: 'Recherche de mises à jour...',
    updateNotAvailable: 'Vous utilisez la dernière version.',
    downloadProgress: 'Téléchargement {percent}%'
  },
  ja: {
    updateAvailable: {
      title: 'アップデート利用可能',
      message: '新しいバージョン ({version}) が利用可能です！',
      detail: 'リリースノート:\n{releaseNotes}\n\n今すぐアップデートをダウンロードしますか？',
      download: 'アップデートをダウンロード',
      viewChangelog: '変更履歴を見る',
      later: '後で'
    },
    updateAvailablePrerelease: {
      title: 'プレリリースアップデート利用可能',
      message: '新しいプレリリース版 ({version}) が利用可能です！',
      detail: 'これはプレリリース版であり、安定性が低い可能性があります。\n\nリリースノート:\n{releaseNotes}\n\n今すぐアップデートをダウンロードしますか？',
      download: 'プレリリースをダウンロード',
      viewChangelog: '変更履歴を見る',
      later: '後で'
    },
    updateDownloaded: {
      title: 'アップデート準備完了',
      message: 'アップデートがダウンロードされ、インストールの準備ができました。',
      detail: '今すぐアップデートをインストールしますか？アプリケーションが再起動します。',
      installNow: '今すぐインストール',
      installOnExit: '終了時にインストール'
    },
    checkingForUpdate: 'アップデートを確認中...',
    updateNotAvailable: '最新バージョンを使用しています。',
    downloadProgress: 'ダウンロード中 {percent}%'
  },
  ko: {
    updateAvailable: {
      title: '업데이트 사용 가능',
      message: '새 버전 ({version})을 사용할 수 있습니다!',
      detail: '릴리스 정보:\n{releaseNotes}\n\n지금 업데이트를 다운로드하시겠습니까?',
      download: '업데이트 다운로드',
      viewChangelog: '변경 로그 보기',
      later: '나중에'
    },
    updateAvailablePrerelease: {
      title: '시험판 업데이트 사용 가능',
      message: '새 시험판 버전 ({version})을 사용할 수 있습니다!',
      detail: '이것은 시험판 버전이며 안정성이 떨어질 수 있습니다.\n\n릴리스 정보:\n{releaseNotes}\n\n지금 업데이트를 다운로드하시겠습니까?',
      download: '시험판 다운로드',
      viewChangelog: '변경 로그 보기',
      later: '나중에'
    },
    updateDownloaded: {
      title: '업데이트 준비 완료',
      message: '업데이트가 다운로드되었으며 설치할 준비가 되었습니다.',
      detail: '지금 업데이트를 설치하시겠습니까? 애플리케이션이 다시 시작됩니다.',
      installNow: '지금 설치',
      installOnExit: '종료 시 설치'
    },
    checkingForUpdate: '업데이트 확인 중...',
    updateNotAvailable: '최신 버전을 사용하고 있습니다.',
    downloadProgress: '다운로드 중 {percent}%'
  },
  pl: {
    updateAvailable: {
      title: 'Dostępna aktualizacja',
      message: 'Nowa wersja ({version}) jest dostępna!',
      detail: 'Informacje o wersji:\n{releaseNotes}\n\nCzy chcesz pobrać aktualizację teraz?',
      download: 'Pobierz aktualizację',
      viewChangelog: 'Zobacz dziennik zmian',
      later: 'Później'
    },
    updateAvailablePrerelease: {
      title: 'Dostępna aktualizacja wstępna',
      message: 'Nowa wersja wstępna ({version}) jest dostępna!',
      detail: 'To jest wersja wstępna i może być mniej stabilna.\n\nInformacje o wersji:\n{releaseNotes}\n\nCzy chcesz pobrać aktualizację teraz?',
      download: 'Pobierz wersję wstępną',
      viewChangelog: 'Zobacz dziennik zmian',
      later: 'Później'
    },
    updateDownloaded: {
      title: 'Aktualizacja gotowa',
      message: 'Aktualizacja została pobrana i jest gotowa do instalacji.',
      detail: 'Czy chcesz zainstalować aktualizację teraz? Aplikacja zostanie uruchomiona ponownie.',
      installNow: 'Zainstaluj teraz',
      installOnExit: 'Zainstaluj przy wyjściu'
    },
    checkingForUpdate: 'Sprawdzanie aktualizacji...',
    updateNotAvailable: 'Korzystasz z najnowszej wersji.',
    downloadProgress: 'Pobieranie {percent}%'
  },
  ru: {
    updateAvailable: {
      title: 'Доступно обновление',
      message: 'Доступна новая версия ({version})!',
      detail: 'Примечания к выпуску:\n{releaseNotes}\n\nХотите скачать обновление сейчас?',
      download: 'Скачать обновление',
      viewChangelog: 'Открыть список изменений',
      later: 'Позже'
    },
    updateAvailablePrerelease: {
      title: 'Доступна предварительная версия',
      message: 'Доступна новая предварительная версия ({version})!',
      detail: 'Это предварительная версия, она может быть менее стабильной.\n\nПримечания к выпуску:\n{releaseNotes}\n\nХотите скачать обновление сейчас?',
      download: 'Скачать предварительную версию',
      viewChangelog: 'Открыть список изменений',
      later: 'Позже'
    },
    updateDownloaded: {
      title: 'Обновление готово',
      message: 'Обновление загружено и готово к установке.',
      detail: 'Хотите установить обновление сейчас? Приложение будет перезапущено.',
      installNow: 'Установить сейчас',
      installOnExit: 'Установить при выходе'
    },
    checkingForUpdate: 'Проверка обновлений...',
    updateNotAvailable: 'Вы используете последнюю версию.',
    downloadProgress: 'Загрузка {percent}%'
  },
  zh: {
    updateAvailable: {
      title: '有可用更新',
      message: '新版本 ({version}) 已可用！',
      detail: '更新说明：\n{releaseNotes}\n\n您想现在下载更新吗？',
      download: '下载更新',
      viewChangelog: '查看更新日志',
      later: '稍后'
    },
    updateAvailablePrerelease: {
      title: '有可用预发布更新',
      message: '新预发布版本 ({version}) 已可用！',
      detail: '这是一个预发布版本，可能不太稳定。\n\n更新说明：\n{releaseNotes}\n\n您想现在下载更新吗？',
      download: '下载预发布版',
      viewChangelog: '查看更新日志',
      later: '稍后'
    },
    updateDownloaded: {
      title: '更新准备就绪',
      message: '更新已下载并准备安装。',
      detail: '您想现在安装更新吗？应用程序将重新启动。',
      installNow: '立即安装',
      installOnExit: '退出时安装'
    },
    checkingForUpdate: '正在检查更新...',
    updateNotAvailable: '您正在使用最新版本。',
    downloadProgress: '下载中 {percent}%'
  }
};

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
    // Apply the prerelease setting from user preferences
    autoUpdater.allowPrerelease = settingsRepository.getAllowPrerelease();
    log.info(`Prerelease updates ${autoUpdater.allowPrerelease ? 'enabled' : 'disabled'}`);
    autoUpdater.checkForUpdates();
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

  private getTranslations() {
    const language = settingsRepository.getLanguage() || 'en';
    return updaterTranslations[language] || updaterTranslations.en;
  }

  /**
   * Strip HTML tags and decode common HTML entities from release notes
   */
  private stripHtml(html: string): string {
    // Decode common HTML entities
    let text = html
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'");
    
    // Convert block-level elements to line breaks
    text = text
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• ');
    
    // Remove all remaining HTML tags
    text = text.replace(/<[^>]+>/g, '');
    
    // Clean up whitespace
    text = text
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .trim();
    
    return text;
  }

  private formatReleaseNotes(notes: string | undefined): string {
    if (!notes) return 'No release notes available.';
    
    // Strip HTML tags
    let text = this.stripHtml(notes);
    
    // Truncate if too long (dialog has limited space)
    const maxLength = 500;
    if (text.length > maxLength) {
      return text.substring(0, maxLength) + '...';
    }
    return text;
  }

  /**
   * Check if a version is a pre-release
   */
  private isPrerelease(version: string): boolean {
    const prereleasePatterns = [
      /-alpha/i,
      /-beta/i,
      /-rc/i,
      /-pre/i,
      /-preview/i,
      /-dev/i,
      /-test/i,
      /-snapshot/i,
      /\.0a/i,
      /\.0b/i,
    ];
    return prereleasePatterns.some(pattern => pattern.test(version));
  }

  private setupEventHandlers() {
    autoUpdater.on('checking-for-update', () => {
      log.info('Checking for update...');
    });

    autoUpdater.on('update-available', (info) => {
      log.info('Update available:', info);
      this.updateAvailable = true;
      
      // Notify the user about the update
      this.showUpdateAvailableDialog(info);
    });

    autoUpdater.on('update-not-available', (info) => {
      log.info('Update not available:', info);
    });

    autoUpdater.on('error', (err) => {
      log.error('Error in auto-updater:', err);
    });

    autoUpdater.on('download-progress', (progressObj) => {
      let log_message = "Download speed: " + progressObj.bytesPerSecond;
      log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
      log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
      log.info(log_message);
    });

    autoUpdater.on('update-downloaded', (info) => {
      log.info('Update downloaded:', info);
      
      // Notify the user that the update is ready to install
      this.showUpdateDownloadedDialog();
    });
  }

  private async showUpdateAvailableDialog(info: any) {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;

    const t = this.getTranslations();
    const releaseNotes = this.formatReleaseNotes(info.releaseNotes as string);
    const isPrerelease = this.isPrerelease(info.version);
    
    // Use prerelease strings if this is a prerelease version
    const strings = isPrerelease ? t.updateAvailablePrerelease : t.updateAvailable;

    const result = await dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: strings.title,
      message: strings.message.replace('{version}', info.version),
      detail: strings.detail.replace('{releaseNotes}', releaseNotes),
      buttons: [strings.download, strings.viewChangelog, strings.later],
      defaultId: 0,
      cancelId: 2
    });

    switch (result.response) {
      case 0: // Download Update
        this.downloadUpdate();
        break;
      case 1: // View Changelog
        // Open the release page in the browser
        const changelogUrl = this.getChangelogUrl(info.version);
        await shell.openExternal(changelogUrl);
        // Show the dialog again after viewing changelog
        this.showUpdateAvailableDialog(info);
        break;
      case 2: // Later
        // Do nothing, user will be notified next time app starts
        break;
    }
  }

  /**
   * Get the changelog URL for a given version
   */
  private getChangelogUrl(version: string): string {
    // Construct GitHub releases URL for this project
    return `https://github.com/Voices-of-the-Court/VOTC/releases/tag/v${version}`;
  }

  private async showUpdateDownloadedDialog() {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;

    const t = this.getTranslations();

    const result = await dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: t.updateDownloaded.title,
      message: t.updateDownloaded.message,
      detail: t.updateDownloaded.detail,
      buttons: [t.updateDownloaded.installNow, t.updateDownloaded.installOnExit],
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
