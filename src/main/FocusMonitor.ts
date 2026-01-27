import { EventEmitter } from 'events';
import activeWin from 'active-win';
import { app } from 'electron';

/**
 * Monitors the currently focused window and determines if the app should be in overlay mode.
 * Overlay mode is active when CK3 or the app itself is focused.
 */
export class FocusMonitor extends EventEmitter {
  private pollingInterval: NodeJS.Timeout | null = null;
  private isOverlayMode: boolean = false;
  private lastStateChangeTime: number = 0;
  private readonly POLL_INTERVAL_MS = 500;
  private readonly MIN_STATE_CHANGE_INTERVAL_MS = 200;

  constructor() {
    super();
  }

  /**
   * Start monitoring the active window
   */
  public start(): void {
    if (this.pollingInterval) {
      console.log('FocusMonitor: Already running');
      return;
    }

    console.log('FocusMonitor: Starting...');
    
    // Check immediately on start
    this.checkActiveWindow();

    // Then poll at regular intervals
    this.pollingInterval = setInterval(() => {
      this.checkActiveWindow();
    }, this.POLL_INTERVAL_MS);
  }

  /**
   * Stop monitoring the active window
   */
  public stop(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log('FocusMonitor: Stopped');
    }
  }

  /**
   * Get the current overlay state
   */
  public getCurrentOverlayState(): boolean {
    return this.isOverlayMode;
  }

  /**
   * Check the currently active window and update overlay state
   */
  private async checkActiveWindow(): Promise<void> {
    try {
      const activeWindow = await activeWin();
      
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
      // Silently handle errors - active-win can fail on some systems
      // We don't want to spam the console with errors
      if (error instanceof Error && !error.message.includes('EACCES')) {
        console.error('FocusMonitor: Error checking active window:', error);
      }
    }
  }

  /**
   * Determine if the app should be in overlay mode based on the active window
   */
  private shouldBeInOverlayMode(activeWindow: activeWin.Result): boolean {
    const processName = activeWindow.owner.name.toLowerCase();
    const processPath = activeWindow.owner.path?.toLowerCase() || '';
    
    // Check if CK3 is focused
    if (processName.includes('ck3') || processPath.includes('ck3.exe')) {
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
