import { useEffect, useState } from "react";
import { useTemplateStore } from "../../stores/templateStore";
import { Plus, Hash, FolderPlus, Trash2, Move, ChevronRight, Folder, Edit3 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api, Template } from "../../lib/tauri";
import { VariableModal } from "./VariableModal";

export function TemplateManager() {
  const { groups, templates, loadGroups, setSelectedGroup, selectedGroupId, addTemplate, removeTemplate, addGroup, moveTemplate } = useTemplateStore();
  const [isAdding, setIsAdding] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [showMoveMenu, setShowMoveMenu] = useState<string | null>(null);
  const [expandingTemplate, setExpandingTemplate] = useState<Template | null>(null);

  useEffect(() => {
    loadGroups();
    setSelectedGroup(null);
  }, []);

  const handleCreate = async () => {
    if (!newTitle || !newContent) return;
    try {
      await addTemplate(newTitle, newContent, selectedGroupId || null);
      setNewTitle("");
      setNewContent("");
      setIsAdding(false);
    } catch (e) {
      alert("Failed to save template: " + e);
    }
  };

  const handleUpdate = async () => {
    if (!editingTemplate || !newTitle || !newContent) return;
    try {
      await api.updateTemplate(editingTemplate.id, newTitle, newContent, editingTemplate.group_id);
      useTemplateStore.getState().loadTemplates(selectedGroupId);
      setEditingTemplate(null);
      setNewTitle("");
      setNewContent("");
    } catch (e) {
      alert("Failed to update: " + e);
    }
  };

  const handleTemplateClick = (tpl: Template) => {
    let vars: string[] = [];
    try {
      vars = typeof tpl.variables === "string" ? JSON.parse(tpl.variables) : tpl.variables;
    } catch (e) {
      console.error("Error parsing variables:", e);
    }

    if (vars && vars.length > 0) {
      setExpandingTemplate(tpl);
    } else {
      api.pasteToActiveApp(tpl.content);
    }
  };

  const handleConfirmExpansion = (values: Record<string, string>) => {
    if (!expandingTemplate) return;
    let finalContent = expandingTemplate.content;

    // Replace all {{var}} with values
    Object.entries(values).forEach(([key, val]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
      finalContent = finalContent.replace(regex, val || `{{${key}}}`);
    });

    api.pasteToActiveApp(finalContent);
    setExpandingTemplate(null);
  };

  return (
    <div className="flex h-full bg-white dark:bg-[#1a1a1a] overflow-hidden">
      {/* Groups Sidebar Inline */}
      <div className="w-60 border-r border-zinc-200/40 dark:border-zinc-800/40 flex flex-col bg-zinc-50/50 dark:bg-zinc-900/20">
        <div className="p-5 flex items-center justify-between">
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-[0.1em]">Collections</span>
          <button
            onClick={() => {
              const name = prompt("Enter group name:");
              if (name) addGroup(name);
            }}
            className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-md text-zinc-400 transition-colors"
          >
            <FolderPlus size={14} />
          </button>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          <GroupItem
            active={selectedGroupId === null}
            onClick={() => setSelectedGroup(null)}
            icon={<Hash size={15} />}
            label="All Snippets"
          />
          <div className="py-2 border-t border-zinc-200/40 dark:border-zinc-800/40 mt-2" />
          {groups.map(group => (
            <GroupItem
              key={group.id}
              active={selectedGroupId === group.id}
              onClick={() => setSelectedGroup(group.id)}
              icon={<span className="text-sm">{group.icon}</span>}
              label={group.name}
              color={group.color}
            />
          ))}
        </nav>
      </div>

      {/* Templates List Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="px-8 py-6 flex items-center justify-between border-b border-zinc-200/40 dark:border-zinc-800/40">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {selectedGroupId && <span className="text-xl">{groups.find(g => g.id === selectedGroupId)?.icon}</span>}
              <h2 className="text-[18px] font-bold tracking-tight font-display">
                {groups.find(g => g.id === selectedGroupId)?.name || "All Snippets"}
              </h2>
            </div>
            <p className="text-[11px] text-zinc-500 font-medium">{templates.length} reusable templates available</p>
          </div>
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl text-[13px] font-bold shadow-xl shadow-black/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus size={16} /> Create New
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4 hide-scrollbar">
          <AnimatePresence>
            {(isAdding || editingTemplate) && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className="p-5 bg-zinc-50 dark:bg-zinc-800/30 rounded-2xl border-2 border-blue-500/20 mb-6 shadow-sm"
              >
                <input
                  autoFocus
                  placeholder="Snippet Title..."
                  className="w-full bg-transparent border-none outline-none text-base font-bold placeholder:text-zinc-400 mb-3 text-zinc-900 dark:text-white"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                />
                <textarea
                  placeholder="Paste your content here... Use {{variable}} for dynamic parts."
                  className="w-full bg-transparent border-none outline-none text-[14px] text-zinc-600 dark:text-zinc-400 min-h-[100px] resize-none pb-4 leading-relaxed"
                  value={newContent}
                  onChange={e => setNewContent(e.target.value)}
                />
                <div className="flex items-center justify-between border-t border-zinc-200/60 dark:border-zinc-700/60 pt-4">
                  <div className="flex items-center gap-2 text-[11px] font-bold px-3 py-1 bg-zinc-200/50 dark:bg-zinc-700/50 rounded-full text-zinc-500 uppercase tracking-tight">
                    <Folder size={10} /> {editingTemplate ? (groups.find(g => g.id === editingTemplate.group_id)?.name || "No Classification") : (groups.find(g => g.id === selectedGroupId)?.name || "No Classification")}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setIsAdding(false); setEditingTemplate(null); setNewTitle(""); setNewContent(""); }}
                      className="px-4 py-2 text-[13px] font-bold text-zinc-500 hover:text-zinc-800"
                    >
                      Discard
                    </button>
                    <button
                      onClick={editingTemplate ? handleUpdate : handleCreate}
                      className="px-5 py-2 bg-blue-600 text-white rounded-lg text-[13px] font-bold shadow-lg shadow-blue-500/20"
                    >
                      {editingTemplate ? "Update Snippet" : "Save Snapshot"}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {templates.length === 0 && !isAdding && (
              <div className="h-64 flex flex-col items-center justify-center text-zinc-400 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl">
                <Hash size={40} strokeWidth={1} className="mb-4 opacity-20" />
                <p className="text-[13px] font-medium opacity-60">No templates in this collection</p>
              </div>
            )}

            {templates.map(tpl => {
              const group = groups.find(g => g.id === tpl.group_id);
              return (
                <motion.div
                  layout
                  key={tpl.id}
                  className="group p-5 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/20 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-md transition-all relative"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0 pr-12 cursor-pointer" onClick={() => handleTemplateClick(tpl)}>
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-[14px] font-bold text-zinc-900 dark:text-white">{tpl.title}</h3>
                        {!selectedGroupId && group && (
                          <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-[9px] font-bold text-zinc-400 uppercase tracking-tighter">
                            {group.name}
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] text-zinc-500 line-clamp-2 leading-relaxed font-medium mb-3">{tpl.content}</p>

                      {JSON.parse(tpl.variables).length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {JSON.parse(tpl.variables).map((v: string) => (
                            <span key={v} className="px-2 py-0.5 bg-blue-50/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-md text-[10px] font-bold border border-blue-200/30 dark:border-blue-500/10">
                              {v}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingTemplate(tpl);
                            setNewTitle(tpl.title);
                            setNewContent(tpl.content);
                            setIsAdding(false);
                          }}
                          className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-blue-500 transition-colors rounded-lg"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowMoveMenu(showMoveMenu === tpl.id ? null : tpl.id); }}
                          className={`p-2 rounded-lg transition-colors ${showMoveMenu === tpl.id ? "bg-blue-100 text-blue-600" : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400"}`}
                        >
                          <Move size={14} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); removeTemplate(tpl.id); }} className="p-2 hover:bg-red-500/10 rounded-lg text-zinc-400 hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {/* Move to Group Mini Menu */}
                      <AnimatePresence>
                        {showMoveMenu === tpl.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                            className="absolute top-14 right-5 z-10 w-48 p-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-2xl"
                          >
                            <p className="px-2 pt-1 pb-2 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-center border-b border-zinc-100 dark:border-zinc-700 mb-1">Move to collection</p>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await moveTemplate(tpl.id, null);
                                  setShowMoveMenu(null);
                                } catch (err) {
                                  alert("Move failed: " + err);
                                }
                              }}
                              className="w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md flex items-center gap-2"
                            >
                              <Hash size={12} /> No Group
                            </button>
                            {groups.map(g => (
                              <button
                                key={g.id}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    await moveTemplate(tpl.id, g.id);
                                    setShowMoveMenu(null);
                                  } catch (err) {
                                    alert("Move failed: " + err);
                                  }
                                }}
                                className="w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md flex items-center gap-2"
                              >
                                <span>{g.icon}</span> {g.name}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
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

function GroupItem({ icon, label, active, onClick, color }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void, color?: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-2 rounded-xl text-[13.5px] 
        transition-all duration-200 flex items-center gap-3 relative group
        ${active
          ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold shadow-md shadow-black/5"
          : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50"
        }`}
    >
      <span className={active ? "text-white dark:text-zinc-900" : "text-zinc-400"} style={{ color: !active && color ? color : undefined }}>
        {icon}
      </span>
      <span className="truncate">{label}</span>
      {!active && <ChevronRight size={12} className="ml-auto opacity-0 group-hover:opacity-40 transition-opacity" />}
    </button>
  );
}
