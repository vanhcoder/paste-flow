import { useEffect } from "react";
import { motion } from "framer-motion";
import { Copy, Zap, ArrowLeft } from "lucide-react";

interface Props {
  title: string;
  content: string;
  onCopy: () => void;
  onPaste: () => void;
  onBack: () => void;
}

export function TemplatePreview({
  title,
  content,
  onCopy,
  onPaste,
  onBack,
}: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onPaste();
      } else if (e.key === "c" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        onCopy();
      } else if (e.key === "Escape" || e.key === "Backspace") {
        e.preventDefault();
        onBack();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCopy, onPaste, onBack]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex flex-col bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl"
    >
      <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
            Preview
          </p>
          <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            {title}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <pre className="text-sm text-zinc-700 dark:text-zinc-200 whitespace-pre-wrap font-sans leading-relaxed">
          {content}
        </pre>
      </div>

      <div className="px-4 py-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
        <div className="flex gap-3 text-[10px] text-zinc-400">
          <span>
            <kbd className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-[9px] font-bold border border-zinc-200 dark:border-zinc-700">
              C
            </kbd>{" "}
            Copy
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-[9px] font-bold border border-zinc-200 dark:border-zinc-700">
              Enter
            </kbd>{" "}
            Paste
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-[9px] font-bold border border-zinc-200 dark:border-zinc-700">
              Esc
            </kbd>{" "}
            Back
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCopy}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors border border-zinc-200 dark:border-zinc-700"
          >
            <Copy size={13} /> Copy
          </button>
          <button
            onClick={onPaste}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
          >
            <Zap size={13} className="fill-current" /> Paste
          </button>
        </div>
      </div>
    </motion.div>
  );
}
