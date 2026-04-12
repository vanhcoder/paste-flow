import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Send, Keyboard } from "lucide-react";

interface VariableModalProps {
  template: {
    title: string;
    content: string;
    variables: string;
  };
  onClose: () => void;
  onConfirm: (values: Record<string, string>) => void;
}

export function VariableModal({ template, onClose, onConfirm }: VariableModalProps) {
  const variables: string[] = JSON.parse(template.variables);
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    // Initialize values
    const initial: Record<string, string> = {};
    variables.forEach(v => initial[v] = "");
    setValues(initial);
  }, [template.variables]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(values);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
      >
        <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/20">
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Keyboard size={18} className="text-blue-500" /> Fill Variables
            </h3>
            <p className="text-[11px] text-zinc-400 font-medium">Template: {template.title}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors">
            <X size={18} className="text-zinc-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {variables.map((v) => (
            <div key={v} className="space-y-1.5 focus-within:translate-x-1 transition-transform">
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest pl-1">{v.replace(/_/g, " ")}</label>
              <input
                autoFocus={variables[0] === v}
                placeholder={`Value for {{${v}}}...`}
                className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 rounded-xl text-[14px] outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5 transition-all"
                value={values[v] || ""}
                onChange={(e) => setValues(prev => ({ ...prev, [v]: e.target.value }))}
              />
            </div>
          ))}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 text-[14px] font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-[2] px-4 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-[14px] font-bold rounded-xl flex items-center justify-center gap-2 shadow-xl shadow-black/10 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              Apply & Paste <Send size={14} />
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
