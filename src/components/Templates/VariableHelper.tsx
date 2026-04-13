import { useRef, useState } from "react";
import { ChevronDown, ChevronUp, Sparkles, Plus } from "lucide-react";

// ── Built-in variables ──────────────────────────────────────────────────────

const BUILTINS = [
  { label: "TODAY", insert: "{{TODAY}}", desc: "Ngày hôm nay, vd: 12/04/2026" },
  { label: "NOW", insert: "{{NOW}}", desc: "Ngày + giờ hiện tại" },
  { label: "WEEKDAY", insert: "{{WEEKDAY}}", desc: "Thứ trong tuần, vd: Saturday" },
  { label: "MONTH", insert: "{{MONTH}}", desc: "Tháng hiện tại, vd: April" },
  { label: "YEAR", insert: "{{YEAR}}", desc: "Năm hiện tại, vd: 2026" },
  { label: "CLIPBOARD", insert: "{{CLIPBOARD}}", desc: "Nội dung clipboard lúc paste" },
];

// ── Custom variable types ───────────────────────────────────────────────────

interface VarTypeConfig {
  type: string;
  label: string;
  desc: string;
  syntax: string;
  extraLabel?: string;
  extraPlaceholder?: string;
  extraDefault?: string;
}

const VAR_TYPES: VarTypeConfig[] = [
  { type: "text", label: "Text", desc: "Ô nhập văn bản", syntax: "{{tên}}" },
  { type: "multiline", label: "Đoạn văn", desc: "Textarea nhiều dòng", syntax: "{{tên:multiline}}" },
  {
    type: "select",
    label: "Chọn",
    desc: "Dropdown lựa chọn",
    syntax: "{{tên:select:A,B,C}}",
    extraLabel: "Các tuỳ chọn (cách nhau bởi dấu phẩy)",
    extraPlaceholder: "Anh,Chị,Bạn",
    extraDefault: "Anh,Chị,Bạn",
  },
  { type: "date", label: "Ngày", desc: "Bộ chọn ngày", syntax: "{{tên:date}}" },
  { type: "number", label: "Số", desc: "Số nguyên/thập phân có format", syntax: "{{tên:number}}" },
  {
    type: "currency",
    label: "Tiền tệ",
    desc: "Số tiền có ký hiệu",
    syntax: "{{tên:currency:VND}}",
    extraLabel: "Loại tiền (VND / USD / EUR / JPY)",
    extraPlaceholder: "VND",
    extraDefault: "VND",
  },
  { type: "percent", label: "%", desc: "Tỉ lệ phần trăm", syntax: "{{tên:percent}}" },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function detectVars(content: string) {
  const matches = [...content.matchAll(/\{\{([^}]+)\}\}/g)];
  const builtin: string[] = [];
  const user: string[] = [];
  const seen = new Set<string>();
  for (const m of matches) {
    const raw = m[1].trim();
    const name = raw.split(":")[0];
    if (seen.has(raw)) continue;
    seen.add(raw);
    if (/^[A-Z_]+$/.test(name)) builtin.push(raw);
    else user.push(raw);
  }
  return { builtin, user };
}

// ── Component ───────────────────────────────────────────────────────────────

interface InsertState {
  cfg: VarTypeConfig;
  name: string;
  extra: string;
}

interface Props {
  content: string;
  onInsert: (snippet: string) => void;
}

export function VariableHelper({ content, onInsert }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [inserting, setInserting] = useState<InsertState | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const extraRef = useRef<HTMLInputElement>(null);

  const { builtin, user } = detectVars(content);
  const hasVars = builtin.length > 0 || user.length > 0;

  const startInsert = (cfg: VarTypeConfig) => {
    setInserting({ cfg, name: "", extra: cfg.extraDefault ?? "" });
    setTimeout(() => nameRef.current?.focus(), 40);
  };

  const confirmInsert = () => {
    if (!inserting) return;
    const name = inserting.name.trim();
    if (!name) return;
    let snippet = `{{${name}`;
    if (inserting.cfg.type !== "text") snippet += `:${inserting.cfg.type}`;
    if (inserting.extra.trim() && inserting.cfg.extraLabel) snippet += `:${inserting.extra.trim()}`;
    snippet += "}}";
    onInsert(snippet);
    setInserting(null);
  };

  return (
    <div className="pt-3">
      {/* Detected variables — always visible when content has any */}
      {hasVars && (
        <div className="flex flex-wrap gap-1 mb-2">
          {builtin.map((v) => (
            <span
              key={v}
              className="px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded text-[10px] font-bold border border-emerald-200/40 dark:border-emerald-500/20"
            >
              {`{{${v}}}`}
            </span>
          ))}
          {user.map((v) => (
            <span
              key={v}
              className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded text-[10px] font-bold border border-blue-200/40 dark:border-blue-500/20"
            >
              {`{{${v}}}`}
            </span>
          ))}
        </div>
      )}

      {/* Toggle row */}
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-400 hover:text-blue-500 transition-colors select-none"
      >
        <Sparkles size={11} />
        Variable Helper
        {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>

      {expanded && !inserting && (
        <div className="mt-3 space-y-3">
          {/* Built-in variables */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1.5">
              Tự động — không cần nhập
            </p>
            <div className="flex flex-wrap gap-1.5">
              {BUILTINS.map((b) => (
                <button
                  key={b.label}
                  type="button"
                  title={b.desc}
                  onClick={() => onInsert(b.insert)}
                  className="px-2 py-1 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 rounded-md text-[11px] font-bold border border-emerald-200/40 dark:border-emerald-500/20 transition-colors"
                >
                  {b.insert}
                </button>
              ))}
            </div>
          </div>

          {/* Custom variable types */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1.5">
              Biến người dùng điền — chọn kiểu để chèn
            </p>
            <div className="flex flex-wrap gap-1.5">
              {VAR_TYPES.map((v) => (
                <button
                  key={v.type}
                  type="button"
                  title={`${v.desc}\nVí dụ: ${v.syntax}`}
                  onClick={() => startInsert(v)}
                  className="flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded-md text-[11px] font-bold border border-blue-200/40 dark:border-blue-500/20 transition-colors"
                >
                  <Plus size={9} />
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Syntax cheatsheet */}
          <div className="p-2.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200/40 dark:border-zinc-700/40 space-y-1 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
            <p className="font-sans font-bold text-[9px] uppercase tracking-widest text-zinc-400 mb-1.5 dark:text-zinc-500">
              Cú pháp nhanh
            </p>
            <p>
              <span className="text-blue-500">{`{{tên}}`}</span>
              <span className="font-sans text-zinc-400"> → văn bản</span>
            </p>
            <p>
              <span className="text-blue-500">{`{{tên:select:A,B,C}}`}</span>
              <span className="font-sans text-zinc-400"> → dropdown</span>
            </p>
            <p>
              <span className="text-blue-500">{`{{tên:currency:VND}}`}</span>
              <span className="font-sans text-zinc-400"> → tiền tệ</span>
            </p>
            <p>
              <span className="text-emerald-500">{`{{TODAY}}`}</span>
              <span className="font-sans text-zinc-400"> → tự điền ngày</span>
            </p>
          </div>
        </div>
      )}

      {/* Insert variable mini-form */}
      {inserting && (
        <div className="mt-2 p-3 bg-blue-50/80 dark:bg-blue-900/20 rounded-xl border border-blue-200/40 dark:border-blue-500/20">
          <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400 mb-2">
            Chèn biến — {inserting.cfg.label}
          </p>
          <p className="text-[10px] text-zinc-400 mb-2 font-mono">
            Ví dụ: {inserting.cfg.syntax}
          </p>
          <div className="space-y-2">
            <input
              ref={nameRef}
              type="text"
              placeholder="Tên biến, vd: ho_ten"
              className="w-full text-[12px] bg-white dark:bg-zinc-900 border border-blue-200 dark:border-blue-700 rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-blue-400 text-zinc-800 dark:text-zinc-200"
              value={inserting.name}
              onChange={(e) =>
                setInserting((s) => s && { ...s, name: e.target.value })
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (inserting.cfg.extraLabel) extraRef.current?.focus();
                  else confirmInsert();
                }
                if (e.key === "Escape") setInserting(null);
              }}
            />
            {inserting.cfg.extraLabel && (
              <input
                ref={extraRef}
                type="text"
                placeholder={inserting.cfg.extraPlaceholder}
                className="w-full text-[12px] bg-white dark:bg-zinc-900 border border-blue-200 dark:border-blue-700 rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-blue-400 text-zinc-800 dark:text-zinc-200"
                value={inserting.extra}
                onChange={(e) =>
                  setInserting((s) => s && { ...s, extra: e.target.value })
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmInsert();
                  if (e.key === "Escape") setInserting(null);
                }}
              />
            )}
            {/* Preview snippet */}
            {inserting.name.trim() && (
              <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 px-0.5">
                →{" "}
                <span className="text-blue-500">
                  {`{{${inserting.name.trim()}${inserting.cfg.type !== "text" ? `:${inserting.cfg.type}` : ""}${inserting.extra.trim() && inserting.cfg.extraLabel ? `:${inserting.extra.trim()}` : ""}}}`}
                </span>
              </p>
            )}
            <div className="flex gap-2 pt-0.5">
              <button
                type="button"
                onClick={confirmInsert}
                disabled={!inserting.name.trim()}
                className="px-3 py-1.5 bg-blue-600 disabled:opacity-40 text-white rounded-lg text-[11px] font-bold transition-opacity"
              >
                Chèn vào template
              </button>
              <button
                type="button"
                onClick={() => setInserting(null)}
                className="px-3 py-1.5 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 text-[11px] font-bold transition-colors"
              >
                Huỷ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
