import { useState } from "react";
import { HistoryList } from "../components/History/HistoryList";
import { TemplateManager } from "../components/Templates/TemplateManager";
import { HelpGuide } from "../components/Help/HelpGuide";
import {
  AppWindow,
  Layers,
  Sparkles,
  Settings as SettingsIcon,
  ShieldCheck,
  ChevronRight,
  BookOpen,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { GeneralSettings } from "../components/Settings/GeneralSettings";

type Tab = "history" | "templates" | "ai" | "settings" | "help";

export default function MainWindow() {
  const [activeTab, setActiveTab] = useState<Tab>("history");

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-[#1a1a1a] text-zinc-900 dark:text-zinc-200 overflow-hidden font-sans border border-zinc-200 dark:border-zinc-800 rounded-[12px] shadow-2xl">
      {/* Sidebar - macOS Style */}
      <aside className="w-60 flex flex-col bg-zinc-100/70 dark:bg-zinc-900/40 backdrop-blur-2xl border-r border-zinc-200/30 dark:border-zinc-800/20 select-none">
        {/* macOS Window Controls (Visual only) */}
        <div className="p-5 flex gap-2">
          <div className="w-3.5 h-3.5 rounded-full bg-[#FF5F56] shadow-inner shadow-black/10" />
          <div className="w-3.5 h-3.5 rounded-full bg-[#FFBD2E] shadow-inner shadow-black/10" />
          <div className="w-3.5 h-3.5 rounded-full bg-[#27C93F] shadow-inner shadow-black/10" />
        </div>

        <div className="p-6 pt-2 pb-8 flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <AppWindow size={22} strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight font-display text-zinc-900 dark:text-zinc-100">
              PasteFlow
            </h1>
            <div className="flex items-center gap-1.5 opacity-60">
              <ShieldCheck size={10} className="text-blue-500" />
              <span className="text-[9px] font-bold uppercase tracking-widest">
                Version 1.0
              </span>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-0.5">
          <p className="px-3 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-3 opacity-80">
            Library
          </p>
          <NavItem
            active={activeTab === "history"}
            onClick={() => setActiveTab("history")}
            label="Clipboard History"
            icon={<AppWindow size={16} />}
          />
          <NavItem
            active={activeTab === "templates"}
            onClick={() => setActiveTab("templates")}
            label="Smart Templates"
            icon={<Layers size={16} />}
          />
          <NavItem
            active={activeTab === "ai"}
            onClick={() => setActiveTab("ai")}
            label="AI Reformat"
            icon={<Sparkles size={16} />}
          />
          <NavItem
            active={activeTab === "help"}
            onClick={() => setActiveTab("help")}
            label="Help & Guide"
            icon={<BookOpen size={16} />}
          />
        </nav>

        <div className="p-4 pb-2">
          <NavItem
            active={activeTab === "settings"}
            onClick={() => setActiveTab("settings")}
            label="Preferences"
            icon={<SettingsIcon size={16} />}
          />
        </div>

        {/* Privacy badge */}
        <button
          onClick={() => setActiveTab("settings")}
          className="mx-4 mb-4 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/50 dark:border-emerald-700/30 hover:border-emerald-300 dark:hover:border-emerald-600/50 transition-colors group"
        >
          <ShieldCheck size={13} className="text-emerald-500 shrink-0" />
          <div className="text-left min-w-0">
            <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 leading-tight">
              100% Local & Private
            </p>
            <p className="text-[9px] text-emerald-600/60 dark:text-emerald-500/60 leading-tight truncate">
              No tracking · No cloud
            </p>
          </div>
        </button>
      </aside>

      {/* Content Area */}
      <main className="flex-1 overflow-hidden flex flex-col relative bg-white dark:bg-[#1a1a1a]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="flex-1 overflow-hidden flex flex-col"
          >
            {activeTab === "history" && <HistoryList />}
            {activeTab === "templates" && <TemplateManager />}
            {activeTab === "settings" && <GeneralSettings />}
            {activeTab === "help" && <HelpGuide />}
            {activeTab === "ai" && (
              <EmptyState
                tab={activeTab}
                icon={<Sparkles size={48} />}
                title="AI Reformat"
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function NavItem({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-[9px] rounded-[10px] text-[13px] 
        transition-all duration-200 flex items-center gap-2.5 relative group
        ${
          active
            ? "bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold"
            : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50"
        }`}
    >
      {active && (
        <motion.div
          layoutId="sidebar-active"
          className="absolute left-[3px] top-[15%] bottom-[15%] w-[3px] bg-blue-600 dark:bg-blue-400 rounded-full"
        />
      )}
      <span
        className={`${active ? "text-blue-600 dark:text-blue-400" : "text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300"} transition-colors`}
      >
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      {active && <ChevronRight size={12} className="opacity-40" />}
    </button>
  );
}

function EmptyState({
  icon,
  title,
  tab,
}: {
  icon: React.ReactNode;
  title: string;
  tab: string;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
      <div className="w-20 h-20 bg-zinc-50 dark:bg-zinc-900 rounded-[22px] flex items-center justify-center text-blue-500 shadow-xl shadow-black/5 mb-6 border border-zinc-200 dark:border-zinc-800">
        {icon}
      </div>
      <h2 className="text-xl font-bold tracking-tight font-display mb-1">
        {title}
      </h2>
      <p className="text-zinc-400 dark:text-zinc-500 text-sm max-w-[240px] mx-auto leading-relaxed">
        This module is currently being optimized for macOS performance.
      </p>
      <div className="mt-8 flex items-center gap-2 group cursor-default">
        <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">
          Planned for
        </span>
        <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 rounded text-[9px] font-bold border border-blue-500/20">
          PHASE {tab === "templates" ? "4" : tab === "ai" ? "5" : "7"}
        </span>
      </div>
    </div>
  );
}
