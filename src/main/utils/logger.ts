import path from 'path';
import log from 'electron-log';
import fs from 'fs';
import { VOTC_LOGS_DIR } from './paths';

export function initLogger (){
    log.initialize();
    log.transports.file.resolvePathFn = () => path.join(VOTC_LOGS_DIR, 'votc_app.log');
    console.log = log.log;
    console.error = log.error;
    console.warn = log.warn;
    console.info = log.info;    
}

export function clearLog(){
    try {
    fs.mkdirSync(path.dirname(VOTC_LOGS_DIR), { recursive: true });
    fs.writeFileSync(path.join(VOTC_LOGS_DIR, 'votc_app.log'), ''); // Overwrites with empty content
    } catch (error) {
    console.error('Failed to clear log file:', error);
    }
}