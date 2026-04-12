import { useState, useEffect } from "react";
import { Monitor, Keyboard, Terminal, Sparkles, CheckCircle2 } from "lucide-react";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";

export function GeneralSettings() {
  const [autostart, setAutostart] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadSettings() {
      try {
        const enabled = await isEnabled();
        setAutostart(enabled);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleToggleAutostart = async () => {
    const newValue = !autostart;
    try {
      if (newValue) {
        await enable();
      } else {
        await disable();
      }
      setAutostart(newValue);
    } catch (e) {
      alert("Failed to change autostart: " + e);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-white dark:bg-[#1a1a1a]">
      <div className="max-w-2xl mx-auto space-y-10">
        <div>
          <h2 className="text-2xl font-bold tracking-tight mb-1">Preferences</h2>
          <p className="text-sm text-zinc-500">Manage how PasteFlow behaves on your system.</p>
        </div>

        {/* Section: System */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <Monitor size={16} className="text-zinc-400" />
            <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">System</h3>
          </div>

          <div className="flex items-center justify-between p-4 bg-zinc-50/50 dark:bg-zinc-800/30 rounded-2xl border border-zinc-200/50 dark:border-zinc-700/50 transition-all hover:border-blue-500/30">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                <Terminal size={20} />
              </div>
              <div>
                <p className="text-sm font-bold">Launch at Login</p>
                <p className="text-xs text-zinc-500">Start PasteFlow automatically when you start your computer.</p>
              </div>
            </div>
            <button
              onClick={handleToggleAutostart}
              disabled={isLoading}
              className={`w-12 h-6 rounded-full transition-all relative ${autostart ? "bg-blue-600 shadow-lg shadow-blue-500/30" : "bg-zinc-300 dark:bg-zinc-700"}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${autostart ? "left-7" : "left-1"}`} />
            </button>
          </div>
        </section>

        {/* Section: Shortcuts */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <Keyboard size={16} className="text-zinc-400" />
            <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Global Hotkeys</h3>
          </div>

          <div className="p-4 bg-zinc-50/50 dark:bg-zinc-800/30 rounded-2xl border border-zinc-200/50 dark:border-zinc-700/50 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold">Quick Paste Menu</p>
                <p className="text-xs text-zinc-500">Show the search popup anywhere.</p>
              </div>
              <kbd className="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-bold text-zinc-500 shadow-sm">
                Ctrl + Shift + V
              </kbd>
            </div>
          </div>
        </section>

        {/* Section: AI Status */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <Sparkles size={16} className="text-zinc-400" />
            <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">AI Integration</h3>
          </div>
          <div className="p-6 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[24px] text-white shadow-xl shadow-blue-500/20 relative overflow-hidden group">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <div className="px-2 py-0.5 bg-white/20 rounded text-[9px] font-bold border border-white/20 uppercase">Next Major Update</div>
              </div>
              <h4 className="text-lg font-bold mb-2">Generative Reformatting</h4>
              <p className="text-xs text-blue-100 max-w-xs leading-relaxed mb-6">Connect your OpenAI or Anthropic keys to enable AI-powered text rewriting and multi-platform formatting.</p>
              <button className="px-4 py-2 bg-white text-blue-600 rounded-xl text-xs font-bold shadow-lg shadow-black/10 flex items-center gap-2 opacity-50 cursor-not-allowed">
                Set API Key <CheckCircle2 size={12} />
              </button>
            </div>
            <Sparkles size={120} className="absolute -right-4 -bottom-4 text-white/10 rotate-12 group-hover:scale-110 transition-transform duration-700" />
          </div>
        </section>
      </div>
    </div>
  );
}
