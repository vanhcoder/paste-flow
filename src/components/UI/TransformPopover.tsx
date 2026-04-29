import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TRANSFORMS, TRANSFORM_CATEGORIES, applyTransform } from "../../lib/transforms";
import { toast } from "../../stores/toastStore";

interface Props {
  text: string;
  anchor: HTMLElement;
  /** When provided: sets transformed text in-place instead of copying to clipboard */
  onTransformed?: (result: string) => void;
  onClose: () => void;
}

const W = 212;
const H = 340;

function calcPos(anchor: HTMLElement) {
  const rect = anchor.getBoundingClientRect();
  const left = Math.max(8, Math.min(rect.right - W, window.innerWidth - W - 8));
  const top  = rect.top > H + 12 ? rect.top - H - 8 : rect.bottom + 8;
  return { top, left };
}

export function TransformPopover({ text, anchor, onTransformed, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(() => calcPos(anchor));

  const updatePos = useCallback(() => setPos(calcPos(anchor)), [anchor]);

  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onMouse);
    document.addEventListener("keydown", onKey);

    window.addEventListener("resize", updatePos);
    const ro = new ResizeObserver(updatePos);
    ro.observe(document.body);

    return () => {
      document.removeEventListener("mousedown", onMouse);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", updatePos);
      ro.disconnect();
    };
  }, [onClose, updatePos]);

  const { top, left } = pos;

  const apply = (id: string) => {
    const t = TRANSFORMS.find(x => x.id === id);
    if (!t || !text.trim()) return;
    const out = applyTransform(t, text);
    if (!out.ok) {
      toast.error(`Cannot apply "${t.label}": invalid input`);
      return;
    }
    if (onTransformed) {
      onTransformed(out.result);
      toast.success(`Applied: ${t.label}`);
    } else {
      navigator.clipboard.writeText(out.result);
      toast.success(`Copied as ${t.label}`);
    }
    onClose();
  };

  const preview = text.length > 44 ? text.slice(0, 44) + "…" : text;

  return createPortal(
    <div
      ref={ref}
      style={{ position: "fixed", top, left, width: W, zIndex: 9999 }}
      className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-700/60 rounded-2xl shadow-2xl shadow-black/10 dark:shadow-black/50 overflow-hidden"
    >
      {/* Header */}
      <div className="px-3.5 pt-3 pb-2 border-b border-zinc-100 dark:border-zinc-800">
        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Quick Transform</p>
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono truncate leading-snug">{preview}</p>
      </div>

      {/* Transform list */}
      <div className="max-h-64 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        {TRANSFORM_CATEGORIES.map(cat => (
          <div key={cat}>
            <p className="px-3.5 pt-2.5 pb-0.5 text-[9px] font-bold uppercase tracking-widest text-zinc-400">
              {cat}
            </p>
            {TRANSFORMS.filter(t => t.category === cat).map(t => (
              <button
                key={t.id}
                onClick={() => apply(t.id)}
                className="w-full text-left px-3.5 py-[7px] text-[12px] font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                {t.label}
              </button>
            ))}
          </div>
        ))}
        <div className="h-2" />
      </div>
    </div>,
    document.body,
  );
}
