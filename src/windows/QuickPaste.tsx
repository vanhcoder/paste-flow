import { useEffect, useRef, useState } from "react";
import { useSearchStore as useLocalSearchStore } from "../stores/searchStore";
import { api, Template } from "../lib/tauri";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Search, Clock, Layers, Command, Pin } from "lucide-react";
import { VariableModal } from "../components/Templates/VariableModal";
import { TemplatePreview } from "../components/Templates/TemplatePreview";
import { AnimatePresence } from "framer-motion";
import {
  resolveBuiltins,
  parseVariableMeta,
  hasUserVariables,
  hasBuiltinVariables,
  substituteVariables,
} from "../lib/variables";

type FlowState =
  | { step: "search" }
  | { step: "variables"; template: Template; resolvedContent: string }
  | {
      step: "preview";
      template: Template;
      finalContent: string;
      values: Record<string, string>;
    };

export default function QuickPaste() {
  const {
    query,
    results,
    loading,
    selectedIdx,
    setQuery,
    moveSelection,
    search,
    reset,
  } = useLocalSearchStore();
  const [flow, setFlow] = useState<FlowState>({ step: "search" });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    search();

    const unlisten = getCurrentWindow().onFocusChanged(
      ({ payload: focused }) => {
        if (focused) {
          reset();
          search();
          setFlow({ step: "search" });
          inputRef.current?.focus();
        }
      },
    );

    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  useEffect(() => {
    const el = document.getElementById(`item-${selectedIdx}`);
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedIdx]);

  // ── Template flow ──
  const startTemplateFlow = async (tpl: Template) => {
    let content = tpl.content;
    if (hasBuiltinVariables(content)) {
      content = resolveBuiltins(content);
    }

    const vars = parseVariableMeta(tpl.variables);
    if (vars.length > 0) {
      setFlow({ step: "variables", template: tpl, resolvedContent: content });
    } else if (hasBuiltinVariables(tpl.content)) {
      setFlow({
        step: "preview",
        template: tpl,
        finalContent: content,
        values: {},
      });
    } else {
      // Simple template — paste directly
      await doPaste(tpl, content, {});
    }
  };

  const handleVariableConfirm = (values: Record<string, string>) => {
    if (flow.step !== "variables") return;
    const meta = parseVariableMeta(flow.template.variables);
    const finalContent = substituteVariables(
      flow.resolvedContent,
      values,
      meta,
    );
    setFlow({
      step: "preview",
      template: flow.template,
      finalContent,
      values,
    });
  };

  const handleCopy = async () => {
    if (flow.step !== "preview") return;
    await navigator.clipboard.writeText(flow.finalContent);
    await afterAction(flow.template, flow.values);
    await getCurrentWindow().hide();
  };

  const handlePaste = async () => {
    if (flow.step !== "preview") return;
    await getCurrentWindow().hide();
    await api.pasteToActiveApp(flow.finalContent);
    await afterAction(flow.template, flow.values);
  };

  const doPaste = async (
    tpl: Template,
    content: string,
    values: Record<string, string>,
  ) => {
    await getCurrentWindow().hide();
    await api.pasteToActiveApp(content);
    await afterAction(tpl, values);
  };

  const afterAction = async (
    tpl: Template,
    values: Record<string, string>,
  ) => {
    await api.incrementTemplateUseCount(tpl.id).catch(() => {});
    const entries = Object.entries(values)
      .filter(([, v]) => v)
      .map(([name, value]) => ({ name, value }));
    if (entries.length > 0) {
      await api.saveVariableValues(tpl.id, entries).catch(() => {});
    }
    setFlow({ step: "search" });
    reset();
  };

  // ── Action handler ──
  const handleAction = async (idx?: number) => {
    try {
      const targetIdx = idx !== undefined ? idx : selectedIdx;
      const item = results[targetIdx];
      if (!item) return;

      if (item.result_type === "history") {
        const content = await api.getClipContent(item.id);
        await getCurrentWindow().hide();
        await api.pasteToActiveApp(content);
        reset();
      } else {
        const tpl = await api.getTemplate(item.id);
        if (tpl) await startTemplateFlow(tpl);
      }
    } catch (err: any) {
      alert("ERROR: " + err.message);
    }
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
    <div className="h-screen w-screen bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-[12px] shadow-2xl flex flex-col overflow-hidden select-none relative">
      {/* Search Header */}
      <div className="flex items-center px-4 py-4 border-b border-zinc-100 dark:border-zinc-800 gap-3">
        <Search
          size={18}
          className={
            loading ? "text-blue-500 animate-pulse" : "text-zinc-400"
          }
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search history & templates..."
          className="flex-1 bg-transparent border-none outline-none text-base text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 font-medium"
        />
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto hide-scrollbar py-2">
        {results.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-400 py-10">
            <Command size={32} strokeWidth={1} className="mb-2 opacity-20" />
            <p className="text-sm font-medium">No results found</p>
          </div>
        ) : (
          <>
            {query.trim() === "" &&
              results.some((r) => r.score >= 2.0) && (
                <p className="px-4 pt-1 pb-1 text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1">
                  <Pin size={10} /> Pinned
                </p>
              )}
            {results.map((item, idx) => {
              const showRecentHeader =
                query.trim() === "" &&
                idx > 0 &&
                results[idx - 1].score >= 2.0 &&
                item.score < 2.0;

              return (
                <div key={`${item.id}-${idx}`}>
                  {showRecentHeader && (
                    <p className="px-4 pt-3 pb-1 text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1">
                      <Clock size={10} /> Recent
                    </p>
                  )}
                  <div
                    id={`item-${idx}`}
                    onMouseEnter={() =>
                      useLocalSearchStore.setState({ selectedIdx: idx })
                    }
                    onClick={() => handleAction(idx)}
                    className={`mx-2 px-3 py-3 rounded-xl cursor-pointer transition-all flex items-start gap-3
                      ${
                        selectedIdx === idx
                          ? "bg-blue-600 dark:bg-blue-600 text-white shadow-lg shadow-blue-500/20 translate-x-1"
                          : "hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-300"
                      }`}
                  >
                    <div
                      className={`mt-0.5 shrink-0 ${selectedIdx === idx ? "text-blue-100" : "text-zinc-400"}`}
                    >
                      {item.result_type === "history" ? (
                        <Clock size={14} />
                      ) : item.score >= 2.0 ? (
                        <Pin size={14} />
                      ) : (
                        <Layers size={14} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={`text-[10px] font-bold uppercase tracking-wider truncate mb-0.5 ${selectedIdx === idx ? "text-blue-100/80" : "text-zinc-400"}`}
                        >
                          {item.title}{" "}
                          {item.group_name && `\u2022 ${item.group_name}`}
                        </p>
                        {idx < 9 && (
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                              selectedIdx === idx
                                ? "border-blue-400 bg-blue-500 text-white"
                                : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-400"
                            }`}
                          >
                            \u2318{idx + 1}
                          </span>
                        )}
                      </div>
                      <p
                        className={`text-sm truncate font-medium ${selectedIdx === idx ? "text-white" : "text-zinc-700 dark:text-zinc-200"}`}
                      >
                        {item.preview}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-zinc-50/50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-4">
        <Hint keybd="\u2191\u2193" action="Navigate" />
        <Hint keybd="\u23CE" action="Paste" />
        <Hint keybd="Esc" action="Close" />
      </div>

      {/* Overlay flows */}
      <AnimatePresence>
        {flow.step === "variables" && (
          <VariableModal
            template={flow.template}
            onClose={() => setFlow({ step: "search" })}
            onConfirm={handleVariableConfirm}
          />
        )}
        {flow.step === "preview" && (
          <TemplatePreview
            title={flow.template.title}
            content={flow.finalContent}
            onCopy={handleCopy}
            onPaste={handlePaste}
            onBack={() => {
              if (hasUserVariables(flow.template.variables)) {
                setFlow({
                  step: "variables",
                  template: flow.template,
                  resolvedContent: flow.finalContent,
                });
              } else {
                setFlow({ step: "search" });
              }
            }}
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
