import { useState, useEffect, useCallback } from "react";
import { Monitor, Keyboard, Terminal, Sparkles, CheckCircle2, RotateCcw } from "lucide-react";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import { api } from "../../lib/tauri";

interface HotkeyConfig {
  key: string;
  label: string;
  description: string;
}

const HOTKEY_CONFIGS: HotkeyConfig[] = [
  { key: "hotkey_quick_paste", label: "Quick Paste", description: "Show the search popup anywhere." },
  { key: "hotkey_queue_toggle", label: "Queue Toggle", description: "Start/stop collecting clipboard items." },
  { key: "hotkey_queue_next", label: "Queue Paste Next", description: "Paste next item from the queue." },
];

const HOTKEY_DEFAULTS: Record<string, string> = {
  hotkey_quick_paste: "CmdOrCtrl+Shift+V",
  hotkey_queue_toggle: "CmdOrCtrl+Shift+Q",
  hotkey_queue_next: "CmdOrCtrl+Shift+N",
};

function formatShortcutDisplay(shortcut: string): string {
  if (!shortcut) return "Not set";
  return shortcut
    .replace("CmdOrCtrl", "Ctrl")
    .replace("CommandOrControl", "Ctrl")
    .replace("Control", "Ctrl")
    .replace("Command", "Cmd")
    .split("+")
    .join(" + ");
}

function keyEventToShortcut(e: KeyboardEvent): string | null {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("CmdOrCtrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");

  const key = e.code;

  // Map code to key name
  let keyName: string | null = null;
  if (key.startsWith("Key")) keyName = key.slice(3);
  else if (key.startsWith("Digit")) keyName = key.slice(5);
  else if (key.startsWith("F") && key.length <= 3) keyName = key; // F1-F12
  else if (key === "Space") keyName = "Space";
  else if (key === "Backspace") keyName = "Backspace";
  else if (key === "Delete") keyName = "Delete";
  else if (key === "Enter") keyName = "Enter";
  else if (key === "Tab") keyName = "Tab";
  else if (key === "Escape") return null; // Escape cancels recording

  if (!keyName || parts.length === 0) return null; // Need at least one modifier

  parts.push(keyName);
  return parts.join("+");
}

function HotkeyRecorder({
  settingKey,
  currentValue,
  config,
  onUpdate,
}: {
  settingKey: string;
  currentValue: string;
  config: HotkeyConfig;
  onUpdate: (key: string, value: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        setRecording(false);
        return;
      }

      const shortcut = keyEventToShortcut(e);
      if (shortcut) {
        setRecording(false);
        setSaving(true);
        api
          .updateHotkey(settingKey, shortcut)
          .then(() => onUpdate(settingKey, shortcut))
          .catch((err) => alert("Failed to update hotkey: " + err))
          .finally(() => setSaving(false));
      }
    },
    [settingKey, onUpdate],
  );

  useEffect(() => {
    if (recording) {
      window.addEventListener("keydown", handleKeyDown, true);
      return () => window.removeEventListener("keydown", handleKeyDown, true);
    }
  }, [recording, handleKeyDown]);

  const handleReset = async () => {
    const defaultVal = HOTKEY_DEFAULTS[settingKey];
    if (!defaultVal || defaultVal === currentValue) return;
    setSaving(true);
    try {
      await api.updateHotkey(settingKey, defaultVal);
      onUpdate(settingKey, defaultVal);
    } catch (err) {
      alert("Failed to reset hotkey: " + err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-bold">{config.label}</p>
        <p className="text-xs text-zinc-500">{config.description}</p>
      </div>
      <div className="flex items-center gap-2">
        {currentValue !== HOTKEY_DEFAULTS[settingKey] && (
          <button
            onClick={handleReset}
            disabled={saving}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Reset to default"
          >
            <RotateCcw size={14} />
          </button>
        )}
        <button
          onClick={() => setRecording(true)}
          disabled={saving}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all min-w-[140px] text-center
            ${
              recording
                ? "bg-blue-500 text-white border-blue-500 animate-pulse"
                : saving
                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border-zinc-200 dark:border-zinc-700"
                  : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:border-blue-500/50 shadow-sm"
            }`}
        >
          {recording
            ? "Press keys..."
            : saving
              ? "Saving..."
              : formatShortcutDisplay(currentValue)}
        </button>
      </div>
    </div>
  );
}

export function GeneralSettings() {
  const [autostart, setAutostart] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hotkeys, setHotkeys] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadSettings() {
      try {
        const [enabled, hk] = await Promise.all([isEnabled(), api.getHotkeys()]);
        setAutostart(enabled);
        setHotkeys(hk);
      } catch {
        // ignore load errors
      } finally {
        setIsLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleToggleAutostart = async () => {
    const newValue = !autostart;
    try {
      if (newValue) await enable();
      else await disable();
      setAutostart(newValue);
    } catch (e) {
      alert("Failed to change autostart: " + e);
    }
  };

  const handleHotkeyUpdate = (key: string, value: string) => {
    setHotkeys((prev) => ({ ...prev, [key]: value }));
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

          <div className="p-4 bg-zinc-50/50 dark:bg-zinc-800/30 rounded-2xl border border-zinc-200/50 dark:border-zinc-700/50 space-y-5">
            {HOTKEY_CONFIGS.map((config) => (
              <HotkeyRecorder
                key={config.key}
                settingKey={config.key}
                currentValue={hotkeys[config.key] || ""}
                config={config}
                onUpdate={handleHotkeyUpdate}
              />
            ))}
          </div>

          <p className="text-[11px] text-zinc-400 px-1">
            Click a shortcut to record a new key combination. Press Escape to cancel.
          </p>
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
