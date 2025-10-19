import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { VOTC_SUMMARIES_DIR } from './paths';

interface ImportResult {
  success: boolean;
  message: string;
  filesCopied?: number;
  errors?: string[];
}

export async function importLegacySummaries(): Promise<ImportResult> {
  try {
    // Get the current user's AppData Roaming path
    const appDataPath = app.getPath('appData');
    const legacySummariesPath = path.join(appDataPath, 'Voices of the Court', 'votc_data', 'conversation_summaries');
    
    // Check if legacy path exists
    if (!fs.existsSync(legacySummariesPath)) {
      return {
        success: false,
        message: 'Legacy summaries folder not found. Please ensure VOTC is installed.',
      };
    }
    
    // Ensure target directory exists
    if (!fs.existsSync(VOTC_SUMMARIES_DIR)) {
      fs.mkdirSync(VOTC_SUMMARIES_DIR, { recursive: true });
    }
    
    // Copy files with error handling
    const result = await copyDirectory(legacySummariesPath, VOTC_SUMMARIES_DIR);
    
    return {
      success: result.success,
      message: result.success ? 'Legacy summaries imported successfully!' : 'Import completed with errors.',
      filesCopied: result.filesCopied,
      errors: result.errors,
    };
  } catch (error) {
    return {
      success: false,
      message: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

async function copyDirectory(src: string, dest: string): Promise<{ success: boolean; filesCopied: number; errors: string[] }> {
  let filesCopied = 0;
  const errors: string[] = [];
  
  try {
    // Create destination directory if it doesn't exist
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    
    // Read all items in source directory
    const items = fs.readdirSync(src, { withFileTypes: true });
    
    for (const item of items) {
      const srcPath = path.join(src, item.name);
      const destPath = path.join(dest, item.name);
      
      try {
        if (item.isDirectory()) {
          // Recursively copy subdirectories
          const subResult = await copyDirectory(srcPath, destPath);
          filesCopied += subResult.filesCopied;
          errors.push(...subResult.errors);
        } else if (item.isFile() && item.name.endsWith('.json')) {
          // Copy JSON files (conversation summaries)
          const fileContent = fs.readFileSync(srcPath, 'utf8');
          
          // Check if file already exists and handle conflict
          if (fs.existsSync(destPath)) {
            const existingContent = fs.readFileSync(destPath, 'utf8');
            if (existingContent !== fileContent) {
              // Create backup of existing file
              const backupPath = path.join(dest, `${item.name}.backup`);
              fs.writeFileSync(backupPath, existingContent);
              console.log(`Created backup: ${backupPath}`);
            }
          }
          
          fs.writeFileSync(destPath, fileContent);
          filesCopied++;
        }
      } catch (error) {
        errors.push(`Failed to copy ${item.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    return {
      success: errors.length === 0,
      filesCopied,
      errors,
    };
  } catch (error) {
    errors.push(`Directory copy failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return {
      success: false,
      filesCopied,
      errors,
    };
  }
}