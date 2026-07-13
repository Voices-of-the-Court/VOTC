import { EventEmitter } from 'events';
import activeWin from 'active-win';
import { app } from 'electron';

const ACTIVE_WIN_OPTIONS = {
  accessibilityPermission: false,
  screenRecordingPermission: false
};

/**
 * Monitors the currently focused window and determines if the app should be in overlay mode.
 * Overlay mode is active when CK3 or the app itself is focused.
 */
export class FocusMonitor extends EventEmitter {
  private pollingTimeout: ReturnType<typeof setTimeout> | null = null;
  private isOverlayMode: boolean = false;
  private lastStateChangeTime: number = 0;
  private readonly POLL_INTERVAL_MS = 500;
  private readonly MIN_STATE_CHANGE_INTERVAL_MS = 200;

  /**
   * Maximum delay between active-win polls when it is failing.
   * While active-win errors (e.g. macOS Accessibility permission not granted
   * yet, or App Translocation breaking the native binary) we back off
   * exponentially up to this cap instead of spawning the Swift binary every
   * 500ms and flooding the log.
   */
  private readonly MAX_BACKOFF_MS = 10000;

  /**
   * Number of consecutive active-win failures since the last success.
   * Used to compute the backoff delay and to throttle error logging.
   */
  private consecutiveErrors = 0;
  private errorSessionLogged = false;

  constructor() {
    super();
  }

  /**
   * Start monitoring the active window
   */
  public start(): void {
    if (this.pollingTimeout) {
      console.log('FocusMonitor: Already running');
      return;
    }

    console.log('FocusMonitor: Starting...');
    this.warnIfTranslocated();
    this.scheduleNext(0);
  }

  /**
   * Stop monitoring the active window
   */
  public stop(): void {
    if (this.pollingTimeout) {
      clearTimeout(this.pollingTimeout);
      this.pollingTimeout = null;
      console.log('FocusMonitor: Stopped');
    }
  }

  /**
   * Get the current overlay state
   */
  public getCurrentOverlayState(): boolean {
    return this.isOverlayMode;
  }

  private scheduleNext(delayMs: number): void {
    this.pollingTimeout = setTimeout(() => {
      void this.checkActiveWindow().finally(() => {
        const nextDelay = this.consecutiveErrors > 0
          ? Math.min(this.POLL_INTERVAL_MS * 2 ** (this.consecutiveErrors - 1), this.MAX_BACKOFF_MS)
          : this.POLL_INTERVAL_MS;
        this.scheduleNext(nextDelay);
      });
    }, delayMs);
  }

  /**
   * Check the currently active window and update overlay state
   */
  private async checkActiveWindow(): Promise<void> {
    try {
      const activeWindow = await activeWin(ACTIVE_WIN_OPTIONS);
      this.onSuccess();

      if (!activeWindow) {
        // No active window detected, maintain current state
        return;
      }

      const shouldBeOverlay = this.shouldBeInOverlayMode(activeWindow);

      // Only emit state change if state actually changed and enough time has passed
      if (shouldBeOverlay !== this.isOverlayMode) {
        const now = Date.now();
        if (now - this.lastStateChangeTime >= this.MIN_STATE_CHANGE_INTERVAL_MS) {
          this.isOverlayMode = shouldBeOverlay;
          this.lastStateChangeTime = now;

          console.log(`FocusMonitor: Overlay mode ${shouldBeOverlay ? 'ENABLED' : 'DISABLED'} (focused: ${activeWindow.owner.name})`);
          this.emit('overlay-state-changed', shouldBeOverlay);
        }
      }
    } catch (error) {
      this.onFailure(error);
    }
  }

  /**
   * Called after a successful active-win call. Resets the failure counters.
   */
  private onSuccess(): void {
    if (this.consecutiveErrors > 0) {
      console.log(`FocusMonitor: recovered after ${this.consecutiveErrors} failed active-win call(s).`);
    }
    this.consecutiveErrors = 0;
    this.errorSessionLogged = false;
  }

  /**
   * Called when an active-win call throws. Applies backoff + throttled logging
   * and, on macOS, prints a one-time hint about the Accessibility permission.
   */
  private onFailure(error: unknown): void {
    this.consecutiveErrors++;

    const message = error instanceof Error ? error.message : String(error);
    const isBenign = message.includes('EACCES');

    if (!this.errorSessionLogged) {
      this.errorSessionLogged = true;
      if (!isBenign) {
        console.error('FocusMonitor: Error checking active window:', error);
      }
      if (process.platform === 'darwin') {
        console.warn(
          'FocusMonitor: active-win is failing. If you launched VOTC directly ' +
          'from the DMG, move it to /Applications and relaunch — App ' +
          'Translocation breaks the native helper.'
        );
      }
    } else if (this.consecutiveErrors % 20 === 0) {
      console.warn(
        `FocusMonitor: active-win still failing (${this.consecutiveErrors} consecutive errors). Retrying with backoff.`
      );
    }
  }

  /**
   * Log a one-time warning if the app is running from an App Translocation path.
   */
  private warnIfTranslocated(): void {
    if (process.platform === 'darwin' && process.execPath.includes('AppTranslocation')) {
      console.warn(
        'FocusMonitor: App is running from an App Translocation path (launched ' +
        'directly from the DMG/Downloads). This can break unpacked native modules ' +
        '(active-win) and code signing. Please drag VOTC into /Applications and ' +
        'launch it from there.'
      );
    }
  }

  /**
   * Determine if the app should be in overlay mode based on the active window
   */
  private shouldBeInOverlayMode(activeWindow: activeWin.Result): boolean {
    const processName = activeWindow.owner.name.toLowerCase();
    const processPath = activeWindow.owner.path?.toLowerCase() || '';

    // active-win's MacOSOwner exposes a bundleId; other platforms do not.
    const bundleId = 'bundleId' in activeWindow.owner
      ? activeWindow.owner.bundleId.toLowerCase()
      : '';

    // Check if CK3 is focused
    if (
      processName.includes('ck3') ||
      processName.includes('crusader kings') ||
      processPath.includes('ck3.exe') ||
      processPath.includes('ck3') ||
      processPath.includes('crusader kings') ||
      bundleId.includes('ck3') ||
      bundleId.includes('crusaderkings')
    ) {
      return true;
    }

    // Check if our own app is focused
    const ourAppName = this.getOurAppName();
    if (processName.includes(ourAppName.toLowerCase())) {
      return true;
    }

    // Check by process path for our app
    const ourAppPath = process.execPath.toLowerCase();
    if (processPath === ourAppPath) {
      return true;
    }

    return false;
  }

  /**
   * Get the name of our application executable
   */
  private getOurAppName(): string {
    if (app.isPackaged) {
      // In production, use the product name
      return app.getName();
    } else {
      // In development, it's electron.exe
      return 'electron';
    }
  }
}

// Export a singleton instance
export const focusMonitor = new FocusMonitor();
