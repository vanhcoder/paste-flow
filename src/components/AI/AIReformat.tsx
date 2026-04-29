import { useEffect, useState } from "react";
import {
  Sparkles, Clipboard, Copy, Zap, AlertCircle,
  Settings, RotateCcw, CheckCircle2, Plus,
  Clock, X, Loader2,
} from "lucide-react";
import { api, type AiSkill, type ReformatRecord } from "../../lib/tauri";
import { toast } from "../../stores/toastStore";
import { TransformPopover } from "../UI/TransformPopover";

// ── Built-in style definitions ────────────────────────────────────────────────

const BUILTIN_STYLES = [
  { id: "email",   label: "Email",       emoji: "📧" },
  { id: "slack",   label: "Slack",       emoji: "💬" },
  { id: "tweet",   label: "Tweet",       emoji: "𝕏"  },
  { id: "formal",  label: "Formal",      emoji: "👔" },
  { id: "casual",  label: "Casual",      emoji: "😊" },
  { id: "bullets", label: "Bullets",     emoji: "•"  },
  { id: "summary", label: "Summary",     emoji: "📝" },
  { id: "fix",     label: "Fix Grammar", emoji: "✓"  },
];

// ── Main component ────────────────────────────────────────────────────────────

export function AIReformat() {
  const [input, setInput]   = useState("");
  const [output, setOutput] = useState("");
  const [style, setStyle]   = useState("email");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [copied, setCopied]     = useState(false);
  const [provider, setProvider] = useState("openai");
  const [model, setModel]       = useState("gpt-4o-mini");
  const [hasKey, setHasKey]     = useState<boolean | null>(null);

  // Custom skills
  const [skills, setSkills]           = useState<AiSkill[]>([]);
  const [showNewSkill, setShowNewSkill] = useState(false);
  const [skillName, setSkillName]       = useState("");
  const [skillEmoji, setSkillEmoji]     = useState("🤖");
  const [skillPrompt, setSkillPrompt]   = useState("");
  const [savingSkill, setSavingSkill]   = useState(false);

  // History
  const [history, setHistory]           = useState<ReformatRecord[]>([]);
  const [showHistory, setShowHistory]   = useState(false);

  // Transform popover
  const [transformAnchor, setTransformAnchor] = useState<HTMLElement | null>(null);

  useEffect(() => {
    Promise.all([
      api.getSetting("ai_provider"),
      api.getSetting("ai_model"),
      api.listAiSkills(),
      api.getReformatHistory(10),
    ]).then(async ([prov, mod, sk, hist]) => {
      const resolvedProvider = prov || "openai";
      const keySettingName = resolvedProvider === "anthropic" ? "ai_api_key_anthropic" : "ai_api_key_openai";
      const key = await api.getSetting(keySettingName);
      setHasKey(!!key?.trim());
      if (prov) setProvider(prov);
      if (mod)  setModel(mod);
      setSkills(sk);
      setHistory(hist);
    });
  }, []);

  const refreshHistory = () =>
    api.getReformatHistory(10).then(setHistory).catch(() => {});

  const handleFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setInput(text);
    } catch { /* clipboard may require focus */ }
  };

  const handleReformat = async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    setError("");
    setOutput("");
    try {
      const [prov, mod] = await Promise.all([
        api.getSetting("ai_provider"),
        api.getSetting("ai_model"),
      ]);
      const resolvedProvider = prov || "openai";
      const keySettingName = resolvedProvider === "anthropic" ? "ai_api_key_anthropic" : "ai_api_key_openai";
      const apiKey = await api.getSetting(keySettingName);
      const result = await api.reformatText(
        input, style,
        resolvedProvider,
        apiKey || "",
        mod   || "gpt-4o-mini",
      );
      setOutput(result);
      setHasKey(true);
      setProvider(resolvedProvider);
      setModel(mod || "gpt-4o-mini");
      refreshHistory();
    } catch (err: unknown) {
      const msg = typeof err === "string" ? err : String(err);
      setError(msg);
      if (msg.includes("API key")) setHasKey(false);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handlePaste = async () => {
    if (!output) return;
    await api.pasteToActiveApp(output);
  };

  const handleCreateSkill = async () => {
    if (!skillName.trim() || !skillPrompt.trim()) return;
    setSavingSkill(true);
    try {
      const s = await api.createAiSkill(skillName.trim(), skillEmoji, skillPrompt.trim());
      setSkills(prev => [...prev, s]);
      setStyle(s.id);
      setSkillName(""); setSkillEmoji("🤖"); setSkillPrompt("");
      setShowNewSkill(false);
      toast.success(`Skill "${s.name}" created`);
    } catch (e) {
      toast.error("Failed to save skill: " + e);
    } finally {
      setSavingSkill(false);
    }
  };

  const handleDeleteSkill = async (id: string, name: string) => {
    await api.deleteAiSkill(id).catch(() => {});
    setSkills(prev => prev.filter(s => s.id !== id));
    if (style === id) setStyle("email");
    toast.success(`Skill "${name}" deleted`);
  };

  const loadHistoryItem = (rec: ReformatRecord) => {
    setInput(rec.original_text);
    setOutput(rec.reformatted);
    setStyle(rec.style);
    setShowHistory(false);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#1a1a1a] overflow-hidden">

      {/* ── Header ── */}
      <div className="px-7 py-5 flex items-center justify-between border-b border-zinc-200/40 dark:border-zinc-800/40 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-blue-500" />
            <h2 className="text-[17px] font-bold text-zinc-900 dark:text-white">AI Reformat</h2>
          </div>
          <p className="text-[11px] text-zinc-400 mt-0.5">Rewrite any text into a different format or tone</p>
        </div>

        <div className="flex items-center gap-2">
          {/* History toggle */}
          <button
            onClick={() => setShowHistory(s => !s)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
              showHistory
                ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-transparent"
                : "text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
            }`}
          >
            <Clock size={12} /> History
          </button>

          {/* Provider badge */}
          {hasKey !== null && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
              hasKey
                ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-700/30"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border-zinc-200 dark:border-zinc-700"
            }`}>
              {hasKey ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
              {hasKey ? `${provider === "anthropic" ? "Anthropic" : "OpenAI"} · ${model}` : "No API key"}
            </div>
          )}
        </div>
      </div>

      {/* ── History panel (overlay) ── */}
      {showHistory && (
        <div className="shrink-0 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/30 max-h-52 overflow-y-auto hide-scrollbar">
          {history.length === 0 ? (
            <p className="text-center text-[12px] text-zinc-400 py-6">No history yet</p>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {history.map(rec => (
                <button
                  key={rec.id}
                  onClick={() => loadHistoryItem(rec)}
                  className="w-full text-left px-5 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500">{rec.style}</span>
                    <span className="text-[10px] text-zinc-400">{rec.model_used}</span>
                    <span className="ml-auto text-[10px] text-zinc-400">{formatAgo(rec.created_at)}</span>
                  </div>
                  <p className="text-[12px] text-zinc-600 dark:text-zinc-400 truncate">{rec.original_text}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── No API key notice ── */}
      {hasKey === false && (
        <div className="mx-7 mt-4 shrink-0 flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/15 border border-amber-200/60 dark:border-amber-700/30 rounded-xl">
          <AlertCircle size={14} className="text-amber-500 shrink-0" />
          <p className="text-[12px] text-amber-700 dark:text-amber-400 flex-1">
            Add your API key in <strong>Preferences → AI Integration</strong> to get started.
          </p>
          <Settings size={13} className="text-amber-400 shrink-0" />
        </div>
      )}

      {/* ── Style picker ── */}
      <div className="px-5 py-3 shrink-0 border-b border-zinc-100 dark:border-zinc-800/60">
        <div className="flex gap-1.5 flex-wrap items-center">
          {/* Built-in */}
          {BUILTIN_STYLES.map(s => (
            <StyleChip
              key={s.id}
              id={s.id}
              label={s.label}
              emoji={s.emoji}
              active={style === s.id}
              onClick={() => setStyle(s.id)}
            />
          ))}

          {/* Divider */}
          {skills.length > 0 && <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700 mx-0.5" />}

          {/* Custom skills */}
          {skills.map(s => (
            <div key={s.id} className="relative group/skill">
              <StyleChip
                id={s.id}
                label={s.name}
                emoji={s.emoji}
                active={style === s.id}
                onClick={() => setStyle(s.id)}
              />
              <button
                onClick={e => { e.stopPropagation(); handleDeleteSkill(s.id, s.name); }}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white hidden group-hover/skill:flex items-center justify-center"
              >
                <X size={8} />
              </button>
            </div>
          ))}

          {/* Add skill button */}
          <button
            onClick={() => setShowNewSkill(s => !s)}
            title="Create custom AI skill"
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
              showNewSkill
                ? "bg-blue-600 text-white border-transparent"
                : "text-zinc-400 border-dashed border-zinc-300 dark:border-zinc-600 hover:border-blue-400 hover:text-blue-500"
            }`}
          >
            <Plus size={11} /> Skill
          </button>
        </div>

        {/* New skill form */}
        {showNewSkill && (
          <div className="mt-3 p-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl border border-zinc-200/60 dark:border-zinc-700/40 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">New Custom Skill</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={skillEmoji}
                onChange={e => setSkillEmoji(e.target.value)}
                className="w-12 text-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-2 py-2 text-[18px] outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <input
                autoFocus
                type="text"
                value={skillName}
                onChange={e => setSkillName(e.target.value)}
                placeholder="Skill name (e.g. LinkedIn Post)"
                className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-blue-500/20 placeholder:text-zinc-400"
              />
            </div>
            <textarea
              rows={3}
              value={skillPrompt}
              onChange={e => setSkillPrompt(e.target.value)}
              placeholder="System prompt — describe how the AI should reformat the text..."
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-[12px] text-zinc-700 dark:text-zinc-300 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-blue-500/20 resize-none leading-relaxed"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowNewSkill(false); setSkillName(""); setSkillPrompt(""); }}
                className="text-[12px] font-semibold text-zinc-400 hover:text-zinc-600 px-3 py-1.5 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSkill}
                disabled={!skillName.trim() || !skillPrompt.trim() || savingSkill}
                className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-[12px] font-bold transition-all"
              >
                {savingSkill ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                Save Skill
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Main content: input | output ── */}
      <div className="flex flex-1 min-h-0 divide-x divide-zinc-100 dark:divide-zinc-800/60">

        {/* Input panel */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-4 py-2 flex items-center justify-between shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Input</span>
            <div className="flex items-center gap-2">
              {input.trim() && (
                <button
                  title="Quick Transform"
                  onClick={e => setTransformAnchor(e.currentTarget)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-zinc-400 hover:text-blue-500 transition-colors"
                >
                  <Zap size={12} /> Transform
                </button>
              )}
              <button
                onClick={handleFromClipboard}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400 hover:text-blue-500 transition-colors"
              >
                <Clipboard size={12} /> Paste from Clipboard
              </button>
            </div>
          </div>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                handleReformat();
              }
            }}
            placeholder="Type or paste text here..."
            className="flex-1 resize-none bg-transparent px-4 pb-4 text-[13px] text-zinc-700 dark:text-zinc-300 placeholder:text-zinc-300 dark:placeholder:text-zinc-600 outline-none leading-relaxed"
          />
        </div>

        {/* Output panel */}
        <div className="flex-1 flex flex-col min-w-0 bg-zinc-50/50 dark:bg-zinc-900/20">
          <div className="px-4 py-2 flex items-center justify-between shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Output</span>
            {output && (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-[11px] font-semibold text-zinc-400 hover:text-blue-500 transition-colors px-2 py-0.5 rounded"
                >
                  {copied ? <CheckCircle2 size={12} className="text-emerald-500" /> : <Copy size={12} />}
                  {copied ? "Copied!" : "Copy"}
                </button>
                <button
                  onClick={handlePaste}
                  className="flex items-center gap-1 text-[11px] font-semibold text-zinc-400 hover:text-blue-500 transition-colors px-2 py-0.5 rounded"
                >
                  <Zap size={12} /> Paste
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 px-4 pb-4 overflow-y-auto hide-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-400">
                <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-[12px] font-medium">Reformatting...</span>
              </div>
            ) : error ? (
              <div className="flex items-start gap-2.5 p-3 bg-red-50 dark:bg-red-900/15 border border-red-200/50 dark:border-red-700/30 rounded-xl mt-2">
                <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-[12px] text-red-600 dark:text-red-400 leading-relaxed">{error}</p>
              </div>
            ) : output ? (
              <p className="text-[13px] text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                {output}
              </p>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-zinc-300 dark:text-zinc-700 gap-2">
                <Sparkles size={28} strokeWidth={1} />
                <p className="text-[12px] font-medium">Result appears here</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {transformAnchor && (
        <TransformPopover
          text={input}
          anchor={transformAnchor}
          onTransformed={result => setInput(result)}
          onClose={() => setTransformAnchor(null)}
        />
      )}

      {/* ── Action bar ── */}
      <div className="shrink-0 px-7 py-4 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between bg-white/80 dark:bg-[#1a1a1a]/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          {(output || error) && (
            <button
              onClick={() => { setOutput(""); setError(""); }}
              className="flex items-center gap-1.5 text-[12px] font-semibold text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
            >
              <RotateCcw size={13} /> Reset
            </button>
          )}
          <span className="text-[11px] text-zinc-300 dark:text-zinc-700">
            {input.trim() ? `${input.length} chars · ${input.trim().split(/\s+/).length} words` : ""}
          </span>
        </div>

        <button
          onClick={handleReformat}
          disabled={!input.trim() || loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-[13px] font-bold shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all"
        >
          <Sparkles size={14} />
          Reformat
          <span className="text-[10px] opacity-60 font-normal ml-0.5">⌘↵</span>
        </button>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StyleChip({ label, emoji, active, onClick }: {
  id?: string; label: string; emoji: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-all ${
        active
          ? "bg-blue-600 text-white border-transparent shadow-sm shadow-blue-500/20"
          : "text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-200"
      }`}
    >
      <span className="text-[13px] leading-none">{emoji}</span>
      {label}
    </button>
  );
}

function formatAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
