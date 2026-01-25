# FluidNC API Reference & Integration Ideas

This document outlines the FluidNC API capabilities discovered through research and proposes integration possibilities for the Surat Batak application.

## Table of Contents

- [Current Implementation](#current-implementation)
- [HTTP API](#http-api)
- [WebSocket API](#websocket-api)
- [Status Reports](#status-reports)
- [Real-time Commands](#real-time-commands)
- [File Management](#file-management)
- [Integration Roadmap](#integration-roadmap)

---

## Current Implementation

Our current `hardware.ts` uses basic HTTP endpoints:

```typescript
// Current approach
fetch(`${baseUrl}/command?cmd=${command}`);  // Send commands
fetch(`${baseUrl}/upload`, { body: formData });  // Upload files
```

**Limitations:**
- Request/response only (no streaming)
- CORS issues requiring `no-cors` fallback (blind mode)
- Arbitrary delays between operations
- No real-time feedback during printing

---

## HTTP API

Base URL: `http://{controller_ip}` (default port 80)

### GET /command

Send G-code or system commands.

```bash
curl "http://192.168.0.248/command?cmd=G0%20X10%20Y10"
curl "http://192.168.0.248/command?cmd=%24SD%2FRun%3D%2Ffile.gcode"
```

| Parameter | Description |
|-----------|-------------|
| `cmd` | URL-encoded G-code or $ command |

**Response:** Plain text with command result or `ok`

#### Possibilities

| Idea | Description | Priority |
|------|-------------|----------|
| Command queue | Send multiple commands and track responses | Medium |
| Error parsing | Parse `error:X` responses for user feedback | High |
| Timeout handling | Detect unresponsive controller | High |

---

### POST /upload

Upload files to SD card or local filesystem.

```bash
curl -F "file=@drawing.gcode" "http://192.168.0.248/upload"
```

**Request:** `multipart/form-data` with file attachment

**Response:** JSON with upload status

#### Possibilities

| Idea | Description | Priority |
|------|-------------|----------|
| Upload progress | Track bytes sent for large files | Low |
| Verify upload | Read back file to confirm integrity | Medium |
| Direct streaming | Skip file, stream G-code directly via WebSocket | High |

---

### GET /status (ESP3D-WebUI)

Get machine status (if ESP3D-WebUI compatible).

```bash
curl "http://192.168.0.248/command?cmd=?"
```

**Response:** Status string like `<Idle|MPos:0.000,0.000,0.000|FS:0,0>`

#### Possibilities

| Idea | Description | Priority |
|------|-------------|----------|
| Poll status | Periodic status checks during idle | Medium |
| Connection indicator | Show connected/disconnected state | High |

---

## WebSocket API

**Port:** 81 (default, or `$HTTP/Port + 1`)

**URL:** `ws://{controller_ip}:81`

The WebSocket connection behaves like a serial port - send newline-terminated commands, receive responses.

### Connection

```typescript
const ws = new WebSocket('ws://192.168.0.248:81');

ws.onopen = () => {
  console.log('Connected to FluidNC');
};

ws.onmessage = (event) => {
  console.log('Received:', event.data);
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};
```

### Sending Commands

```typescript
// Line-oriented commands (need \n)
ws.send('G0 X10 Y10\n');
ws.send('$Report/Interval=100\n');

// Real-time commands (no \n needed)
ws.send('?');  // Status query
ws.send('!');  // Feed hold
ws.send('~');  // Cycle start/resume
```

#### Possibilities

| Idea | Description | Priority |
|------|-------------|----------|
| Persistent connection | Maintain WebSocket throughout session | High |
| Reconnection logic | Auto-reconnect on disconnect | High |
| Connection status UI | Show WebSocket state in header | High |
| Stream G-code | Send line-by-line with flow control | High |
| Real-time position | Sync preview with actual machine | High |
| Command history | Log all sent/received messages | Medium |

---

## Status Reports

### Manual Status Query

Send `?` character to get immediate status.

**Response Format:**
```
<State|MPos:X,Y,Z|FS:Feed,Spindle|WCO:X,Y,Z|Pn:Pins|Ov:F,R,S>
```

| Field | Description | Example |
|-------|-------------|---------|
| State | Machine state | `Idle`, `Run`, `Hold`, `Alarm` |
| MPos | Machine position | `MPos:151.000,149.000,-1.000` |
| WPos | Work position | `WPos:139.000,121.000,-79.000` |
| FS | Feed rate & spindle | `FS:1600,0` |
| WCO | Work coordinate offset | `WCO:12.000,28.000,78.000` |
| Pn | Active input pins | `Pn:XYZ` (limit switches) |
| Ov | Override values | `Ov:100,100,100` (feed, rapid, spindle %) |

### Automatic Reporting

Enable auto-reports for real-time updates without polling.

```typescript
// Enable 100ms auto-reports
ws.send('$Report/Interval=100\n');

// Disable auto-reports
ws.send('$Report/Interval=0\n');
```

**Behavior:**
- When idle: Reports sent only when values change
- When moving: Reports sent at configured interval
- Per-channel: Each connection controls its own reporting

#### Possibilities

| Idea | Description | Priority |
|------|-------------|----------|
| Live position overlay | Show real pen position on preview canvas | High |
| State indicator | Display Idle/Run/Hold/Alarm in UI | High |
| Feed override slider | Adjust speed during print | Medium |
| Progress calculation | Track actual vs expected position | Medium |
| Alarm detection | Alert user on machine alarms | High |
| Limit switch indicator | Show when limits are triggered | Low |

---

## Real-time Commands

Single-character commands processed immediately (no buffer wait).

| Character | Command | Description |
|-----------|---------|-------------|
| `?` | Status Query | Get current machine state |
| `!` | Feed Hold | Pause motion (controlled stop) |
| `~` | Cycle Start | Resume from hold or start queued motion |
| `0x18` | Soft Reset | Reset FluidNC (Ctrl+X) |
| `0x84` | Safety Door | Trigger safety door state |
| `0x85` | Jog Cancel | Cancel active jog |
| `0x90` | Feed 100% | Set feed override to 100% |
| `0x91` | Feed +10% | Increase feed override 10% |
| `0x92` | Feed -10% | Decrease feed override 10% |
| `0x93` | Feed +1% | Increase feed override 1% |
| `0x94` | Feed -1% | Decrease feed override 1% |
| `0x95` | Rapid 100% | Set rapid override to 100% |
| `0x96` | Rapid 50% | Set rapid override to 50% |
| `0x97` | Rapid 25% | Set rapid override to 25% |

#### Possibilities

| Idea | Description | Priority |
|------|-------------|----------|
| Pause/Resume buttons | Feed hold and cycle start controls | High |
| Emergency stop | Soft reset button with confirmation | High |
| Speed controls | Feed override +/- buttons or slider | Medium |
| Keyboard shortcuts | Map keys to real-time commands | Medium |
| Jog controls | WASD or arrow keys for manual movement | Medium |

---

## File Management

### List Files

```bash
# List SD card files
curl "http://192.168.0.248/command?cmd=%24SD%2FList"

# List local filesystem
curl "http://192.168.0.248/command?cmd=%24LocalFS%2FList"
```

### Run File

```bash
# Run from SD card
curl "http://192.168.0.248/command?cmd=%24SD%2FRun%3D%2Ffilename.gcode"
```

### Delete File

```bash
curl "http://192.168.0.248/command?cmd=%24SD%2FDelete%3D%2Ffilename.gcode"
```

#### Possibilities

| Idea | Description | Priority |
|------|-------------|----------|
| File browser | List and manage uploaded files | Low |
| Re-run previous | Quick access to recent prints | Medium |
| Auto-cleanup | Delete old files after printing | Low |
| File preview | Show G-code stats before running | Low |

---

## Integration Roadmap

### Phase 1: WebSocket Foundation (High Priority)

1. **Create `useFluidNC` hook**
   - WebSocket connection management
   - Auto-reconnection
   - Connection state tracking

2. **Status parsing**
   - Parse `<State|MPos:X,Y,Z|...>` format
   - Extract position, state, feed rate

3. **Connection indicator**
   - Show connected/disconnected/connecting states
   - Display in header or controls panel

### Phase 2: Real-time Feedback (High Priority)

1. **Live position tracking**
   - Enable auto-reporting during print
   - Update preview with real machine position

2. **Print controls**
   - Pause (feed hold)
   - Resume (cycle start)
   - Stop (with confirmation)

3. **State display**
   - Show Idle/Run/Hold/Alarm
   - Visual indicator (color coded)

### Phase 3: G-code Streaming (Medium Priority)

1. **Direct streaming**
   - Send G-code line-by-line via WebSocket
   - Track `ok`/`error` responses
   - Implement buffer management (don't overflow)

2. **Progress tracking**
   - Count sent vs total lines
   - Show actual progress bar

3. **Error handling**
   - Parse error codes
   - Display meaningful messages
   - Option to skip or abort on error

### Phase 4: Advanced Controls (Low Priority)

1. **Jog controls**
   - Manual X/Y/Z movement
   - Configurable step sizes

2. **Feed override**
   - Real-time speed adjustment
   - Slider or +/- buttons

3. **File management**
   - Browse uploaded files
   - Delete old files

---

## Code Examples

### WebSocket Hook (Proposed)

```typescript
// src/hooks/useFluidNC.ts
import { useState, useEffect, useCallback, useRef } from 'react';

interface MachineState {
  connected: boolean;
  state: 'Idle' | 'Run' | 'Hold' | 'Alarm' | 'Unknown';
  position: { x: number; y: number; z: number };
  feedRate: number;
}

export function useFluidNC(host: string) {
  const [machine, setMachine] = useState<MachineState>({
    connected: false,
    state: 'Unknown',
    position: { x: 0, y: 0, z: 0 },
    feedRate: 0,
  });

  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    const wsUrl = host.replace(/^http/, 'ws').replace(/:80$/, '') + ':81';
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setMachine(prev => ({ ...prev, connected: true }));
      ws.send('$Report/Interval=100\n');
    };

    ws.onmessage = (event) => {
      const data = event.data;

      // Parse status report
      const match = data.match(/<(\w+)\|MPos:([-\d.]+),([-\d.]+),([-\d.]+)(?:\|FS:([\d.]+))?/);
      if (match) {
        setMachine(prev => ({
          ...prev,
          state: match[1] as MachineState['state'],
          position: {
            x: parseFloat(match[2]),
            y: parseFloat(match[3]),
            z: parseFloat(match[4]),
          },
          feedRate: match[5] ? parseFloat(match[5]) : prev.feedRate,
        }));
      }
    };

    ws.onclose = () => {
      setMachine(prev => ({ ...prev, connected: false }));
      // Auto-reconnect after 3 seconds
      setTimeout(connect, 3000);
    };

    wsRef.current = ws;
  }, [host]);

  const send = useCallback((command: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(command.endsWith('\n') ? command : command + '\n');
    }
  }, []);

  const sendRealtime = useCallback((char: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(char);
    }
  }, []);

  const pause = useCallback(() => sendRealtime('!'), [sendRealtime]);
  const resume = useCallback(() => sendRealtime('~'), [sendRealtime]);
  const stop = useCallback(() => sendRealtime('\x18'), [sendRealtime]);
  const queryStatus = useCallback(() => sendRealtime('?'), [sendRealtime]);

  useEffect(() => {
    connect();
    return () => wsRef.current?.close();
  }, [connect]);

  return {
    machine,
    send,
    pause,
    resume,
    stop,
    queryStatus,
  };
}
```

### Status Parser

```typescript
// src/utils/fluidncParser.ts
export interface FluidNCStatus {
  state: string;
  mpos?: { x: number; y: number; z: number };
  wpos?: { x: number; y: number; z: number };
  feed?: number;
  spindle?: number;
  wco?: { x: number; y: number; z: number };
  pins?: string;
  override?: { feed: number; rapid: number; spindle: number };
}

export function parseStatus(raw: string): FluidNCStatus | null {
  const match = raw.match(/<([^|>]+)(.*)>/);
  if (!match) return null;

  const status: FluidNCStatus = { state: match[1] };
  const fields = match[2].split('|').filter(Boolean);

  for (const field of fields) {
    const [key, value] = field.split(':');

    switch (key) {
      case 'MPos': {
        const [x, y, z] = value.split(',').map(Number);
        status.mpos = { x, y, z };
        break;
      }
      case 'WPos': {
        const [x, y, z] = value.split(',').map(Number);
        status.wpos = { x, y, z };
        break;
      }
      case 'FS': {
        const [feed, spindle] = value.split(',').map(Number);
        status.feed = feed;
        status.spindle = spindle;
        break;
      }
      case 'WCO': {
        const [x, y, z] = value.split(',').map(Number);
        status.wco = { x, y, z };
        break;
      }
      case 'Pn':
        status.pins = value;
        break;
      case 'Ov': {
        const [feed, rapid, spindle] = value.split(',').map(Number);
        status.override = { feed, rapid, spindle };
        break;
      }
    }
  }

  return status;
}
```

---

## References

- [FluidNC Wiki - Web API](http://wiki.fluidnc.com/en/features/WebAPI)
- [FluidNC Wiki - WebSockets](http://wiki.fluidnc.com/en/support/interface/websockets)
- [FluidNC Wiki - Automatic Reporting](http://wiki.fluidnc.com/en/support/interface/automatic_reporting)
- [FluidNC Wiki - Commands & Settings](http://wiki.fluidnc.com/en/features/commands_and_settings)
- [FluidNC Wiki - Serial Protocol](http://wiki.fluidnc.com/en/support/serial_protocol)
- [FluidNC GitHub](https://github.com/bdring/FluidNC)
- [ESP3D-WebUI for FluidNC](https://github.com/theworkisthework/ESP3D-WEBUI-FLUIDNC)
