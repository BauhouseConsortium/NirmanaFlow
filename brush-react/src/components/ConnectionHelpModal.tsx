import { useState, useCallback } from 'react';

interface ConnectionHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PROXY_COMMAND = `python3 -c 'exec("import http.server as s,urllib.request as r,urllib.error as e\\nclass P(s.BaseHTTPRequestHandler):\\n def do_GET(o):o._proxy()\\n def do_POST(o):o._proxy()\\n def _proxy(o):\\n  try:\\n   d=o.rfile.read(int(o.headers.get(\\"Content-Length\\",0))) if o.command==\\"POST\\" else None\\n   u=r.urlopen(r.Request(f\\"https://nirmanaflow.netlify.app{o.path}\\",data=d,headers={k:v for k,v in o.headers.items() if k.lower()!=\\"host\\"},method=o.command))\\n  except e.HTTPError as x:u=x\\n  o.send_response(u.code if hasattr(u,\\"code\\") else u.status)\\n  [o.send_header(k,v) for k,v in u.headers.items()]\\n  o.end_headers()\\n  o.wfile.write(u.read())\\nprint(\\"\\\\n🚀 Proxy active!\\\\n🔗 Open: http://localhost:8000\\\\n\\\\nPress Ctrl+C to stop.\\");s.HTTPServer((str(),8000),P).serve_forever()")'`;

export function ConnectionHelpModal({ isOpen, onClose }: ConnectionHelpModalProps) {
  const [copied, setCopied] = useState<'proxy' | 'dev' | null>(null);
  const [activeTab, setActiveTab] = useState<'proxy' | 'local'>('proxy');

  const copyToClipboard = useCallback(async (text: string, type: 'proxy' | 'dev') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, []);

  if (!isOpen) return null;

  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-xl bg-slate-800 rounded-xl shadow-2xl border border-slate-700 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">FluidNC Connection Help</h2>
              <p className="text-xs text-slate-500">Connect to your CNC controller</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* The Problem */}
          {isHttps && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
              <div className="flex gap-3">
                <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="text-sm text-amber-200 font-medium">Mixed Content Security Issue</p>
                  <p className="text-xs text-amber-300/80 mt-1">
                    This page is served over <span className="font-mono bg-amber-500/20 px-1 rounded">HTTPS</span>, but FluidNC uses 
                    an unencrypted WebSocket (<span className="font-mono bg-amber-500/20 px-1 rounded">ws://</span>). 
                    Browsers block this connection for security reasons.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Solution Tabs */}
          <div className="flex gap-1 p-1 bg-slate-900/50 rounded-lg">
            <button
              onClick={() => setActiveTab('proxy')}
              className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                activeTab === 'proxy'
                  ? 'bg-slate-700 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Quick Proxy (Recommended)
            </button>
            <button
              onClick={() => setActiveTab('local')}
              className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                activeTab === 'local'
                  ? 'bg-slate-700 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Run Locally
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'proxy' ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2 text-xs text-slate-400">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-medium">1</span>
                <span>Open a terminal and run this command (requires Python 3):</span>
              </div>
              
              <div className="relative group">
                <pre className="bg-slate-900 rounded-lg p-3 text-xs font-mono text-green-400 overflow-x-auto whitespace-pre-wrap break-all border border-slate-700">
                  {PROXY_COMMAND}
                </pre>
                <button
                  onClick={() => copyToClipboard(PROXY_COMMAND, 'proxy')}
                  className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-medium transition-all ${
                    copied === 'proxy'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600 opacity-0 group-hover:opacity-100'
                  }`}
                >
                  {copied === 'proxy' ? '✓ Copied!' : 'Copy'}
                </button>
              </div>

              <div className="flex items-start gap-2 text-xs text-slate-400">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-medium">2</span>
                <span>
                  Open <a href="http://localhost:8000" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline font-mono">http://localhost:8000</a> in your browser
                </span>
              </div>

              <div className="flex items-start gap-2 text-xs text-slate-400">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-medium">3</span>
                <span>Enter your FluidNC IP address in settings and click connect</span>
              </div>

              <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                <p className="text-xs text-slate-500">
                  <span className="text-slate-400 font-medium">How it works:</span> The proxy serves this app over HTTP locally, 
                  allowing your browser to connect to the FluidNC WebSocket without mixed content restrictions.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-2 text-xs text-slate-400">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-medium">1</span>
                <span>Clone the repository and install dependencies:</span>
              </div>
              
              <div className="relative group">
                <pre className="bg-slate-900 rounded-lg p-3 text-xs font-mono text-green-400 overflow-x-auto border border-slate-700">
{`git clone https://github.com/bauhouse/brush.git
cd brush/brush-react
pnpm install`}
                </pre>
                <button
                  onClick={() => copyToClipboard('git clone https://github.com/bauhouse/brush.git && cd brush/brush-react && pnpm install', 'dev')}
                  className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-medium transition-all ${
                    copied === 'dev'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600 opacity-0 group-hover:opacity-100'
                  }`}
                >
                  {copied === 'dev' ? '✓ Copied!' : 'Copy'}
                </button>
              </div>

              <div className="flex items-start gap-2 text-xs text-slate-400">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-medium">2</span>
                <span>Start the development server:</span>
              </div>

              <div className="relative">
                <pre className="bg-slate-900 rounded-lg p-3 text-xs font-mono text-green-400 border border-slate-700">
                  pnpm dev
                </pre>
              </div>

              <div className="flex items-start gap-2 text-xs text-slate-400">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-medium">3</span>
                <span>
                  Open <span className="font-mono text-blue-400">http://localhost:5173</span> and connect to FluidNC
                </span>
              </div>

              <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                <p className="text-xs text-slate-500">
                  <span className="text-slate-400 font-medium">Benefits:</span> Full development environment with hot reload. 
                  You can also modify the code to fit your specific needs.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-900/30 border-t border-slate-700/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
