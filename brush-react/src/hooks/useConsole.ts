import { useState, useCallback } from 'react';

export interface LogEntry {
  id: number;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
  timestamp: Date;
}

let logId = 0;

export function useConsole() {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const log = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [
      ...prev,
      {
        id: ++logId,
        message,
        type,
        timestamp: new Date(),
      },
    ]);
  }, []);

  const clear = useCallback(() => {
    setLogs([]);
  }, []);

  return { logs, log, clear };
}
