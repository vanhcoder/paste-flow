import { invoke } from "@tauri-apps/api/core";

// ══════════════════════════════════════════
// Types
// ══════════════════════════════════════════

export interface ClipboardItem {
  id: string;
  content_type: string;
  content_text: string | null;
  content_preview: string | null;
  source_app: string | null;
  byte_size: number;
  is_pinned: boolean;
  is_favorite: boolean;
  use_count: number;
  created_at: string;
}

export interface Template {
  id: string;
  group_id: string | null;
  title: string;
  content: string;
  shortcut: string | null;
  variables: string; // JSON string
  use_count: number;
  created_at: string;
}

export interface TemplateGroup {
  id: string;
  name: string;
  icon: string;
  color: string;
  sort_order: number;
}

export interface SearchResult {
  id: string;
  result_type: "history" | "template";
  title: string;
  preview: string;
  score: number;
  group_name: string | null;
}

export interface QueueItem {
  content: string;
  index: number;
  preview: string;
  collected_at: string;
}

export type QueueMode = "Off" | "Collecting" | "Pasting";

export interface QueueStatus {
  mode: QueueMode;
  total: number;
  remaining: number;
  all_items: QueueItem[];
  next_preview: string | null;
}

export interface QueueProgress {
  pasted_index: number;
  remaining: number;
  total: number;
}

// ══════════════════════════════════════════
// API — Type-safe invoke wrappers
// ══════════════════════════════════════════

export const api = {
  // ── Clipboard History ──
  getRecentItems: (limit?: number) =>
    invoke<ClipboardItem[]>("get_recent_items", { limit }),

  getClipContent: (id: string) =>
    invoke<string>("get_clip_content", { id }),

  pinItem: (id: string, pinned: boolean) =>
    invoke<void>("pin_item", { id, pinned }),

  deleteItem: (id: string) =>
    invoke<void>("delete_item", { id }),

  clearHistory: () =>
    invoke<number>("clear_history"),

  pasteToActiveApp: (content: string) =>
    invoke<void>("paste_to_active_app", { content }),

  // ── Templates ──
  listGroups: () =>
    invoke<TemplateGroup[]>("list_template_groups"),

  createGroup: (name: string, icon?: string, color?: string) =>
    invoke<TemplateGroup>("create_template_group", { name, icon, color }),

  listTemplates: (group_id?: string | null) =>
    invoke<Template[]>("list_templates", { payload: { group_id } }),

  createTemplate: (title: string, content: string, group_id?: string | null) =>
    invoke<Template>("create_template", { payload: { title, content, group_id } }),

  updateTemplate: (id: string, title?: string, content?: string, group_id?: string | null) =>
    invoke<void>("update_template", { payload: { id, title, content, group_id } }),

  getTemplate: (id: string) =>
    invoke<Template | null>("get_template", { id }),

  deleteTemplate: (id: string) =>
    invoke<void>("delete_template", { id }),

  // ── Search ──
  searchAll: (query: string, limit?: number) =>
    invoke<SearchResult[]>("search_all", { query, limit }),

  // ── System Settings ──
  getSetting: (key: string) =>
    invoke<string | null>("get_setting", { key }),

  setSetting: (key: string, value: string) =>
    invoke<void>("set_setting", { key, value }),

  // ── Paste Queue ──
  toggleQueueMode: () =>
    invoke<QueueMode>("toggle_queue_mode"),

  getQueueStatus: () =>
    invoke<QueueStatus>("get_queue_status"),

  queuePasteNext: () =>
    invoke<QueueItem | null>("queue_paste_next"),

  skipQueueItem: () =>
    invoke<void>("skip_queue_item"),

  cancelQueue: () =>
    invoke<void>("cancel_queue"),
};
