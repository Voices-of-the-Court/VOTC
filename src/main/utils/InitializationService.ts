import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { settingsRepository } from '../SettingsRepository';
import { CK3PathDetector, CK3DetectionResult } from './CK3PathDetector';

export interface InitializationWarning {
  type: 'ironman' | 'permission' | 'path_not_found' | 'path_detection' | 'debug_log_missing' | 'debug_log_unreadable';
  message: string;
  suggestion?: string;
}

export interface InitializationResult {
  success: boolean;
  ck3Path: string | null;
  warnings: InitializationWarning[];
  detectionResult?: CK3DetectionResult;
}

class InitializationService extends EventEmitter {
  private initialized: boolean = false;
  private currentWarnings: InitializationWarning[] = [];

  /**
   * Run full initialization: detect CK3 path, create required files, check for issues
   */
  async initialize(): Promise<InitializationResult> {
    console.log('InitializationService: Starting initialization...');
    const warnings: InitializationWarning[] = [];

    // Step 1: Detect or validate CK3 path
    const existingPath = settingsRepository.getCK3UserFolderPath();
    const detectionResult = CK3PathDetector.detectCK3Path(existingPath);

    if (!detectionResult.path) {
      warnings.push({
        type: 'path_not_found',
        message: detectionResult.error || 'CK3 user folder not found',
        suggestion: 'Please manually configure the CK3 user folder path in settings.'
      });

      this.currentWarnings = warnings;
      this.emit('initialization-complete', { success: false, ck3Path: null, warnings, detectionResult });
      return { success: false, ck3Path: null, warnings, detectionResult };
    }

    // Determine the path to use: prefer user-configured path, only save auto-detected if none existed
    let ck3Path: string;
    if (existingPath) {
      // User has configured a path - use it, don't overwrite with auto-detection
      ck3Path = existingPath;
      console.log(`InitializationService: Using user-configured CK3 path: ${ck3Path}`);
    } else {
      // No user-configured path - use auto-detected path and save it
      ck3Path = detectionResult.path;
      console.log(`InitializationService: Auto-detected CK3 path: ${ck3Path} (${detectionResult.source})`);
      settingsRepository.setCK3UserFolderPath(ck3Path);
    }

    // Step 2: Check for debug.log existence and readability
    const debugLogResult = this.checkDebugLog(ck3Path);
    if (!debugLogResult.exists) {
      warnings.push({
        type: 'debug_log_missing',
        message: 'CK3 debug.log file not found',
        suggestion: 'The debug.log file is missing. Make sure CK3 has been launched at least once with debug mode enabled.'
      });
    } else if (!debugLogResult.readable) {
      warnings.push({
        type: 'debug_log_unreadable',
        message: 'CK3 debug.log file is not readable',
        suggestion: 'Permission denied while reading debug.log. Try running the application as Administrator.'
      });
    }

    // Step 3: Check for Iron Man mode (only if debug.log exists and is readable)
    const isIronMan = debugLogResult.exists && debugLogResult.readable 
      ? InitializationService.checkIronMan(ck3Path) 
      : false;
    if (isIronMan) {
      warnings.push({
        type: 'ironman',
        message: 'Iron Man save detected',
        suggestion: 'Iron Man saves do not support action execution. You can still have conversations, but game actions will not work.'
      });
    }

    // Step 4: Create required files
    const fileCreationResult = await this.createRequiredFiles(ck3Path);
    if (!fileCreationResult.success) {
      warnings.push(...fileCreationResult.warnings);
    }

    // Step 5: Test write permissions
    const permissionResult = await this.testWritePermissions(ck3Path);
    if (!permissionResult.success) {
      warnings.push(...permissionResult.warnings);
    }

    this.currentWarnings = warnings;
    this.initialized = true;
    this.emit('initialization-complete', { success: true, ck3Path, warnings, detectionResult });

    console.log(`InitializationService: Initialization complete. Path: ${ck3Path}, Warnings: ${warnings.length}`);
    return { success: true, ck3Path, warnings, detectionResult };
  }

  /**
   * Check if debug.log exists and is readable
   */
  private checkDebugLog(ck3Path: string): { exists: boolean; readable: boolean } {
    const debugLogPath = path.join(ck3Path, 'logs', 'debug.log');
    
    try {
      if (!fs.existsSync(debugLogPath)) {
        console.log(`InitializationService: debug.log not found at ${debugLogPath}`);
        return { exists: false, readable: false };
      }

      // Try to read a small portion to verify it's readable
      const fd = fs.openSync(debugLogPath, 'r');
      const buffer = Buffer.alloc(1024);
      fs.readSync(fd, buffer, 0, 1024, 0);
      fs.closeSync(fd);

      console.log(`InitializationService: debug.log found and readable at ${debugLogPath}`);
      return { exists: true, readable: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`InitializationService: Error checking debug.log: ${errorMessage}`);
      
      // File exists but can't be read
      if (fs.existsSync(debugLogPath)) {
        return { exists: true, readable: false };
      }
      
      return { exists: false, readable: false };
    }
  }

  /**
   * Create required files in the CK3 run folder
   */
  async createRequiredFiles(ck3Path: string): Promise<{ success: boolean; warnings: InitializationWarning[] }> {
    const warnings: InitializationWarning[] = [];
    const runFolderPath = path.join(ck3Path, 'run');

    try {
      // Create run folder if it doesn't exist
      if (!fs.existsSync(runFolderPath)) {
        fs.mkdirSync(runFolderPath, { recursive: true });
        console.log(`InitializationService: Created run folder: ${runFolderPath}`);
      }

      // Create votc.txt
      const votcPath = path.join(runFolderPath, 'votc.txt');
      if (!fs.existsSync(votcPath)) {
        fs.writeFileSync(votcPath, '', 'utf-8');
        console.log(`InitializationService: Created votc.txt`);
      } else {
        // Ensure file is empty on initialization
        fs.writeFileSync(votcPath, '', 'utf-8');
        console.log(`InitializationService: Cleared votc.txt`);
      }

      // Create letters.txt with the expected initial content
      const lettersPath = path.join(runFolderPath, 'letters.txt');
      const initialLettersContent = 'debug_log = "[Localize(\'talk_event.9999.desc\')]"';
      if (!fs.existsSync(lettersPath)) {
        fs.writeFileSync(lettersPath, initialLettersContent, 'utf-8');
        console.log(`InitializationService: Created letters.txt`);
      } else {
        // Reset letters.txt to initial state
        fs.writeFileSync(lettersPath, initialLettersContent, 'utf-8');
        console.log(`InitializationService: Reset letters.txt`);
      }

      return { success: true, warnings: [] };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isPermissionError = this.isPermissionError(error);

      warnings.push({
        type: isPermissionError ? 'permission' : 'path_not_found',
        message: `Failed to create required files: ${errorMessage}`,
        suggestion: isPermissionError
          ? 'Permission denied. Please try running the application as Administrator.'
          : undefined
      });

      return { success: false, warnings };
    }
  }

  /**
   * Test write permissions by creating and deleting a test file
   */
  async testWritePermissions(ck3Path: string): Promise<{ success: boolean; warnings: InitializationWarning[] }> {
    const warnings: InitializationWarning[] = [];
    const testFilePath = path.join(ck3Path, 'run', '.votc_permission_test');

    try {
      // Try to write a test file
      fs.writeFileSync(testFilePath, 'test', 'utf-8');
      
      // Try to read it back
      fs.readFileSync(testFilePath, 'utf-8');
      
      // Try to delete it
      fs.unlinkSync(testFilePath);

      return { success: true, warnings: [] };
    } catch (error) {
      const isPermissionError = this.isPermissionError(error);
      
      if (isPermissionError) {
        warnings.push({
          type: 'permission',
          message: 'Write permission denied to CK3 user folder',
          suggestion: 'Please run the application as Administrator to enable write access to the CK3 folder.'
        });
      }

      return { success: false, warnings };
    }
  }

  /**
   * Check if an error is a permission-related error
   */
  private isPermissionError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      const code = (error as NodeJS.ErrnoException).code;
      
      return (
        message.includes('permission') ||
        message.includes('access is denied') ||
        message.includes('epERM') ||
        code === 'EPERM' ||
        code === 'EACCES'
      );
    }
    return false;
  }

  /**
   * Ensure required files exist (called on each conversation run)
   */
  async ensureRequiredFiles(): Promise<{ success: boolean; warnings: InitializationWarning[] }> {
    const warnings: InitializationWarning[] = [];
    const ck3Path = settingsRepository.getCK3UserFolderPath();
    
    if (!ck3Path) {
      return {
        success: false,
        warnings: [{
          type: 'path_not_found',
          message: 'CK3 user folder path is not configured',
          suggestion: 'Please configure the CK3 user folder path in settings.'
        }]
      };
    }

    // Check for debug.log existence and readability first
    const debugLogResult = this.checkDebugLog(ck3Path);
    if (!debugLogResult.exists) {
      warnings.push({
        type: 'debug_log_missing',
        message: 'CK3 debug.log file not found',
        suggestion: 'The debug.log file is missing. Make sure CK3 has been launched at least once with debug mode enabled.'
      });
      // Return early if no debug.log - can't parse game data
      return { success: false, warnings };
    } else if (!debugLogResult.readable) {
      warnings.push({
        type: 'debug_log_unreadable',
        message: 'CK3 debug.log file is not readable',
        suggestion: 'Permission denied while reading debug.log. Try running the application as Administrator.'
      });
      return { success: false, warnings };
    }

    // Check for Iron Man mode (only if debug.log is readable)
    const isIronMan = InitializationService.checkIronMan(ck3Path);
    if (isIronMan) {
      warnings.push({
        type: 'ironman',
        message: 'Iron Man save detected',
        suggestion: 'Iron Man saves do not support action execution. You can still have conversations, but game actions will not work.'
      });
    }

    // Ensure run folder and files exist (skip for Iron Man to avoid issues)
    if (!isIronMan) {
      const fileCreationResult = await this.createRequiredFiles(ck3Path);
      if (!fileCreationResult.success) {
        warnings.push(...fileCreationResult.warnings);
      }
    }

    // Return success if we have at least the debug.log (even with Iron Man warning)
    return { 
      success: debugLogResult.exists && debugLogResult.readable, 
      warnings 
    };
  }

  /**
   * Get current warnings
   */
  getWarnings(): InitializationWarning[] {
    return [...this.currentWarnings];
  }

  /**
   * Check if initialization has been run
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Clear all warnings
   */
  clearWarnings(): void {
    this.currentWarnings = [];
  }

  
  /**
   * Check if the save is Iron Man by looking for specific text in debug.log
   */
  private static checkIronMan(ck3FolderPath: string): boolean {
    const debugLogPath = path.join(ck3FolderPath, 'logs', 'debug.log');
    
    try {
      if (fs.existsSync(debugLogPath)) {
        const content = fs.readFileSync(debugLogPath, 'utf-8');
        return content.includes('No Console commands in ironman!');
      }
    } catch (error) {
      console.error(`Error checking Iron Man status for ${ck3FolderPath}:`, error);
    }
    
    return false;
  }
}

export const initializationService = new InitializationService();
