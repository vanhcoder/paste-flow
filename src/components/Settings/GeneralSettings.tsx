import { useState, useEffect, useCallback } from "react";
import { Monitor, Keyboard, Terminal, Sparkles, CheckCircle2, RotateCcw, ShieldCheck, HardDrive, Wifi, WifiOff, Lock, Database, Zap, ChevronDown, ChevronUp, Eye, EyeOff, AlertCircle } from "lucide-react";
import { toast } from "../../stores/toastStore";
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

const OPENAI_MODELS = [
  { id: "gpt-4o-mini",  name: "GPT-4o mini  (fast · cheap)" },
  { id: "gpt-4o",       name: "GPT-4o  (powerful)" },
  { id: "gpt-4-turbo",  name: "GPT-4 Turbo" },
];
const ANTHROPIC_MODELS = [
  { id: "claude-haiku-4-5-20251001", name: "Claude Haiku  (fast · cheap)" },
  { id: "claude-sonnet-4-6",         name: "Claude Sonnet  (balanced)" },
  { id: "claude-opus-4-7",           name: "Claude Opus  (most powerful)" },
];

const HOTKEY_DEFAULTS: Record<string, string> = {
  hotkey_quick_paste: "CmdOrCtrl+Shift+V",
  hotkey_queue_toggle: "CmdOrCtrl+Shift+Q",
  hotkey_queue_next: "CmdOrCtrl+Shift+N",
};

const isMac = navigator.platform.toUpperCase().startsWith("MAC");

function formatShortcutDisplay(shortcut: string): string {
  if (!shortcut) return "Not set";
  if (isMac) {
    return shortcut
      .replace(/CmdOrCtrl|CommandOrControl|Command/g, "⌘")
      .replace(/Control|Ctrl/g, "⌃")
      .replace(/Shift/g, "⇧")
      .replace(/Alt|Option/g, "⌥")
      .split("+")
      .join("");
  }
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
          .catch((err) => toast.error("Failed to update hotkey: " + err))
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
      toast.error("Failed to reset hotkey: " + err);
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

  // AI settings
  const [aiProvider, setAiProvider] = useState<"openai" | "anthropic">("openai");
  const [aiModel, setAiModel]       = useState("gpt-4o-mini");
  const [aiApiKey, setAiApiKey]     = useState("");
  const [showKey, setShowKey]       = useState(false);
  const [aiSaving, setAiSaving]     = useState(false);
  const [aiSaved, setAiSaved]       = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const [enabled, hk, key, prov, mod] = await Promise.all([
          isEnabled(),
          api.getHotkeys(),
          api.getSetting("ai_api_key"),
          api.getSetting("ai_provider"),
          api.getSetting("ai_model"),
        ]);
        setAutostart(enabled);
        setHotkeys(hk);
        if (key)  setAiApiKey(key);
        if (prov) setAiProvider(prov as "openai" | "anthropic");
        if (mod)  setAiModel(mod);
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
      toast.error("Failed to change autostart: " + e);
    }
  };

  const handleHotkeyUpdate = (key: string, value: string) => {
    setHotkeys((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveAI = async () => {
    setAiSaving(true);
    try {
      await Promise.all([
        api.setSetting("ai_api_key", aiApiKey.trim()),
        api.setSetting("ai_provider", aiProvider),
        api.setSetting("ai_model", aiModel),
      ]);
      setAiSaved(true);
      setTimeout(() => setAiSaved(false), 2000);
    } catch (e) {
      toast.error("Failed to save AI settings: " + e);
    } finally {
      setAiSaving(false);
    }
  };

  const aiModels = aiProvider === "anthropic" ? ANTHROPIC_MODELS : OPENAI_MODELS;

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

        {/* Section: AI Integration */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <Sparkles size={16} className="text-zinc-400" />
            <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">AI Integration</h3>
          </div>

          <div className="p-4 bg-zinc-50/50 dark:bg-zinc-800/30 rounded-2xl border border-zinc-200/50 dark:border-zinc-700/50 space-y-5">

            {/* Provider toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold">Provider</p>
                <p className="text-xs text-zinc-500">OpenAI or Anthropic API.</p>
              </div>
              <div className="flex p-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700">
                {(["openai", "anthropic"] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => {
                      setAiProvider(p);
                      setAiModel(p === "anthropic" ? ANTHROPIC_MODELS[0].id : OPENAI_MODELS[0].id);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all ${
                      aiProvider === p
                        ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                        : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                    }`}
                  >
                    {p === "openai" ? "OpenAI" : "Anthropic"}
                  </button>
                ))}
              </div>
            </div>

            {/* API Key */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-1.5 block">
                API Key
              </label>
              <div className="flex gap-2">
                <input
                  type={showKey ? "text" : "password"}
                  value={aiApiKey}
                  onChange={e => setAiApiKey(e.target.value)}
                  placeholder={aiProvider === "openai" ? "sk-..." : "sk-ant-..."}
                  className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500 transition-all placeholder:text-zinc-300 dark:placeholder:text-zinc-600"
                />
                <button
                  onClick={() => setShowKey(s => !s)}
                  className="px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                >
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {!aiApiKey.trim() && (
                <p className="text-[11px] text-amber-500 flex items-center gap-1 mt-1.5">
                  <AlertCircle size={11} /> Key is required to use AI Reformat
                </p>
              )}
            </div>

            {/* Model */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold">Model</p>
                <p className="text-xs text-zinc-500">Affects speed and quality.</p>
              </div>
              <select
                value={aiModel}
                onChange={e => setAiModel(e.target.value)}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-[12px] font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 text-zinc-700 dark:text-zinc-300 cursor-pointer"
              >
                {aiModels.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            {/* Save */}
            <div className="flex justify-end pt-1">
              <button
                onClick={handleSaveAI}
                disabled={aiSaving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-[13px] font-bold shadow-sm shadow-blue-500/20 transition-all active:scale-[0.98]"
              >
                {aiSaved
                  ? <><CheckCircle2 size={14} /> Saved!</>
                  : aiSaving
                    ? "Saving..."
                    : "Save AI Settings"}
              </button>
            </div>
          </div>
        </section>

        {/* Section: Privacy & Data */}
        <PrivacySection />
      </div>
    </div>
  );
}

// ── Privacy & Data Section ────────────────────────────────────────────────────

const DATA_ITEMS = [
  {
    icon: <Database size={15} />,
    label: "Clipboard History",
    detail: "Stored locally on your device only. Never uploaded anywhere.",
    local: true,
  },
  {
    icon: <Zap size={15} />,
    label: "Smart Templates",
    detail: "All templates and variable history saved to local SQLite database.",
    local: true,
  },
  {
    icon: <Lock size={15} />,
    label: "Hotkey Settings",
    detail: "Saved locally in the app's configuration database.",
    local: true,
  },
  {
    icon: <Sparkles size={15} />,
    label: "AI Reformat (coming soon)",
    detail: "When enabled, selected text is sent to Anthropic/OpenAI API for processing. PasteFlow does not store or log this data. Subject to the API provider's privacy policy.",
    local: false,
  },
];

function PrivacySection() {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
        <ShieldCheck size={16} className="text-zinc-400" />
        <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Privacy & Data</h3>
      </div>

      {/* Trust banner */}
      <div className="flex items-center gap-4 p-4 bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200/60 dark:border-emerald-700/30 rounded-2xl">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center shrink-0">
          <HardDrive size={20} className="text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">100% Local — Your data never leaves your device</p>
          <p className="text-xs text-emerald-700/70 dark:text-emerald-400/70 mt-0.5">
            No account required. No analytics. No telemetry. No cloud sync.
          </p>
        </div>
        <WifiOff size={18} className="shrink-0 text-emerald-500/60" />
      </div>

      {/* Guarantees row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "No analytics", icon: <WifiOff size={13} /> },
          { label: "No account", icon: <Lock size={13} /> },
          { label: "No cloud sync", icon: <Wifi size={13} className="line-through opacity-50" /> },
        ].map(item => (
          <div
            key={item.label}
            className="flex flex-col items-center gap-1.5 p-3 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/50 dark:border-zinc-700/40 rounded-xl"
          >
            <span className="text-zinc-400">{item.icon}</span>
            <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 text-center leading-tight">{item.label}</span>
          </div>
        ))}
      </div>

      {/* Data breakdown — collapsible */}
      <div className="border border-zinc-200/60 dark:border-zinc-700/40 rounded-2xl overflow-hidden">
        <button
          onClick={() => setExpanded(p => !p)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
        >
          <span className="text-[12px] font-bold text-zinc-600 dark:text-zinc-400">What data is stored & where</span>
          {expanded
            ? <ChevronUp size={14} className="text-zinc-400" />
            : <ChevronDown size={14} className="text-zinc-400" />
          }
        </button>

        {expanded && (
          <div className="border-t border-zinc-200/60 dark:border-zinc-700/40 divide-y divide-zinc-100 dark:divide-zinc-800">
            {DATA_ITEMS.map(item => (
              <div key={item.label} className="flex items-start gap-3 px-4 py-3">
                <div className={`mt-0.5 shrink-0 ${item.local ? "text-emerald-500" : "text-amber-500"}`}>
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[12px] font-bold text-zinc-700 dark:text-zinc-300">{item.label}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                      item.local
                        ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-700/30"
                        : "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-700/30"
                    }`}>
                      {item.local ? "Local only" : "External API"}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-500 leading-relaxed">{item.detail}</p>
                </div>
              </div>
            ))}

            {/* Storage path */}
            <div className="px-4 py-3 bg-zinc-50/50 dark:bg-zinc-800/20">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Data Location</p>
              <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-500">
                Windows: <span className="text-zinc-700 dark:text-zinc-400">%APPDATA%\paste-flow\paste-flow.db</span>
              </p>
              <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-500 mt-0.5">
                macOS: <span className="text-zinc-700 dark:text-zinc-400">~/Library/Application Support/paste-flow/</span>
              </p>
              <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-500 mt-0.5">
                Linux: <span className="text-zinc-700 dark:text-zinc-400">~/.local/share/paste-flow/</span>
              </p>
            </div>
          </div>
        )}
      </div>

      <p className="text-[11px] text-zinc-400 px-1 leading-relaxed">
        PasteFlow is a local-first app. Deleting the app removes all data permanently.
        No account exists to deactivate.
      </p>
    </section>
  );
}
