import { useEffect, useState } from "react";
import { useClipboardStore } from "../../stores/clipboardStore";
import { Pin, Trash2, Clock, AppWindow, Search, FilterX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function HistoryList() {
  const { items, loading, load, pin, remove, clearAll, pasteItem, startListening } =
    useClipboardStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "pinned">("all");
  const [confirmingPurge, setConfirmingPurge] = useState(false);

  useEffect(() => {
    load();
    startListening();
  }, []);

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.content_preview?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.source_app?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilter === "all" || item.is_pinned;
    return matchesSearch && matchesFilter;
  });

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-400 text-sm">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="font-medium tracking-tight">Syncing History...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#1a1a1a]">
      {/* macOS Internal Header */}
      <div className="px-6 py-5 space-y-4 border-b border-zinc-200/40 dark:border-zinc-800/40">
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-bold text-zinc-900 dark:text-zinc-100 font-display tracking-tight">
            All Journals
          </h2>
          {confirmingPurge ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setConfirmingPurge(false)}
                className="text-[11px] font-bold text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors px-2 py-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                onClick={() => { clearAll(); setConfirmingPurge(false); }}
                className="text-[11px] font-bold text-white bg-red-500 hover:bg-red-600 transition-colors px-2 py-1 rounded-md"
              >
                Confirm
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingPurge(true)}
              className="text-[11px] font-bold text-zinc-400 hover:text-red-500 transition-colors uppercase tracking-widest px-2 py-1 rounded-md hover:bg-red-500/5"
            >
              Purge
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 group">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Filter by content or app..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-[7px] bg-zinc-100/50 dark:bg-zinc-800/50 border-none rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-zinc-500/60"
            />
          </div>
          <div className="flex p-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg shadow-inner">
            <FilterButton
              active={activeFilter === "all"}
              onClick={() => setActiveFilter("all")}
              label="All"
            />
            <FilterButton
              active={activeFilter === "pinned"}
              onClick={() => setActiveFilter("pinned")}
              label="Pinned"
            />
          </div>
        </div>
      </div>

      {/* List - Frame Motion Animated */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1.5 hide-scrollbar">
        <AnimatePresence mode="popLayout">
          {filteredItems.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-48 text-zinc-400"
            >
              <FilterX size={32} strokeWidth={1} className="mb-3 opacity-20" />
              <p className="text-[13px] font-medium">No records found</p>
            </motion.div>
          ) : (
            filteredItems.map((item) => (
              <motion.div
                layout
                initial={{ opacity: 0, y: 5, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                key={item.id}
                onClick={() => pasteItem(item.id)}
                className="group px-4 py-3 rounded-[12px] bg-transparent hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40 cursor-pointer transition-all relative"
              >
                <div className="flex items-start gap-3.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-zinc-700 dark:text-zinc-300 break-words leading-snug line-clamp-3 font-[450]">
                      {item.content_preview}
                    </p>

                    <div className="flex items-center justify-between mt-2 opacity-50 transition-opacity group-hover:opacity-100">
                      <div className="flex items-center gap-3">
                        <MetadataItem icon={<Clock size={11} />} label={formatTimeAgo(item.created_at)} />
                        {item.source_app && (
                          <MetadataItem icon={<AppWindow size={11} />} label={item.source_app} />
                        )}
                        {item.use_count > 0 && (
                          <span className="text-[10px] font-bold text-blue-500 flex items-center gap-1">
                            <span className="w-1 h-1 bg-blue-500 rounded-full" />
                            {item.use_count}x
                          </span>
                        )}
                      </div>

                      {item.is_pinned && (
                        <motion.div layoutId={`pin-${item.id}`} className="mt-0.5">
                          <Pin size={11} className="text-blue-500 fill-blue-500" />
                        </motion.div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity self-start mt-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); pin(item.id, !item.is_pinned); }}
                      className={`p-1.5 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 ${item.is_pinned ? "text-blue-500" : "text-zinc-400"}`}
                    >
                      <Pin size={14} className={item.is_pinned ? "fill-current" : ""} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); remove(item.id); }}
                      className="p-1.5 rounded-md hover:bg-red-500/10 text-zinc-400 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function MetadataItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="text-[11px] flex items-center gap-1.5 font-medium">
      {icon}
      {label}
    </span>
  );
}

function FilterButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-[3px] rounded-md text-[11px] font-bold transition-all ${active
        ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
        : "text-zinc-500 hover:text-zinc-700"
        }`}
    >
      {label}
    </button>
  );
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "yesterday";
  return `${diffDay}d ago`;
}
