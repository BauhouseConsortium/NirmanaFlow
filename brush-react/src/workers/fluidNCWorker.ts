/**
 * FluidNC Web Worker
 * Handles WebSocket connection and G-code streaming in a separate thread
 * to keep the main UI thread responsive.
 */

import type {
  WorkerCommand,
  WorkerMessage,
  WorkerConnectOptions,
  FluidNCStatus,
  MachineState,
  MachinePosition,
  Override,
  PositionData,
} from '../schemas/fluidNCSchemas';

// Worker context
const ctx: Worker = self as unknown as Worker;

// ============ State ============

let ws: WebSocket | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let isManualDisconnect = false;
let currentHost = '';
let connectOptions: WorkerConnectOptions = {};

// Streaming state
let streamingLines: string[] = [];
let streamingIndex = 0;
let streamingPaused = false;
let streamingActive = false;
let pendingOkCount = 0;
let streamingTimer: ReturnType<typeof setInterval> | null = null;
let streamingStartTime: number | null = null;
const maxPendingOks = 1; // Conservative: wait for ok before sending next

// Position throttling
let lastPosition: PositionData = { coords: { x: 0, y: 0, z: 0 }, type: 'WPos' };

// ============ Helpers ============

function postMessage(message: WorkerMessage) {
  ctx.postMessage(message);
}

function log(level: 'info' | 'warn' | 'error', message: string) {
  postMessage({ type: 'log', level, message });
}

// ============ Parser Functions ============

function parsePosition(value: string): MachinePosition | null {
  const parts = value.split(',').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    return null;
  }
  const [x, y, z] = parts;
  if (!isFinite(x) || !isFinite(y) || !isFinite(z)) {
    return null;
  }
  return { x, y, z };
}

function parseFeedSpindle(value: string): { feedRate: number; spindleSpeed: number } | null {
  const parts = value.split(',').map(Number);
  if (parts.length !== 2 || parts.some(isNaN)) {
    return null;
  }
  const [feedRate, spindleSpeed] = parts;
  if (feedRate < 0 || spindleSpeed < 0) {
    return null;
  }
  return { feedRate, spindleSpeed };
}

function parseOverride(value: string): Override | null {
  const parts = value.split(',').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    return null;
  }
  const [feed, rapid, spindle] = parts;
  if (feed < 0 || feed > 200 || rapid < 0 || rapid > 100 || spindle < 0 || spindle > 200) {
    return null;
  }
  return { feed, rapid, spindle };
}

function parseMachineState(state: string): MachineState {
  const validStates: MachineState[] = ['Idle', 'Run', 'Hold', 'Alarm', 'Check', 'Home', 'Sleep'];
  return validStates.includes(state as MachineState) ? (state as MachineState) : 'Unknown';
}

function hasPositionChanged(prev: PositionData, next: PositionData, threshold = 0.01): boolean {
  return (
    prev.type !== next.type ||
    Math.abs(prev.coords.x - next.coords.x) > threshold ||
    Math.abs(prev.coords.y - next.coords.y) > threshold ||
    Math.abs(prev.coords.z - next.coords.z) > threshold
  );
}

function parseStatusMessage(data: string): Partial<FluidNCStatus> | null {
  const match = data.match(/<([^|>]+)(.*)>/);
  if (!match) return null;

  const state = parseMachineState(match[1]);
  const fields = match[2].split('|').filter(Boolean);

  const updates: Partial<FluidNCStatus> = {
    machineState: state,
    lastMessage: data,
  };

  for (const field of fields) {
    const colonIndex = field.indexOf(':');
    if (colonIndex === -1) continue;

    const key = field.substring(0, colonIndex);
    const value = field.substring(colonIndex + 1);

    switch (key) {
      case 'WPos': {
        const coords = parsePosition(value);
        if (coords) {
          updates.position = { coords, type: 'WPos' };
        }
        break;
      }
      case 'MPos':
        // Ignore Machine Position
        break;
      case 'FS': {
        const fs = parseFeedSpindle(value);
        if (fs) {
          updates.feedRate = fs.feedRate;
          updates.spindleSpeed = fs.spindleSpeed;
        }
        break;
      }
      case 'Ov': {
        const override = parseOverride(value);
        if (override) {
          updates.override = override;
        }
        break;
      }
    }
  }

  return updates;
}

// ============ Streaming ============

function sendNextStreamingLines() {
  if (!streamingActive || streamingPaused) return;
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  const totalLines = streamingLines.length;

  // Send lines while we have buffer space and lines to send
  while (
    pendingOkCount < maxPendingOks &&
    streamingIndex < totalLines &&
    !streamingPaused
  ) {
    const lineIndex = streamingIndex;
    const line = streamingLines[lineIndex].trim();

    // Skip empty lines and comments (but still count them for progress)
    if (line && !line.startsWith(';') && !line.startsWith('(') && line !== '%') {
      ws.send(line + '\n');
      pendingOkCount++;

      // Update progress
      postMessage({
        type: 'streaming',
        data: {
          currentLine: lineIndex + 1,
          percentage: Math.round(((lineIndex + 1) / totalLines) * 100),
          currentCommand: line,
          elapsedTime: streamingStartTime ? Date.now() - streamingStartTime : 0,
        },
      });
    } else {
      // Still update progress for skipped lines
      postMessage({
        type: 'streaming',
        data: {
          currentLine: lineIndex + 1,
          percentage: Math.round(((lineIndex + 1) / totalLines) * 100),
          elapsedTime: streamingStartTime ? Date.now() - streamingStartTime : 0,
        },
      });
    }

    streamingIndex++;
  }

  // Check for completion when all lines sent and all oks received
  if (streamingIndex >= totalLines && pendingOkCount === 0) {
    streamingActive = false;
    if (streamingTimer) {
      clearInterval(streamingTimer);
      streamingTimer = null;
    }
    postMessage({
      type: 'streaming',
      data: {
        state: 'completed',
        percentage: 100,
        currentCommand: 'Complete',
        elapsedTime: streamingStartTime ? Date.now() - streamingStartTime : 0,
      },
    });
  }
}

function updateStreamingTime() {
  if (streamingActive && streamingStartTime) {
    postMessage({
      type: 'streaming',
      data: {
        elapsedTime: Date.now() - streamingStartTime,
      },
    });
  }
}

// ============ WebSocket Handling ============

function handleWebSocketMessage(data: string) {
  // Handle multiline messages
  const lines = data.split('\n').map((l: string) => l.trim()).filter(Boolean);

  for (const line of lines) {
    // Check for status report: <State|...>
    if (line.startsWith('<') && line.includes('|')) {
      const updates = parseStatusMessage(line);
      if (updates) {
        // Throttle position updates
        if (updates.position) {
          if (!hasPositionChanged(lastPosition, updates.position, 0.01)) {
            // Position hasn't changed significantly, skip position update
            const { position: _, ...otherUpdates } = updates;
            if (Object.keys(otherUpdates).length > 0) {
              postMessage({ type: 'status', data: otherUpdates });
            }
            continue;
          }
          lastPosition = updates.position;
        }
        postMessage({ type: 'status', data: updates });
      }
    } else if (line.startsWith('error:')) {
      // Error message
      postMessage({ type: 'status', data: { lastError: line, lastMessage: line } });
      // Handle streaming error
      if (streamingActive) {
        postMessage({
          type: 'streaming',
          data: { errors: [line] }, // Will be appended in main thread
        });
        pendingOkCount = Math.max(0, pendingOkCount - 1);
        sendNextStreamingLines();
      }
    } else if (line === 'ok' || line.toLowerCase() === 'ok') {
      // ok response - critical for streaming flow control
      postMessage({ type: 'status', data: { lastMessage: line } });
      if (streamingActive) {
        pendingOkCount = Math.max(0, pendingOkCount - 1);
        sendNextStreamingLines();
      }
    } else if (line.startsWith('CURRENT_ID:') || line.startsWith('ACTIVE_ID:')) {
      // FluidNC connection handshake messages
      postMessage({ type: 'status', data: { lastMessage: line } });
    } else if (line.startsWith('[') || line.startsWith('$')) {
      // info messages or settings
      postMessage({ type: 'status', data: { lastMessage: line } });
    } else {
      // Other messages
      postMessage({ type: 'status', data: { lastMessage: line } });
    }
  }
}

function connect(host: string, options: WorkerConnectOptions = {}) {
  if (ws?.readyState === WebSocket.OPEN) {
    return;
  }

  // Clear any pending reconnect
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  isManualDisconnect = false;
  currentHost = host;
  connectOptions = options;

  // Convert HTTP URL to WebSocket URL on port 81
  const wsUrl = host
    .replace(/^https?:\/\//, 'ws://')
    .replace(/:\d+$/, '') + ':81';

  postMessage({ type: 'status', data: { connectionState: 'connecting', lastError: null } });

  try {
    ws = new WebSocket(wsUrl);
    ws.binaryType = 'blob';

    ws.onopen = () => {
      postMessage({ type: 'connected' });
      postMessage({ type: 'status', data: { connectionState: 'connected', lastError: null } });

      // Configure status report to use Work Position
      ws!.send('$10=0\n');

      // Enable auto-reporting if configured
      if (options.autoReport !== false) {
        const interval = options.reportInterval ?? 200;
        ws!.send(`$Report/Interval=${interval}\n`);
      }

      // Query initial status
      ws!.send('?');
    };

    ws.onmessage = async (event) => {
      let data: string;
      if (typeof event.data === 'string') {
        data = event.data;
      } else if (event.data instanceof Blob) {
        data = await event.data.text();
      } else {
        log('warn', `Unknown message type: ${typeof event.data}`);
        return;
      }
      handleWebSocketMessage(data);
    };

    ws.onerror = () => {
      postMessage({
        type: 'status',
        data: { connectionState: 'error', lastError: 'WebSocket connection error' },
      });
      postMessage({ type: 'error', message: 'WebSocket connection error' });
    };

    ws.onclose = () => {
      postMessage({ type: 'disconnected' });
      postMessage({ type: 'status', data: { connectionState: 'disconnected' } });
      ws = null;

      // Auto-reconnect if not manually disconnected
      if (!isManualDisconnect) {
        reconnectTimeout = setTimeout(() => {
          connect(currentHost, connectOptions);
        }, 3000);
      }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connection failed';
    postMessage({
      type: 'status',
      data: { connectionState: 'error', lastError: message },
    });
    postMessage({ type: 'error', message });
  }
}

function disconnect() {
  isManualDisconnect = true;

  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  // Cancel any active streaming
  cancelStreaming();

  if (ws) {
    // Disable auto-reporting before disconnect
    if (ws.readyState === WebSocket.OPEN) {
      ws.send('$Report/Interval=0\n');
    }
    ws.close();
    ws = null;
  }
}

function send(command: string): boolean {
  if (ws?.readyState !== WebSocket.OPEN) {
    return false;
  }
  ws.send(command.endsWith('\n') ? command : command + '\n');
  return true;
}

function sendRealtime(char: string): boolean {
  if (ws?.readyState !== WebSocket.OPEN) {
    return false;
  }
  ws.send(char);
  return true;
}

// ============ Streaming Commands ============

function startStreaming(lines: string[]) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    postMessage({ type: 'error', message: 'Not connected' });
    return;
  }

  // Filter out empty lines but keep for accurate counting
  const filteredLines = lines.filter(line => {
    const trimmed = line.trim();
    return trimmed && trimmed !== '%';
  });

  if (filteredLines.length === 0) {
    postMessage({ type: 'error', message: 'No valid lines to stream' });
    return;
  }

  // Reset streaming state
  streamingLines = filteredLines;
  streamingIndex = 0;
  streamingPaused = false;
  streamingActive = true;
  pendingOkCount = 0;
  streamingStartTime = Date.now();

  postMessage({
    type: 'streaming',
    data: {
      state: 'streaming',
      currentLine: 0,
      totalLines: filteredLines.length,
      percentage: 0,
      currentCommand: 'Starting...',
      startTime: streamingStartTime,
      elapsedTime: 0,
      errors: [],
    },
  });

  // Start elapsed time timer
  if (streamingTimer) {
    clearInterval(streamingTimer);
  }
  streamingTimer = setInterval(updateStreamingTime, 1000);

  // Start sending lines
  sendNextStreamingLines();
}

function pauseStreaming() {
  if (!streamingActive) return;
  streamingPaused = true;
  postMessage({ type: 'streaming', data: { state: 'paused' } });
  // Send feed hold to machine
  sendRealtime('!');
}

function resumeStreaming() {
  if (!streamingActive || !streamingPaused) return;
  streamingPaused = false;
  postMessage({ type: 'streaming', data: { state: 'streaming' } });
  // Resume machine
  sendRealtime('~');
  // Continue sending lines
  sendNextStreamingLines();
}

function cancelStreaming() {
  streamingActive = false;
  streamingPaused = false;
  streamingLines = [];
  streamingIndex = 0;
  pendingOkCount = 0;
  streamingStartTime = null;

  if (streamingTimer) {
    clearInterval(streamingTimer);
    streamingTimer = null;
  }

  postMessage({
    type: 'streaming',
    data: {
      state: 'idle',
      currentLine: 0,
      totalLines: 0,
      percentage: 0,
      currentCommand: '',
      startTime: null,
      elapsedTime: 0,
      errors: [],
    },
  });

  // Stop the machine
  sendRealtime('\x18'); // Soft reset
}

// ============ Message Handler ============

ctx.onmessage = (event: MessageEvent<WorkerCommand>) => {
  const command = event.data;

  switch (command.type) {
    case 'connect':
      connect(command.host, command.options);
      break;

    case 'disconnect':
      disconnect();
      break;

    case 'send':
      send(command.command);
      break;

    case 'sendRealtime':
      sendRealtime(command.char);
      break;

    case 'startStreaming':
      startStreaming(command.lines);
      break;

    case 'pauseStreaming':
      pauseStreaming();
      break;

    case 'resumeStreaming':
      resumeStreaming();
      break;

    case 'cancelStreaming':
      cancelStreaming();
      break;
  }
};

// Signal that worker is ready
postMessage({ type: 'log', level: 'info', message: 'FluidNC worker initialized' });
