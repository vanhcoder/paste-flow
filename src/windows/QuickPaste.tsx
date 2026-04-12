import { useEffect, useRef, useState } from "react";
import { useSearchStore as useLocalSearchStore } from "../stores/searchStore";
import { api, Template } from "../lib/tauri";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Search, Clock, Zap, Layers, Command } from "lucide-react";
import { VariableModal } from "../components/Templates/VariableModal";
import { AnimatePresence } from "framer-motion";

export default function QuickPaste() {
  const { query, results, loading, selectedIdx, setQuery, moveSelection, search, reset } = useLocalSearchStore();
  const [expandingTemplate, setExpandingTemplate] = useState<Template | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    search(); // Load recent on mount

    const unlisten = getCurrentWindow().onFocusChanged(({ payload: focused }) => {
      if (focused) {
        reset();
        search();
        setExpandingTemplate(null);
        inputRef.current?.focus();
      }
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  useEffect(() => {
    const selectedElement = document.getElementById(`item-${selectedIdx}`);
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIdx]);

  const handleAction = async (idx?: number) => {
    try {
      const targetIdx = idx !== undefined ? idx : selectedIdx;
      const item = results[targetIdx];
      if (!item) return;

      console.log(">>> ACTION:", item);

      if (item.result_type === "history") {
        const content = await api.getClipContent(item.id);
        console.log(">>> CLIP CONTENT:", content?.substring(0, 50));
        await getCurrentWindow().hide();
        await api.pasteToActiveApp(content);
        reset();
      } else {
        const tpl = await api.getTemplate(item.id);
        if (tpl) {
          console.log(">>> TEMPLATE CONTENT:", tpl.content.substring(0, 50));
          let vars: string[] = [];
          try {
            vars = typeof tpl.variables === "string" ? JSON.parse(tpl.variables) : tpl.variables;
          } catch (e) {
            console.error(">>> PARSE VARS ERROR:", e);
          }

          if (vars && vars.length > 0) {
            setExpandingTemplate(tpl);
          } else {
            await getCurrentWindow().hide();
            await api.pasteToActiveApp(tpl.content);
            reset();
          }
        }
      }
    } catch (err: any) {
      console.error(">>> HANDLE ACTION ERROR:", err);
      alert("ERROR: " + err.message);
    }
  };

  const handleConfirmExpansion = async (values: Record<string, string>) => {
    if (!expandingTemplate) return;
    let finalContent = expandingTemplate.content;
    Object.entries(values).forEach(([key, val]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
      finalContent = finalContent.replace(regex, val || `{{${key}}}`);
    });

    await getCurrentWindow().hide();
    await api.pasteToActiveApp(finalContent);
    setExpandingTemplate(null);
    reset();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveSelection("down");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveSelection("up");
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleAction();
    } else if (e.key === "Escape") {
      e.preventDefault();
      getCurrentWindow().hide();
    } else if (e.metaKey || e.ctrlKey) {
      const num = parseInt(e.key);
      if (num >= 1 && num <= 9) {
        e.preventDefault();
        handleAction(num - 1);
      }
    }
  };

  return (
    <div className="h-screen w-screen bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-[12px] shadow-2xl flex flex-col overflow-hidden select-none">
      {/* Search Header */}
      <div className="flex items-center px-4 py-4 border-b border-zinc-100 dark:border-zinc-800 gap-3">
        <Search size={18} className={loading ? "text-blue-500 animate-pulse" : "text-zinc-400"} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search history & templates..."
          className="flex-1 bg-transparent border-none outline-none text-base text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 font-medium"
        />
        <div className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[10px] text-zinc-400 font-bold tracking-widest uppercase">
          Popup
        </div>
      </div>

      {/* Results List */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto hide-scrollbar py-2">
        {results.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-400 py-10">
            <Command size={32} strokeWidth={1} className="mb-2 opacity-20" />
            <p className="text-sm font-medium">No results found</p>
          </div>
        ) : (
          results.map((item, idx) => (
            <div
              key={`${item.id}-${idx}`}
              id={`item-${idx}`}
              onMouseEnter={() => useLocalSearchStore.setState({ selectedIdx: idx })}
              onClick={() => handleAction(idx)}
              className={`mx-2 px-3 py-3 rounded-xl cursor-pointer transition-all flex items-start gap-3 relative
                ${selectedIdx === idx
                  ? "bg-blue-600 dark:bg-blue-600 text-white shadow-lg shadow-blue-500/20 translate-x-1"
                  : "hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-300"
                }`}
            >
              {/* Type Icon */}
              <div className={`mt-0.5 shrink-0 ${selectedIdx === idx ? "text-blue-100" : "text-zinc-400"}`}>
                {item.result_type === "history" ? <Clock size={14} /> : <Layers size={14} />}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-[10px] font-bold uppercase tracking-wider truncate mb-0.5 ${selectedIdx === idx ? "text-blue-100/80" : "text-zinc-400"}`}>
                    {item.title} {item.group_name && `• ${item.group_name}`}
                  </p>
                  {idx < 9 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${selectedIdx === idx
                      ? "border-blue-400 bg-blue-500 text-white"
                      : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-400"
                      }`}>
                      ⌘{idx + 1}
                    </span>
                  )}
                </div>
                <p className={`text-sm truncate font-medium ${selectedIdx === idx ? "text-white" : "text-zinc-700 dark:text-zinc-200"}`}>
                  {item.preview}
                </p>
              </div>

              {/* Action indicator */}
              {selectedIdx === idx && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 animate-in fade-in slide-in-from-right-1">
                  <Zap size={14} className="fill-current" />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer Hints */}
      <div className="px-4 py-3 bg-zinc-50/50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
        <div className="flex gap-4">
          <Hint keybd="↑↓" action="Navigate" />
          <Hint keybd="⏎" action="Paste" />
          <Hint keybd="Esc" action="Close" />
        </div>
        <div className="flex items-center gap-1">
          <Zap size={10} className="text-blue-500 fill-blue-500" />
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">PasteFlow Quick</span>
        </div>
      </div>

      <AnimatePresence>
        {expandingTemplate && (
          <VariableModal
            template={expandingTemplate}
            onClose={() => setExpandingTemplate(null)}
            onConfirm={handleConfirmExpansion}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Hint({ keybd, action }: { keybd: string; action: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <kbd className="px-1.5 py-0.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-[9px] font-bold text-zinc-500 shadow-sm">
        {keybd}
      </kbd>
      <span className="text-[10px] font-medium text-zinc-400">{action}</span>
    </div>
  );
}
