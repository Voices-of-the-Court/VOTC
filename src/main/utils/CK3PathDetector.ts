import fs from 'fs';
import path from 'path';
import os from 'os';

export interface CK3DetectionResult {
  path: string | null;
  source: 'local' | 'onedrive' | 'linux' | 'macos' | 'existing' | null;
  error?: string;
}

export class CK3PathDetector {
  private static CK3_FOLDER_NAME = 'Crusader Kings III';
  private static PARADOX_FOLDER_NAME = 'Paradox Interactive';

  /**
   * Get all possible CK3 user folder locations
   */
  private static getPossiblePaths(): Array<{ path: string; source: CK3DetectionResult['source'] }> {
    const homeDir = os.homedir();
    const platform = os.platform();
    const possiblePaths: Array<{ path: string; source: CK3DetectionResult['source'] }> = [];

    if (platform === 'win32') {
      // Windows local documents
      const localDocsPath = path.join(homeDir, 'Documents', this.PARADOX_FOLDER_NAME, this.CK3_FOLDER_NAME);
      possiblePaths.push({ path: localDocsPath, source: 'local' });

      // OneDrive documents
      const oneDriveDocsPath = path.join(homeDir, 'OneDrive', 'Documents', this.PARADOX_FOLDER_NAME, this.CK3_FOLDER_NAME);
      possiblePaths.push({ path: oneDriveDocsPath, source: 'onedrive' });
    } else if (platform === 'linux') {
      // Linux: ~/.local/share/Paradox Interactive/Crusader Kings III
      const linuxPath = path.join(homeDir, '.local', 'share', this.PARADOX_FOLDER_NAME, this.CK3_FOLDER_NAME);
      possiblePaths.push({ path: linuxPath, source: 'linux' });
    } else if (platform === 'darwin') {
      // macOS: ~/Documents/Paradox Interactive/Crusader Kings III
      const macPath = path.join(homeDir, 'Documents', this.PARADOX_FOLDER_NAME, this.CK3_FOLDER_NAME);
      possiblePaths.push({ path: macPath, source: 'macos' });
    }

    return possiblePaths;
  }

  /**
   * Get the debug.log modification time for a CK3 folder
   */
  private static getDebugLogModTime(ck3FolderPath: string): number | null {
    const debugLogPath = path.join(ck3FolderPath, 'logs', 'debug.log');
    
    try {
      if (fs.existsSync(debugLogPath)) {
        const stats = fs.statSync(debugLogPath);
        return stats.mtimeMs;
      }
    } catch (error) {
      console.error(`Error checking debug.log for ${ck3FolderPath}:`, error);
    }
    
    return null;
  }

  /**
   * Check if a folder exists and is a valid CK3 user folder
   */
  private static isValidCK3Folder(folderPath: string): boolean {
    try {
      if (!fs.existsSync(folderPath)) {
        return false;
      }
      
      // Check if it's a directory
      const stats = fs.statSync(folderPath);
      if (!stats.isDirectory()) {
        return false;
      }

      // Check for common CK3 folder structure (logs folder exists)
      const logsPath = path.join(folderPath, 'logs');
      if (fs.existsSync(logsPath)) {
        return true;
      }

      // Even without logs folder, if the path exists it might be valid
      // (CK3 might not have been run yet)
      return true;
    } catch (error) {
      console.error(`Error validating CK3 folder ${folderPath}:`, error);
      return false;
    }
  }

  /**
   * Auto-detect CK3 user folder path
   * Returns the detected path, or null if not found
   */
  static detectCK3Path(existingPath?: string | null): CK3DetectionResult {
    // If there's an existing path configured, validate it first
    if (existingPath) {
      if (this.isValidCK3Folder(existingPath)) {
        return {
          path: existingPath,
          source: 'existing',
        };
      }
    }

    const possiblePaths = this.getPossiblePaths();
    
    // For Windows, we need special handling for local vs OneDrive
    if (os.platform() === 'win32') {
      const validPaths: Array<{ path: string; source: CK3DetectionResult['source']; modTime: number | null }> = [];
      
      for (const { path: p, source } of possiblePaths) {
        if (this.isValidCK3Folder(p)) {
          const modTime = this.getDebugLogModTime(p);
          validPaths.push({ path: p, source, modTime });
        }
      }

      // If both local and OneDrive exist, choose the one with newest debug.log
      if (validPaths.length > 1) {
        // Sort by modification time (newest first)
        validPaths.sort((a, b) => {
          if (a.modTime === null && b.modTime === null) return 0;
          if (a.modTime === null) return 1;
          if (b.modTime === null) return -1;
          return b.modTime - a.modTime;
        });
      }

      if (validPaths.length > 0) {
        const selected = validPaths[0];
        return {
          path: selected.path,
          source: selected.source,
        };
      }
    } else {
      // For Linux and macOS, just find the first valid path
      for (const { path: p, source } of possiblePaths) {
        if (this.isValidCK3Folder(p)) {
          return {
            path: p,
            source,
          };
        }
      }
    }

    return {
      path: null,
      source: null,
      error: 'CK3 user folder not found. Please manually configure the path in settings.'
    };
  }

  /**
   * Get a user-friendly description of the detected path source
   */
  static getSourceDescription(source: CK3DetectionResult['source']): string {
    switch (source) {
      case 'local':
        return 'Local Documents folder';
      case 'onedrive':
        return 'OneDrive Documents folder';
      case 'linux':
        return 'Linux user data folder';
      case 'macos':
        return 'macOS Documents folder';
      case 'existing':
        return 'Previously configured path';
      default:
        return 'Unknown';
    }
  }
}
