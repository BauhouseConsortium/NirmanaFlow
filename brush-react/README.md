# Nirmana Flow

Visual algorithmic drawing editor for pen plotters and CNC machines. Create node-based generative artwork and stream G-code directly to FluidNC controllers.

## Features

- 🎨 **Visual Node Editor** - Create algorithmic art with a flow-based interface
- 🖊️ **Multi-Color Support** - 4 ink well positions for color changes
- 📐 **G-code Generation** - Optimized toolpaths with backlash compensation
- 📡 **Live Streaming** - Stream G-code directly via WebSocket to FluidNC
- 🎮 **Real-time Control** - Jog, pause, resume, and emergency stop

## Quick Start

### Option 1: Use Online (Design Only)

Visit [nirmanaflow.netlify.app](https://nirmanaflow.netlify.app) to design and export G-code files.

> **Note:** Live plotter connection requires local setup (see below).

### Option 2: Run Locally (Full Features)

```bash
# Clone the repository
git clone https://github.com/BauhouseConsortium/NirmanaFlow.git
cd NirmanaFlow/brush-react

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## FluidNC Connection Setup

### The Challenge

The hosted app at `https://nirmanaflow.netlify.app` cannot connect directly to FluidNC's WebSocket (`ws://`) due to browser mixed content security. HTTPS pages cannot make insecure WebSocket connections.

### Solutions

#### Solution 1: Quick HTTP Proxy (Recommended)

Run this one-liner in your terminal (requires Python 3):

```bash
python3 -c 'exec("import http.server as s,urllib.request as r,urllib.error as e\nclass P(s.BaseHTTPRequestHandler):\n def do_GET(o):o._proxy()\n def do_POST(o):o._proxy()\n def _proxy(o):\n  try:\n   d=o.rfile.read(int(o.headers.get(\"Content-Length\",0))) if o.command==\"POST\" else None\n   u=r.urlopen(r.Request(f\"https://nirmanaflow.netlify.app{o.path}\",data=d,headers={k:v for k,v in o.headers.items() if k.lower()!=\"host\"},method=o.command))\n  except e.HTTPError as x:u=x\n  o.send_response(u.code if hasattr(u,\"code\") else u.status)\n  [o.send_header(k,v) for k,v in u.headers.items()]\n  o.end_headers()\n  o.wfile.write(u.read())\nprint(\"\\n🚀 Proxy active!\\n🔗 Open: http://localhost:8000\\n\\nPress Ctrl+C to stop.\");s.HTTPServer((str(),8000),P).serve_forever()")'
```

Then open [http://localhost:8000](http://localhost:8000) instead of the HTTPS version.

#### Solution 2: Local Development

See [Quick Start - Option 2](#option-2-run-locally-full-features) above.

### Connecting to FluidNC

1. Ensure your FluidNC controller is on the same network
2. Find its IP address (e.g., `192.168.1.100`)
3. Enter the IP in Settings → Controller Host
4. Click the connection button in the header

FluidNC uses WebSocket on port 81 by default (`ws://192.168.1.100:81`).

## Usage

### Node Editor

1. **Add Nodes** - Drag from the left palette
2. **Connect Nodes** - Drag from output to input handles
3. **Configure** - Click nodes to edit parameters
4. **Preview** - See real-time preview on the right

### Available Node Types

| Node | Description |
|------|-------------|
| **Shape** | Basic geometric shapes (circle, rectangle, polygon) |
| **Path** | Custom SVG paths |
| **Transform** | Scale, rotate, translate paths |
| **Iteration** | Repeat patterns |
| **L-System** | Lindenmayer system fractals |
| **Attractor** | Strange attractors (Lorenz, etc.) |
| **Algorithmic** | Custom algorithmic patterns |
| **Code** | Write custom JavaScript |
| **Text** | Text with stroke fonts |
| **Slicer** | Slice 3D STL files |
| **Output** | Final output configuration |

### Machine Control

When connected to FluidNC:

- **Stream** - Send G-code line by line
- **Pause/Resume** - Feed hold and cycle start
- **Stop** - Emergency soft reset
- **Jog** - Manual movement controls
- **Home** - Run homing sequence

## Development

```bash
# Development with hot reload
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview

# Lint
pnpm lint
```

## Tech Stack

- **React 18** + TypeScript
- **Vite** - Build tool
- **React Flow** - Node editor
- **Tailwind CSS** - Styling
- **Allotment** - Resizable panes
- **Zod** - Schema validation

## License

MIT

---

Created by Budi Prakosa (Manticore) from Bauhouse Consortium
