/**
 * @file logger.ts
 * @description Logging system for agent operations
 */

import { LogEntry } from './types.js';
import * as fs from 'fs';

export class Logger {
  private logs: LogEntry[] = [];
  private logFile?: string;
  private verbose: boolean;

  constructor(logFile?: string, verbose = false) {
    this.logFile = logFile;
    this.verbose = verbose;
  }

  private log(level: LogEntry['level'], message: string, data?: any): void {
    const entry: LogEntry = {
      level,
      timestamp: Date.now(),
      message,
      data,
    };

    this.logs.push(entry);

    // Console output
    if (this.verbose || level === 'error' || level === 'warn') {
      const prefix = `[${level.toUpperCase()}]`;
      const timestamp = new Date(entry.timestamp).toISOString();
      console.log(`${prefix} ${timestamp} - ${message}`);
      if (data && this.verbose) {
        console.log(JSON.stringify(data, null, 2));
      }
    }

    // File output
    if (this.logFile) {
      fs.appendFileSync(this.logFile, JSON.stringify(entry) + '\n');
    }
  }

  info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: any): void {
    this.log('error', message, data);
  }

  debug(message: string, data?: any): void {
    if (this.verbose) {
      this.log('debug', message, data);
    }
  }

  getLogs(level?: LogEntry['level']): LogEntry[] {
    if (level) {
      return this.logs.filter(log => log.level === level);
    }
    return [...this.logs];
  }

  clear(): void {
    this.logs = [];
  }

  export(path: string): void {
    fs.writeFileSync(path, JSON.stringify(this.logs, null, 2));
  }
}

export default Logger;
