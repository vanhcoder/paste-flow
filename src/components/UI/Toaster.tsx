import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { useToastStore, type ToastItem } from "../../stores/toastStore";

export function Toaster() {
  const { toasts, dismiss } = useToastStore();

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function Toast({ toast: t, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const styles = {
    success: {
      wrap: "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200/60 dark:border-emerald-700/40",
      icon: <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />,
      text: "text-emerald-800 dark:text-emerald-300",
    },
    error: {
      wrap: "bg-red-50 dark:bg-red-900/20 border-red-200/60 dark:border-red-700/40",
      icon: <AlertCircle size={15} className="text-red-500 shrink-0" />,
      text: "text-red-800 dark:text-red-300",
    },
    info: {
      wrap: "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700",
      icon: <Info size={15} className="text-blue-500 shrink-0" />,
      text: "text-zinc-700 dark:text-zinc-200",
    },
  }[t.type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.95 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg shadow-black/8 min-w-[260px] max-w-[380px] ${styles.wrap}`}
    >
      {styles.icon}
      <p className={`flex-1 text-[13px] font-medium leading-snug ${styles.text}`}>{t.message}</p>
      <button
        onClick={onDismiss}
        className="shrink-0 text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400 transition-colors"
      >
        <X size={13} />
      </button>
    </motion.div>
  );
}
