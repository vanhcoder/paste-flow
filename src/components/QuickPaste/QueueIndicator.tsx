import { useQueueStore } from "../../stores/queueStore";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { QueueStatus } from "../../lib/tauri";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function QueueIndicator() {
  const { status, fetchStatus } = useQueueStore();
  const { mode, total, remaining } = status;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchStatus();

    const interval = setInterval(() => {
      fetchStatus();
    }, 500);

    const unlistenStatus = listen<QueueStatus>(
      "queue-status-changed",
      (event) => {
        useQueueStore.setState({ status: event.payload });
      },
    );

    return () => {
      clearInterval(interval);
      unlistenStatus.then((fn) => fn());
    };
  }, []);

  if (!mounted || mode === "Off") return null;

  const isCollecting = mode === "Collecting";
  const progress = total > 0 ? (total - remaining) / total : 0;
  const r = 28;
  const circumference = 2 * Math.PI * r;

  const startDrag = (e: React.MouseEvent) => {
    if (e.button === 0) {
      e.preventDefault();
      getCurrentWindow().startDragging();
    }
  };

  const glowShadow = isCollecting
    ? "0 0 14px 3px rgba(245,158,11,0.5), 0 0 6px 1px rgba(245,158,11,0.35)"
    : "0 0 14px 3px rgba(59,130,246,0.5), 0 0 6px 1px rgba(59,130,246,0.35)";

  return (
    <div
      data-tauri-drag-region
      onMouseDown={startDrag}
      className="h-screen w-screen flex items-center justify-center select-none cursor-grab active:cursor-grabbing"
    >
      <motion.div
        data-tauri-drag-region
        onMouseDown={startDrag}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="relative"
      >
        {/* Main orb — glow via box-shadow (follows border-radius, no rectangle fill) */}
        <div
          data-tauri-drag-region
          onMouseDown={startDrag}
          className={`relative w-16 h-16 rounded-full flex flex-col items-center justify-center
            ${
              isCollecting
                ? "bg-linear-to-br from-amber-900/90 to-zinc-950/95 border border-amber-500/30"
                : "bg-linear-to-br from-blue-900/90 to-zinc-950/95 border border-blue-500/30"
            }`}
          style={{ boxShadow: glowShadow }}
        >
          {/* Progress ring for Pasting mode */}
          {!isCollecting && total > 0 && (
            <svg
              className="absolute inset-0 w-full h-full -rotate-90"
              viewBox="0 0 64 64"
            >
              <circle
                cx="32"
                cy="32"
                r={r}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
                opacity="0.15"
              />
              <circle
                cx="32"
                cy="32"
                r={r}
                fill="none"
                stroke="#60a5fa"
                strokeWidth="2"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - progress)}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            </svg>
          )}

          {/* Pulse ring for Collecting mode */}
          {isCollecting && (
            <motion.div
              animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-0 rounded-full border border-amber-400/50"
            />
          )}

          {/* Counter */}
          <span
            className={`text-xl font-black tabular-nums leading-none pointer-events-none
              ${isCollecting ? "text-amber-300" : "text-blue-200"}`}
          >
            {isCollecting ? total : remaining}
          </span>

          {/* Label */}
          <span
            className={`text-[8px] font-semibold uppercase tracking-widest mt-0.5 pointer-events-none
              ${isCollecting ? "text-amber-500/70" : "text-blue-400/70"}`}
          >
            {isCollecting ? "copy" : "paste"}
          </span>
        </div>
      </motion.div>
    </div>
  );
}
