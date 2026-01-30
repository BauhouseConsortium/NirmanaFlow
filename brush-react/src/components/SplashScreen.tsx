import { useState, useEffect } from 'react';

interface SplashScreenProps {
  onDismiss: () => void;
}

const STORAGE_KEY = 'nirmana-splash-dismissed';

export function SplashScreen({ onDismiss }: SplashScreenProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  const handleDismiss = () => {
    if (dontShowAgain) {
      localStorage.setItem(STORAGE_KEY, 'true');
    }
    setIsVisible(false);
    setTimeout(onDismiss, 300); // Wait for fade animation
  };

  if (!isVisible) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-sm flex items-center justify-center opacity-0 transition-opacity duration-300 pointer-events-none" />
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="max-w-lg w-full bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="relative px-6 py-6 border-b border-slate-700/50 overflow-hidden">
          {/* Decorative lines */}
          <svg className="absolute right-0 top-0 h-full w-32 opacity-[0.07]" viewBox="0 0 100 80" preserveAspectRatio="xMaxYMid slice">
            <path d="M10 10 Q40 5, 50 40 T90 70" stroke="currentColor" strokeWidth="2" fill="none" className="text-white" />
            <path d="M20 5 Q50 20, 60 50 T95 60" stroke="currentColor" strokeWidth="1.5" fill="none" className="text-white" />
            <path d="M5 25 Q35 30, 55 55 T85 75" stroke="currentColor" strokeWidth="1" fill="none" className="text-white" />
          </svg>

          <div className="relative flex items-center gap-4">
            {/* Pen icon */}
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-slate-700/40 flex items-center justify-center">
              <svg className="w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-100">Nirmana Flow</h1>
              <p className="text-slate-500 text-xs">Visual Algorithmic Drawing</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-4">
          <p className="text-slate-300 text-sm leading-relaxed">
            Create algorithmic artwork using a visual node-based editor. Connect nodes to generate patterns,
            then export G-code for your pen plotter or CNC machine.
          </p>

          {/* Features */}
          <div className="grid grid-cols-2 gap-3">
            <Feature
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
              }
              title="Node Editor"
              desc="Visual flow-based design"
            />
            <Feature
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
              }
              title="Multi-Color"
              desc="4 ink well support"
            />
            <Feature
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              }
              title="G-code Export"
              desc="Ready for your plotter"
            />
            <Feature
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              }
              title="Live Control"
              desc="Stream via WebSocket"
            />
          </div>

          {/* Workflow hint */}
          <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
            <p className="text-xs text-slate-400">
              <span className="text-slate-300 font-medium">Quick start:</span> Add shape nodes from the left palette,
              connect them to the Output node, and watch your design come to life in the preview.
            </p>
          </div>

          {/* Connection hint - only show on HTTPS */}
          {typeof window !== 'undefined' && window.location.protocol === 'https:' && (
            <div className="bg-blue-500/10 rounded-lg p-3 border border-blue-500/20">
              <p className="text-xs text-blue-300/80">
                <span className="text-blue-200 font-medium">📡 Plotter connection:</span> To stream G-code to FluidNC, 
                click the connection help button (?) in the header for setup instructions.
              </p>
            </div>
          )}

          <p className="text-xs text-slate-500 text-center">Created by Budi Prakosa AKA Manticore from Bauhouse Consorxium</p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-900/30 border-t border-slate-700/50 flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={e => setDontShowAgain(e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-slate-400 focus:ring-slate-500 focus:ring-offset-0"
            />
            <span className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors">
              Don't show again
            </span>
          </label>
          <button
            onClick={handleDismiss}
            className="px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-900/30 border border-slate-700/30">
      <div className="text-slate-400 mt-0.5">{icon}</div>
      <div>
        <div className="text-xs font-medium text-slate-200">{title}</div>
        <div className="text-[10px] text-slate-500">{desc}</div>
      </div>
    </div>
  );
}

export function useSplashScreen() {
  const [showSplash, setShowSplash] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) {
      setShowSplash(true);
    }
  }, []);

  return {
    showSplash,
    dismissSplash: () => setShowSplash(false),
    resetSplash: () => {
      localStorage.removeItem(STORAGE_KEY);
      setShowSplash(true);
    },
  };
}
