import { EventEmitter } from 'events';
import { execFile } from 'child_process';
import { promisify } from 'util';
import activeWin from 'active-win';
import { app } from 'electron';

const execFileAsync = promisify(execFile);

/**
 * Normalized description of the currently frontmost application. Sufficient for
 * overlay-mode decisions; produced by the platform-specific detectors below.
 */
interface ActiveApp {
  /** Display name (derived from path/bundle on macOS). */
  name: string;
  /** macOS bundle identifier when known; '' otherwise. */
  bundleId: string;
  /** App bundle / executable path. */
  path: string;
}

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
   * Maximum delay between polls when detection is failing. Backs off
   * exponentially up to this cap to avoid spawning helpers in a tight loop.
   */
  private readonly MAX_BACKOFF_MS = 10000;

  private consecutiveErrors = 0;
  private errorSessionLogged = false;
  /** True after the first successful detection (for one-time diagnostic logging). */
  private detectionConfirmed = false;

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

  /**
   * Self-scheduling loop (see scheduleNext) so we can adapt the delay on
   * failure. Checks immediately on start, then at fixed/backoff intervals.
   */
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
      const activeApp = await this.getActiveApp();
      this.onSuccess();

      if (!activeApp) {
        // No active window detected, maintain current state
        return;
      }
      this.confirmDetection(activeApp);

      const shouldBeOverlay = this.shouldBeInOverlayMode(activeApp);

      // Only emit state change if state actually changed and enough time has passed
      if (shouldBeOverlay !== this.isOverlayMode) {
        const now = Date.now();
        if (now - this.lastStateChangeTime >= this.MIN_STATE_CHANGE_INTERVAL_MS) {
          this.isOverlayMode = shouldBeOverlay;
          this.lastStateChangeTime = now;

          console.log(`FocusMonitor: Overlay mode ${shouldBeOverlay ? 'ENABLED' : 'DISABLED'} (focused: ${this.describeApp(activeApp)})`);
          this.emit('overlay-state-changed', shouldBeOverlay);
        }
      }
    } catch (error) {
      this.onFailure(error);
    }
  }

  /**
   * Get the frontmost app using a platform-appropriate, permission-free method.
   *
   * - macOS: `osascript` Standard Additions returning the POSIX path of the
   *   frontmost app. This does NOT use Accessibility and does NOT send Apple
   *   Events to other apps, so it triggers NO system permission prompts. We
   *   deliberately avoid the `active-win` native binary on macOS (its compiled
   *   helper calls `AXIsProcessTrustedWithOptions` on every invocation,
   *   repeatedly popping the "control this computer using accessibility
   *   features" dialog).
   * - Windows/Linux: `active-win` (in-process; no permission prompts).
   *
   * Throws on genuine failure so the caller logs + backs off; returns null
   * only when there is no frontmost app.
   */
  private async getActiveApp(): Promise<ActiveApp | null> {
    if (process.platform === 'darwin') {
      return this.getMacFrontmostApp();
    }
    return this.getActiveWinApp();
  }

  /**
   * macOS frontmost-app detection via AppleScript Standard Additions.
   *
   * `path to frontmost application` + `POSIX path of` is a Standard Additions
   * query that returns e.g. `/System/Applications/Utilities/Terminal.app/`.
   * It requires neither Accessibility nor Automation permission (verified to
   * work where `id of application (...)` fails with -1728).
   *
   * Note: the `id of application (...)` form was tried first and FAILS (-1728);
   * `lsappinfo info -only bundleid <ASN>` returns empty output on current macOS.
   * The POSIX path is the only reliable, prompt-free signal — so we match on
   * the path (see shouldBeInOverlayMode).
   */
  private async getMacFrontmostApp(): Promise<ActiveApp | null> {
    const { stdout } = await execFileAsync('osascript', [
      '-e',
      'return POSIX path of (path to frontmost application)'
    ]);
    const appPath = stdout.trim();
    if (!appPath) {
      return null;
    }
    // Derive a display name from the .app bundle name (e.g. "/.../Terminal.app/" -> "Terminal").
    const name = this.macAppNameFromPath(appPath);
    return { name, bundleId: '', path: appPath };
  }

  /** Extract a display name from a macOS .app path. */
  private macAppNameFromPath(appPath: string): string {
    // e.g. "/Applications/Crusader Kings III.app/" -> "Crusader Kings III"
    const match = appPath.match(/\/([^/]+)\.app\/?$/);
    return match ? match[1] : appPath.replace(/\/+$/, '').split('/').pop() || appPath;
  }

  /**
   * Windows/Linux frontmost-app detection via active-win.
   */
  private async getActiveWinApp(): Promise<ActiveApp | null> {
    // Both flags are required by active-win's Options type. On Windows/Linux
    // they are accepted and harmless; no permission prompts are shown.
    const w = await activeWin({
      accessibilityPermission: false,
      screenRecordingPermission: false
    });
    if (!w) {
      return null;
    }
    const bundleId = 'bundleId' in w.owner ? w.owner.bundleId : '';
    return {
      name: w.owner.name,
      bundleId,
      path: w.owner.path || ''
    };
  }

  private onSuccess(): void {
    if (this.consecutiveErrors > 0) {
      console.log(`FocusMonitor: recovered after ${this.consecutiveErrors} failed detection call(s).`);
    }
    this.consecutiveErrors = 0;
    this.errorSessionLogged = false;
  }

  /** One-time confirmation that detection is producing results (for diagnostics). */
  private confirmDetection(activeApp: ActiveApp): void {
    if (this.detectionConfirmed) {
      return;
    }
    this.detectionConfirmed = true;
    console.log(
      `FocusMonitor: frontmost-app detection working (initial frontmost: ${this.describeApp(activeApp)}).`
    );
  }

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
          'FocusMonitor: frontmost-app detection failed. If you launched VOTC ' +
          'directly from the DMG, move it to /Applications and relaunch.'
        );
      }
    } else if (this.consecutiveErrors % 20 === 0) {
      console.warn(
        `FocusMonitor: detection still failing (${this.consecutiveErrors} consecutive errors). Retrying with backoff.`
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
        'directly from the DMG/Downloads). This breaks helper processes and ' +
        'defeats code signing. Please drag VOTC into /Applications and launch ' +
        'it from there.'
      );
    }
  }

  /**
   * Determine if the app should be in overlay mode based on the frontmost app.
   *
   * CK3 detection is cross-platform:
   *  - Windows: the `ck3.exe` process.
   *  - macOS:   the "Crusader Kings III.app" bundle (path/name contains
   *             'crusader kings iii' or 'ck3').
   */
  private shouldBeInOverlayMode(activeApp: ActiveApp): boolean {
    const name = activeApp.name.toLowerCase();
    const bundleId = activeApp.bundleId.toLowerCase();
    const appPath = activeApp.path.toLowerCase();

    // --- CK3 (Windows + macOS) ---
    if (
      name.includes('ck3') ||
      name.includes('crusader kings') ||
      appPath.includes('ck3.exe') ||
      appPath.includes('ck3') ||
      appPath.includes('crusader kings iii') ||
      bundleId.includes('ck3') ||
      bundleId.includes('crusaderkings')
    ) {
      return true;
    }

    // --- Our own app ---
    const ourAppName = this.getOurAppName().toLowerCase();
    if (name.includes(ourAppName)) {
      return true;
    }
    if (bundleId.includes('votc') || bundleId.includes('mrandropc')) {
      return true;
    }
    // macOS: compare .app bundle directories, and accept a 'votc' name match.
    if (appPath.includes('/votc.app')) {
      return true;
    }
    const ourAppDir = this.ourMacAppBundleDir();
    if (ourAppDir && appPath.startsWith(ourAppDir.toLowerCase())) {
      return true;
    }
    // Windows/Linux: match by executable path
    if (appPath && appPath === process.execPath.toLowerCase()) {
      return true;
    }

    return false;
  }

  /**
   * On macOS, the `.app` bundle directory of this app (e.g.
   * '/Applications/VOTC.app'), derived from process.execPath. Returns '' on
   * other platforms or when execPath isn't inside an .app bundle.
   */
  private ourMacAppBundleDir(): string {
    const match = process.execPath.match(/^(.+?\.app)\//i);
    return match ? match[1] : '';
  }

  /** Human-readable label for an app, for log lines. */
  private describeApp(activeApp: ActiveApp): string {
    return activeApp.name || activeApp.bundleId || activeApp.path;
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
