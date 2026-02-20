import fs from 'fs';
import path from 'path';
import { settingsRepository } from '../SettingsRepository';

export class RunFileManager{
    private ck3UserPath: string | null;
    private path: string | null;

    constructor(){
        this.ck3UserPath = settingsRepository.getCK3UserFolderPath() || null;
        console.log(`RunFileManager: CK3 user path from settings: ${this.ck3UserPath}`);
        
        if (this.ck3UserPath) {
            this.path = path.join(this.ck3UserPath, 'run', 'votc.txt');
            console.log(`RunFileManager: Resolved votc.txt path: ${this.path}`);
            this.createRunFolder(this.ck3UserPath);
        } else {
            console.warn('RunFileManager: CK3 user folder path is not configured. Run file operations will be disabled.');
            this.path = null;
        }
    }

    write(text: string): void{
        if (!this.path) {
            console.warn('RunFileManager: Cannot write - CK3 user folder is not configured');
            return;
        }
        
        try {
            fs.writeFileSync(this.path, 
`${text}
root = {trigger_event = mcc_event_v2.9003}`, 'utf-8');
            console.log(`RunFileManager: wrote to run file: ${text}`);
        } catch (error) {
            console.error(`RunFileManager: Failed to write to file ${this.path}:`, error);
        }
    }

    append(text: string): void{
        if (!this.path) {
            console.warn('RunFileManager: Cannot append - CK3 user folder is not configured');
            return;
        }
        
        try {
            fs.appendFileSync(this.path, text, 'utf-8');
            console.log(`RunFileManager: appended to run file: ${text}`);
        } catch (error) {
            console.error(`RunFileManager: Failed to append to file ${this.path}:`, error);
        }
    }
    
    clear(): void{
        if (!this.path) {
            console.warn('RunFileManager: Cannot clear - CK3 user folder is not configured');
            return;
        }
        
        try {
            fs.writeFileSync(this.path, "", 'utf-8');
            console.log("RunFileManager: Run File cleared");
        } catch (error) {
            console.error(`RunFileManager: Failed to clear file ${this.path}:`, error);
        }
    }
    
    private createRunFolder(userFolderPath: string): void {
        const runFolderPath = path.join(userFolderPath, 'run');
        console.log(`RunFileManager: Checking run folder path: ${runFolderPath}`);
        
        if (!fs.existsSync(runFolderPath)) {
            try {
                fs.mkdirSync(runFolderPath, { recursive: true });
                console.log(`RunFileManager: Created run folder: ${runFolderPath}`);
            } catch (err) {
                console.error(`RunFileManager: Error creating run folder ${runFolderPath}:`, err);
            }
        } else {
            console.log(`RunFileManager: Run folder already exists: ${runFolderPath}`);
        }
    }

    // Method to check if run file operations are available
    isAvailable(): boolean {
        return this.path !== null;
    }
}

export const runFileManager = new RunFileManager();