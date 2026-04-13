import { useEffect, useRef, useState } from "react";
import { useTemplateStore } from "../../stores/templateStore";
import {
  Plus, Hash, FolderPlus, Trash2, Edit3, Pin,
  ArrowLeft, Zap, Layers, ChevronRight, FileText,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api, Template } from "../../lib/tauri";
import { VariableModal } from "./VariableModal";
import { VariableHelper } from "./VariableHelper";
import {
  resolveBuiltins, parseVariableMeta,
  substituteVariables, hasBuiltinVariables,
} from "../../lib/variables";

// ── Main ──────────────────────────────────────────────────────────────────────

export function TemplateManager() {
  const {
    groups, templates, loadGroups,
    setSelectedGroup, selectedGroupId,
    addTemplate, removeTemplate, addGroup, pinTemplate,
  } = useTemplateStore();

  // view: "list" | "editor"
  const [view, setView] = useState<"list" | "editor">("list");
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [editorGroupId, setEditorGroupId] = useState<string | null>(null);
  const [expandingTemplate, setExpandingTemplate] = useState<Template | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { loadGroups(); setSelectedGroup(null); }, []);

  // ── Editor open/close ───────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingTemplate(null);
    setNewTitle("");
    setNewContent("");
    setEditorGroupId(selectedGroupId);
    setView("editor");
  };

  const openEdit = (tpl: Template) => {
    setEditingTemplate(tpl);
    setNewTitle(tpl.title);
    setNewContent(tpl.content);
    setEditorGroupId(tpl.group_id ?? null);
    setView("editor");
  };

  const closeEditor = () => {
    setView("list");
    setEditingTemplate(null);
    setNewTitle("");
    setNewContent("");
    setEditorGroupId(null);
  };

  const handleInsertSnippet = (snippet: string) => {
    const el = textareaRef.current;
    if (!el) { setNewContent(p => p + snippet); return; }
    const start = el.selectionStart ?? newContent.length;
    const end   = el.selectionEnd   ?? newContent.length;
    const next  = newContent.slice(0, start) + snippet + newContent.slice(end);
    setNewContent(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + snippet.length, start + snippet.length);
    });
  };

  // ── CRUD ────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    try {
      if (editingTemplate) {
        await api.updateTemplate(
          editingTemplate.id, newTitle.trim(), newContent.trim(), editorGroupId,
        );
        useTemplateStore.getState().loadTemplates(selectedGroupId);
      } else {
        await addTemplate(newTitle.trim(), newContent.trim(), editorGroupId);
      }
      closeEditor();
    } catch (e) { alert("Failed: " + e); }
  };

  // ── Paste ───────────────────────────────────────────────────────────────────

  const handleUse = async (tpl: Template) => {
    const vars = parseVariableMeta(tpl.variables);
    if (vars.length > 0 || hasBuiltinVariables(tpl.content)) {
      setExpandingTemplate(tpl);
    } else {
      await api.pasteToActiveApp(tpl.content);
      await api.incrementTemplateUseCount(tpl.id).catch(() => {});
    }
  };

  const handleConfirmExpansion = async (values: Record<string, string>) => {
    if (!expandingTemplate) return;
    let content = expandingTemplate.content;
    if (hasBuiltinVariables(content)) content = resolveBuiltins(content);
    const meta = parseVariableMeta(expandingTemplate.variables);
    const finalContent = substituteVariables(content, values, meta);
    await api.pasteToActiveApp(finalContent);
    await api.incrementTemplateUseCount(expandingTemplate.id).catch(() => {});
    const entries = Object.entries(values)
      .filter(([, v]) => v)
      .map(([name, value]) => ({ name, value }));
    if (entries.length > 0)
      await api.saveVariableValues(expandingTemplate.id, entries).catch(() => {});
    setExpandingTemplate(null);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full bg-white dark:bg-[#1a1a1a] overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className="w-52 shrink-0 flex flex-col border-r border-zinc-200/40 dark:border-zinc-800/40">
        <div className="px-4 pt-5 pb-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">
            Collections
          </p>
          <SidebarItem
            active={selectedGroupId === null}
            onClick={() => setSelectedGroup(null)}
            icon={<Hash size={13} />}
            label="All Snippets"
          />
        </div>

        {groups.length > 0 && (
          <div className="px-4 flex-1 overflow-y-auto hide-scrollbar">
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-300 dark:text-zinc-600 mb-2">
              Groups
            </p>
            <nav className="space-y-0.5">
              {groups.map(g => (
                <SidebarItem
                  key={g.id}
                  active={selectedGroupId === g.id}
                  onClick={() => setSelectedGroup(g.id)}
                  icon={<span className="text-sm leading-none">{g.icon}</span>}
                  label={g.name}
                  color={g.color}
                />
              ))}
            </nav>
          </div>
        )}

        <div className="mt-auto p-3 border-t border-zinc-200/40 dark:border-zinc-800/40">
          <button
            onClick={() => { const n = prompt("Collection name:"); if (n) addGroup(n); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <FolderPlus size={13} /> New Collection
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 min-w-0 relative overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>

          {/* ══ LIST VIEW ════════════════════════════════════════════════════ */}
          {view === "list" && (
            <motion.div
              key="list"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute inset-0 flex flex-col"
            >
              {/* List header */}
              <div className="px-7 py-5 flex items-center justify-between border-b border-zinc-200/40 dark:border-zinc-800/40 shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    {selectedGroupId && (
                      <span className="text-xl leading-none">
                        {groups.find(g => g.id === selectedGroupId)?.icon}
                      </span>
                    )}
                    <h2 className="text-[17px] font-bold text-zinc-900 dark:text-white">
                      {groups.find(g => g.id === selectedGroupId)?.name || "All Snippets"}
                    </h2>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    {templates.length} template{templates.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <button
                  onClick={openCreate}
                  className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl text-[13px] font-bold shadow-lg shadow-black/10 hover:scale-[1.02] active:scale-[0.98] transition-transform"
                >
                  <Plus size={14} /> New Template
                </button>
              </div>

              {/* Template list */}
              <div className="flex-1 overflow-y-auto hide-scrollbar px-5 py-4">
                {templates.length === 0 ? (
                  <EmptyState onNew={openCreate} />
                ) : (
                  <div className="grid gap-3">
                    {templates.map(tpl => (
                      <TemplateCard
                        key={tpl.id}
                        tpl={tpl}
                        group={groups.find(g => g.id === tpl.group_id)}
                        showGroup={!selectedGroupId}
                        onUse={() => handleUse(tpl)}
                        onEdit={() => openEdit(tpl)}
                        onPin={() => pinTemplate(tpl.id, !tpl.is_pinned)}
                        onDelete={() => removeTemplate(tpl.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ══ EDITOR VIEW ══════════════════════════════════════════════════ */}
          {view === "editor" && (
            <motion.div
              key="editor"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute inset-0 flex flex-col"
            >
              {/* Editor header */}
              <div className="px-7 py-4 flex items-center gap-4 border-b border-zinc-200/40 dark:border-zinc-800/40 shrink-0">
                <button
                  onClick={closeEditor}
                  className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                >
                  <ArrowLeft size={16} />
                  <span className="text-[12px] font-semibold">Back</span>
                </button>
                <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
                <div>
                  <p className="text-[16px] font-bold text-zinc-900 dark:text-white leading-tight">
                    {editingTemplate ? "Edit Template" : "New Template"}
                  </p>
                </div>
              </div>

              {/* Editor body — scrollable */}
              <div className="flex-1 overflow-y-auto hide-scrollbar">
                <div className="max-w-2xl mx-auto px-7 py-6 space-y-6">

                  {/* Title */}
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-2 block">
                      Title
                    </label>
                    <input
                      autoFocus
                      placeholder="e.g. Email greeting, Support response..."
                      className="w-full bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-[15px] font-bold text-zinc-900 dark:text-white placeholder:font-normal placeholder:text-zinc-300 dark:placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500 transition-all"
                      value={newTitle}
                      onChange={e => setNewTitle(e.target.value)}
                    />
                  </div>

                  {/* Content */}
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-2 block">
                      Content
                    </label>
                    <textarea
                      ref={textareaRef}
                      placeholder={"Write your template content here...\n\nTip: Use {{name}} for user-filled fields.\nUse {{TODAY}} to auto-insert today's date."}
                      className="w-full min-h-[240px] bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-[14px] text-zinc-700 dark:text-zinc-300 placeholder:text-zinc-300 dark:placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500 resize-y leading-relaxed transition-all font-mono"
                      value={newContent}
                      onChange={e => setNewContent(e.target.value)}
                    />
                  </div>

                  {/* Variable Helper */}
                  <div className="bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl p-4 border border-zinc-200/60 dark:border-zinc-700/40">
                    <VariableHelper content={newContent} onInsert={handleInsertSnippet} />
                  </div>

                  {/* Collection */}
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-2 block">
                      Collection
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <CollectionChip
                        label="No Group"
                        icon={<Hash size={11} />}
                        active={editorGroupId === null}
                        onClick={() => setEditorGroupId(null)}
                      />
                      {groups.map(g => (
                        <CollectionChip
                          key={g.id}
                          label={g.name}
                          icon={<span className="text-sm leading-none">{g.icon}</span>}
                          active={editorGroupId === g.id}
                          onClick={() => setEditorGroupId(g.id)}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Bottom spacer so footer doesn't overlap */}
                  <div className="h-4" />
                </div>
              </div>

              {/* Editor footer */}
              <div className="shrink-0 px-7 py-4 border-t border-zinc-200/40 dark:border-zinc-800/40 flex items-center justify-end gap-3 bg-white/80 dark:bg-[#1a1a1a]/80 backdrop-blur-sm">
                <button
                  onClick={closeEditor}
                  className="px-5 py-2.5 text-[13px] font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!newTitle.trim() || !newContent.trim()}
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-[13px] font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 active:scale-[0.98] transition-all"
                >
                  <Zap size={14} className="fill-current" />
                  {editingTemplate ? "Update Template" : "Save Template"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Variable fill modal */}
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

// ── Template Card ─────────────────────────────────────────────────────────────

interface CardProps {
  tpl: Template;
  group?: { name: string; icon: string; color: string };
  showGroup: boolean;
  onUse: () => void;
  onEdit: () => void;
  onPin: () => void;
  onDelete: () => void;
}

function TemplateCard({ tpl, group, showGroup, onUse, onEdit, onPin, onDelete }: CardProps) {
  const vars = parseVariableMeta(tpl.variables);
  const hasVars = vars.length > 0 || hasBuiltinVariables(tpl.content);

  return (
    <div className="group relative bg-white dark:bg-zinc-900/30 border border-zinc-200/70 dark:border-zinc-800/70 rounded-2xl hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm transition-all">
      <div className="flex items-start gap-4 p-5">

        {/* Icon */}
        <div className="shrink-0 w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mt-0.5">
          {hasVars
            ? <Zap size={16} className="text-blue-500 fill-current" />
            : <FileText size={16} className="text-zinc-400" />
          }
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onUse}>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-[14px] font-bold text-zinc-900 dark:text-white truncate">
              {tpl.title}
            </h3>
            {tpl.is_pinned && (
              <Pin size={11} className="shrink-0 text-blue-500 fill-current" />
            )}
            {showGroup && group && (
              <span className="shrink-0 text-[9px] font-bold text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full uppercase tracking-wide">
                {group.icon} {group.name}
              </span>
            )}
          </div>

          <p className="text-[13px] text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-2 mb-2">
            {tpl.content}
          </p>

          <div className="flex items-center flex-wrap gap-1.5">
            {vars.slice(0, 5).map(v => (
              <span
                key={v.name}
                className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-md text-[10px] font-bold border border-blue-100 dark:border-blue-800/30"
              >
                {v.name}{v.type !== "text" ? `:${v.type}` : ""}
              </span>
            ))}
            {vars.length > 5 && (
              <span className="text-[10px] text-zinc-400">+{vars.length - 5} more</span>
            )}
            {tpl.use_count > 0 && (
              <span className="ml-auto text-[10px] text-zinc-300 dark:text-zinc-600">
                Used {tpl.use_count}×
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={e => { e.stopPropagation(); onPin(); }}
            className={`p-2 rounded-lg transition-colors ${
              tpl.is_pinned
                ? "text-blue-500 bg-blue-50 dark:bg-blue-900/30"
                : "text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
            title={tpl.is_pinned ? "Unpin" : "Pin"}
          >
            <Pin size={14} fill={tpl.is_pinned ? "currentColor" : "none"} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onEdit(); }}
            className="p-2 rounded-lg text-zinc-300 dark:text-zinc-600 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
            title="Edit"
          >
            <Edit3 size={14} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            className="p-2 rounded-lg text-zinc-300 dark:text-zinc-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Collection Chip ───────────────────────────────────────────────────────────

function CollectionChip({
  label, icon, active, onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-all ${
        active
          ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-transparent shadow-sm"
          : "text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-200"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center py-20 text-zinc-400">
      <Layers size={44} strokeWidth={1} className="mb-4 opacity-20" />
      <p className="text-[14px] font-semibold opacity-60 mb-1">No templates yet</p>
      <p className="text-[12px] opacity-40 text-center mb-5 max-w-xs">
        Create reusable snippets with variables, auto-dates, and formatted numbers
      </p>
      <button
        onClick={onNew}
        className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl text-[13px] font-bold shadow-lg shadow-black/10 hover:scale-[1.02] transition-transform"
      >
        <Plus size={14} /> Create first template
      </button>
    </div>
  );
}

// ── Sidebar Item ──────────────────────────────────────────────────────────────

function SidebarItem({
  icon, label, active, onClick, color,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-xl text-[13px] transition-all duration-150 flex items-center gap-2.5 ${
        active
          ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold shadow-sm"
          : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
      }`}
    >
      <span className="shrink-0" style={{ color: !active && color ? color : undefined }}>
        {icon}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {!active && (
        <ChevronRight size={11} className="opacity-0 group-hover:opacity-30 text-zinc-400" />
      )}
    </button>
  );
}
