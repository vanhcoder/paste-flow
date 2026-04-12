# PasteFlow — Implementation Plan: Setup → Code → Release

---

## PHASE 0: Cài đặt môi trường (Ngày 1)

### 0.1 Prerequisites

```bash
# ══════════════════════════════════════════
#  macOS
# ══════════════════════════════════════════

# 1. Xcode Command Line Tools
xargs -select-install

# 2. Homebrew (nếu chưa có)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 3. Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
rustc --version    # Cần >= 1.77.0

# 4. Node.js (dùng nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.zshrc
nvm install 20
node --version     # Cần >= 18

# 5. Tauri system dependencies (macOS không cần thêm gì)
```

```bash
# ══════════════════════════════════════════
#  Windows
# ══════════════════════════════════════════

# 1. Visual Studio Build Tools 2022
#    Download: https://visualstudio.microsoft.com/visual-cpp-build-tools/
#    Chọn: "Desktop development with C++"
#    Tick thêm: "Windows 10/11 SDK"

# 2. Rust
#    Download: https://win.rustup.rs/x86_64
#    Chạy installer → chọn default

# 3. Node.js
#    Download: https://nodejs.org/ (LTS version)

# 4. WebView2 (Windows 10+ đã có sẵn, nếu chưa):
#    https://developer.microsoft.com/en-us/microsoft-edge/webview2/

# Verify:
rustc --version
node --version
npm --version
```

### 0.2 Setup IDE

```bash
# VS Code extensions cần thiết:
code --install-extension rust-lang.rust-analyzer
code --install-extension tauri-apps.tauri-vscode
code --install-extension bradlc.vscode-tailwindcss
code --install-extension dbaeumer.vscode-eslint

# Tạo VS Code settings cho project:
# .vscode/settings.json sẽ được tạo ở bước sau
```

---

## PHASE 1: Khởi tạo project (Ngày 1-2)

### 1.1 Tạo Tauri app

```bash
# Tạo project
npm create tauri-app@latest pasteflow -- --template react-ts

cd pasteflow

# Verify chạy được
npm install
npm run tauri dev
# → Nếu thấy cửa sổ Tauri mở = OK. Ctrl+C để dừng.
```

### 1.2 Cài dependencies

```bash
# ── Frontend ──
npm install zustand lucide-react cmdk
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# ── Rust (trong src-tauri/) ──
cd src-tauri

# Core plugins
cargo add tauri-plugin-clipboard-manager
cargo add tauri-plugin-global-shortcut
cargo add tauri-plugin-autostart
cargo add tauri-plugin-fs

# Utilities
cargo add arboard@3            # Clipboard read/write
cargo add rusqlite --features bundled
cargo add reqwest --features json
cargo add tokio --features full
cargo add serde --features derive
cargo add serde_json
cargo add uuid --features v4
cargo add chrono --features serde
cargo add open@5

cd ..
```

### 1.3 Setup Tailwind CSS

```bash
# tailwind.config.js
cat > tailwind.config.js << 'EOF'
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{js,ts,jsx,tsx}", "./index.html"],
  darkMode: "media",
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter", "-apple-system", "BlinkMacSystemFont",
          "Segoe UI", "sans-serif"
        ],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
    },
  },
  plugins: [],
};
EOF
```

```css
/* src/styles/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100;
    font-family:
      "Inter",
      -apple-system,
      BlinkMacSystemFont,
      sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  /* Ẩn scrollbar cho popup (cleaner look) */
  .hide-scrollbar::-webkit-scrollbar {
    display: none;
  }
}
```

### 1.4 Cấu trúc thư mục

```bash
# Tạo toàn bộ folder structure
mkdir -p src/{windows,stores,components/{History,Templates,QuickPaste,AI,Settings,shared},lib,styles}
mkdir -p src-tauri/src/{clipboard,templates,ai,search,system}

# Tạo file stubs
touch src/windows/{MainWindow,QuickPaste}.tsx
touch src/stores/{clipboardStore,templateStore,searchStore,settingsStore}.ts
touch src/lib/{tauri,constants}.ts
touch src-tauri/src/db.rs
touch src-tauri/src/{clipboard,templates,ai,search,system}/mod.rs

# Quick paste entry point
cp index.html src/quick-paste.html
```

### 1.5 Tauri Config

```bash
cat > src-tauri/tauri.conf.json << 'TAURICONF'
{
  "$schema": "https://raw.githubusercontent.com/tauri-apps/tauri/dev/crates/tauri-config-schema/schema.json",
  "productName": "PasteFlow",
  "version": "0.1.0",
  "identifier": "com.pasteflow.app",
  "build": {
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "PasteFlow",
        "width": 900,
        "height": 640,
        "minWidth": 640,
        "minHeight": 480,
        "center": true,
        "decorations": true,
        "resizable": true,
        "visible": true
      }
    ],
    "trayIcon": {
      "iconPath": "icons/icon.png",
      "iconAsTemplate": true,
      "tooltip": "PasteFlow"
    },
    "security": {
      "csp": "default-src 'self'; connect-src 'self' https://api.openai.com https://api.anthropic.com; style-src 'self' 'unsafe-inline'"
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
TAURICONF
```

### 1.6 Tauri Capabilities (Permissions)

```bash
cat > src-tauri/capabilities/default.json << 'CAP'
{
  "$schema": "https://raw.githubusercontent.com/nickkadutskyi/jb-tauri-plugin/main/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "PasteFlow permissions",
  "windows": ["main", "quick-paste"],
  "permissions": [
    "core:default",
    "core:event:default",
    "core:window:default",
    "core:window:allow-show",
    "core:window:allow-hide",
    "core:window:allow-set-focus",
    "core:window:allow-center",
    "core:window:allow-is-visible",
    "shell:allow-open",
    "global-shortcut:allow-register",
    "global-shortcut:allow-unregister",
    "global-shortcut:allow-is-registered",
    "clipboard-manager:allow-read-text",
    "clipboard-manager:allow-write-text",
    "clipboard-manager:allow-read-image",
    "clipboard-manager:allow-write-image",
    "fs:allow-read",
    "fs:allow-write",
    "fs:allow-exists",
    "fs:allow-mkdir",
    "autostart:allow-enable",
    "autostart:allow-disable",
    "autostart:allow-is-enabled"
  ]
}
CAP
```

### 1.7 Verify setup chạy OK

```bash
npm run tauri dev
# ✅ Cửa sổ PasteFlow mở = setup thành công
# ✅ Console không có Rust compile error
# ✅ React dev server chạy ở localhost:1420
```

---

## PHASE 2: Tuần 1 — Clipboard Watcher + History (Core)

> Mục tiêu: App chạy background, tự động lưu mọi thứ user copy,
> hiển thị history list.

### 2.1 SQLite Database Setup

```rust
// src-tauri/src/db.rs

use rusqlite::Connection;
use std::sync::Mutex;
use tauri::AppHandle;
use tauri::Manager;

pub struct DbPool(pub Mutex<Connection>);

pub fn init_db(app: &AppHandle) -> DbPool {
    // Lưu DB trong app data directory (persistent qua updates)
    let app_dir = app
        .path()
        .app_data_dir()
        .expect("Failed to get app data dir");
    std::fs::create_dir_all(&app_dir).ok();

    let db_path = app_dir.join("pasteflow.db");
    let conn = Connection::open(db_path)
        .expect("Failed to open database");

    // Enable WAL mode cho performance
    conn.execute_batch("PRAGMA journal_mode=WAL;").ok();
    conn.execute_batch("PRAGMA foreign_keys=ON;").ok();

    // Run migrations
    run_migrations(&conn);

    DbPool(Mutex::new(conn))
}

fn run_migrations(conn: &Connection) {
    conn.execute_batch("
        CREATE TABLE IF NOT EXISTS clipboard_items (
            id            TEXT PRIMARY KEY,
            content_type  TEXT NOT NULL DEFAULT 'text',
            content_text  TEXT,
            content_preview TEXT,
            source_app    TEXT,
            byte_size     INTEGER DEFAULT 0,
            is_pinned     INTEGER DEFAULT 0,
            is_favorite   INTEGER DEFAULT 0,
            use_count     INTEGER DEFAULT 0,
            created_at    TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE INDEX IF NOT EXISTS idx_clip_created
            ON clipboard_items(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_clip_pinned
            ON clipboard_items(is_pinned) WHERE is_pinned = 1;

        CREATE TABLE IF NOT EXISTS template_groups (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            icon        TEXT DEFAULT '📁',
            color       TEXT DEFAULT '#3B82F6',
            sort_order  INTEGER DEFAULT 0,
            created_at  TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS templates (
            id            TEXT PRIMARY KEY,
            group_id      TEXT REFERENCES template_groups(id) ON DELETE SET NULL,
            title         TEXT NOT NULL,
            content       TEXT NOT NULL,
            shortcut      TEXT,
            tags          TEXT DEFAULT '[]',
            variables     TEXT DEFAULT '[]',
            use_count     INTEGER DEFAULT 0,
            created_at    TEXT DEFAULT (datetime('now','localtime')),
            updated_at    TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE INDEX IF NOT EXISTS idx_tpl_group
            ON templates(group_id);

        CREATE TABLE IF NOT EXISTS reformat_history (
            id              TEXT PRIMARY KEY,
            original_text   TEXT NOT NULL,
            platform        TEXT NOT NULL,
            reformatted     TEXT NOT NULL,
            model_used      TEXT DEFAULT 'gpt-4o-mini',
            tokens_used     INTEGER DEFAULT 0,
            created_at      TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS settings (
            key     TEXT PRIMARY KEY,
            value   TEXT NOT NULL
        );

        INSERT OR IGNORE INTO settings (key, value) VALUES
            ('max_history_items', '5000'),
            ('clipboard_poll_ms', '500'),
            ('hotkey_quick_paste', 'CmdOrCtrl+Shift+V'),
            ('ai_provider', 'openai'),
            ('ai_api_key', ''),
            ('ai_model', 'gpt-4o-mini'),
            ('theme', 'system');
    ").expect("Failed to run migrations");
}
```

### 2.2 Clipboard Watcher

```rust
// src-tauri/src/clipboard/mod.rs
pub mod watcher;
pub mod history;
pub mod paste;

// src-tauri/src/clipboard/watcher.rs

use arboard::Clipboard;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use crate::db::DbPool;

pub struct ClipboardWatcher {
    running: Arc<Mutex<bool>>,
}

impl ClipboardWatcher {
    pub fn new() -> Self {
        Self {
            running: Arc::new(Mutex::new(false)),
        }
    }

    pub fn start(&self, app: AppHandle, db: Arc<DbPool>) {
        let running = self.running.clone();
        *running.lock().unwrap() = true;

        thread::spawn(move || {
            let mut clipboard = match Clipboard::new() {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("Clipboard init failed: {}", e);
                    return;
                }
            };

            let mut last_text = String::new();
            let poll_ms = 500;

            while *running.lock().unwrap() {
                if let Ok(current) = clipboard.get_text() {
                    if !current.is_empty()
                        && current != last_text
                        && current.len() < 1_000_000  // Skip nếu quá lớn (>1MB)
                    {
                        last_text = current.clone();

                        let preview: String = current
                            .chars()
                            .take(200)
                            .collect();

                        let id = uuid::Uuid::new_v4().to_string();
                        let byte_size = current.len() as i64;

                        // Lưu vào DB
                        let db_lock = db.0.lock().unwrap();
                        let _ = db_lock.execute(
                            "INSERT INTO clipboard_items
                             (id, content_type, content_text, content_preview,
                              source_app, byte_size)
                             VALUES (?1, 'text', ?2, ?3, ?4, ?5)",
                            rusqlite::params![
                                id,
                                current,
                                preview,
                                Option::<String>::None, // source_app (TODO)
                                byte_size,
                            ],
                        );
                        drop(db_lock);

                        // Notify frontend
                        #[derive(serde::Serialize, Clone)]
                        struct ClipEvent {
                            id: String,
                            preview: String,
                            content_type: String,
                        }

                        let _ = app.emit("clipboard-changed", ClipEvent {
                            id,
                            preview,
                            content_type: "text".into(),
                        });
                    }
                }

                thread::sleep(Duration::from_millis(poll_ms));
            }
        });
    }

    pub fn stop(&self) {
        *self.running.lock().unwrap() = false;
    }
}
```

### 2.3 History Commands

```rust
// src-tauri/src/clipboard/history.rs

use serde::{Deserialize, Serialize};
use crate::db::DbPool;
use std::sync::Arc;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ClipboardItem {
    pub id: String,
    pub content_type: String,
    pub content_text: Option<String>,
    pub content_preview: Option<String>,
    pub source_app: Option<String>,
    pub byte_size: i64,
    pub is_pinned: bool,
    pub is_favorite: bool,
    pub use_count: i32,
    pub created_at: String,
}

#[tauri::command]
pub fn get_recent_items(
    db: tauri::State<'_, Arc<DbPool>>,
    limit: Option<i32>,
) -> Result<Vec<ClipboardItem>, String> {
    let limit = limit.unwrap_or(50);
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT id, content_type, NULL as content_text, content_preview,
                source_app, byte_size, is_pinned, is_favorite,
                use_count, created_at
         FROM clipboard_items
         ORDER BY is_pinned DESC, created_at DESC
         LIMIT ?1"
    ).map_err(|e| e.to_string())?;

    let items = stmt.query_map([limit], |row| {
        Ok(ClipboardItem {
            id: row.get(0)?,
            content_type: row.get(1)?,
            content_text: row.get(2)?,
            content_preview: row.get(3)?,
            source_app: row.get(4)?,
            byte_size: row.get(5)?,
            is_pinned: row.get(6)?,
            is_favorite: row.get(7)?,
            use_count: row.get(8)?,
            created_at: row.get(9)?,
        })
    }).map_err(|e| e.to_string())?;

    let result: Vec<ClipboardItem> = items
        .filter_map(|i| i.ok())
        .collect();

    Ok(result)
}

#[tauri::command]
pub fn get_clip_content(
    db: tauri::State<'_, Arc<DbPool>>,
    id: String,
) -> Result<String, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    // Tăng use_count
    conn.execute(
        "UPDATE clipboard_items SET use_count = use_count + 1 WHERE id = ?1",
        [&id],
    ).map_err(|e| e.to_string())?;

    let content: String = conn.query_row(
        "SELECT content_text FROM clipboard_items WHERE id = ?1",
        [&id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;

    Ok(content)
}

#[tauri::command]
pub fn pin_item(
    db: tauri::State<'_, Arc<DbPool>>,
    id: String,
    pinned: bool,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE clipboard_items SET is_pinned = ?1 WHERE id = ?2",
        rusqlite::params![pinned as i32, id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_item(
    db: tauri::State<'_, Arc<DbPool>>,
    id: String,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM clipboard_items WHERE id = ?1",
        [&id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn clear_history(
    db: tauri::State<'_, Arc<DbPool>>,
) -> Result<u64, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let deleted = conn.execute(
        "DELETE FROM clipboard_items WHERE is_pinned = 0",
        [],
    ).map_err(|e| e.to_string())?;
    Ok(deleted as u64)
}
```

### 2.4 Paste Engine

```rust
// src-tauri/src/clipboard/paste.rs

use arboard::Clipboard;
use std::thread;
use std::time::Duration;

#[tauri::command]
pub fn paste_to_active_app(content: String) -> Result<(), String> {
    // 1. Ghi vào system clipboard
    let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.set_text(&content).map_err(|e| e.to_string())?;

    // 2. Đợi nhẹ để OS sync clipboard
    thread::sleep(Duration::from_millis(50));

    // 3. Simulate Cmd+V / Ctrl+V
    simulate_paste_keystroke()?;

    Ok(())
}

#[cfg(target_os = "macos")]
fn simulate_paste_keystroke() -> Result<(), String> {
    use std::process::Command;
    Command::new("osascript")
        .arg("-e")
        .arg(r#"tell application "System Events" to keystroke "v" using command down"#)
        .output()
        .map_err(|e| format!("osascript failed: {}", e))?;
    Ok(())
}

#[cfg(target_os = "windows")]
fn simulate_paste_keystroke() -> Result<(), String> {
    use std::process::Command;
    Command::new("powershell")
        .arg("-Command")
        .arg(r#"
            Add-Type -AssemblyName System.Windows.Forms
            Start-Sleep -Milliseconds 100
            [System.Windows.Forms.SendKeys]::SendWait("^v")
        "#)
        .output()
        .map_err(|e| format!("powershell failed: {}", e))?;
    Ok(())
}

#[cfg(target_os = "linux")]
fn simulate_paste_keystroke() -> Result<(), String> {
    use std::process::Command;
    Command::new("xdotool")
        .args(["key", "ctrl+v"])
        .output()
        .map_err(|e| format!("xdotool failed: {}", e))?;
    Ok(())
}
```

### 2.5 Wire Everything in main.rs

```rust
// src-tauri/src/main.rs

mod db;
mod clipboard;

use clipboard::watcher::ClipboardWatcher;
use std::sync::Arc;
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            // ── Init DB ──
            let database = Arc::new(db::init_db(app.handle()));
            app.manage(database.clone());

            // ── Start Clipboard Watcher ──
            let watcher = ClipboardWatcher::new();
            watcher.start(app.handle().clone(), database);
            app.manage(watcher);

            println!("✅ PasteFlow started");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            clipboard::history::get_recent_items,
            clipboard::history::get_clip_content,
            clipboard::history::pin_item,
            clipboard::history::delete_item,
            clipboard::history::clear_history,
            clipboard::paste::paste_to_active_app,
        ])
        .run(tauri::generate_context!())
        .expect("error while running PasteFlow");
}
```

### 2.6 Frontend — Type-safe API Layer

```typescript
// src/lib/tauri.ts

import { invoke } from "@tauri-apps/api/core";

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
  tags: string[];
  variables: string[];
  use_count: number;
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

export interface ReformatResult {
  platform: string;
  reformatted: string;
  char_count: number;
  tokens_used: number;
}

export const api = {
  // ── Clipboard History ──
  getRecentItems: (limit?: number) =>
    invoke<ClipboardItem[]>("get_recent_items", { limit }),

  getClipContent: (id: string) => invoke<string>("get_clip_content", { id }),

  pinItem: (id: string, pinned: boolean) =>
    invoke<void>("pin_item", { id, pinned }),

  deleteItem: (id: string) => invoke<void>("delete_item", { id }),

  clearHistory: () => invoke<number>("clear_history"),

  pasteToActiveApp: (content: string) =>
    invoke<void>("paste_to_active_app", { content }),

  // ── Templates (Phase 3) ──
  listGroups: () => invoke<TemplateGroup[]>("list_groups"),

  listTemplates: (groupId?: string) =>
    invoke<Template[]>("list_templates", { groupId }),

  createTemplate: (data: Omit<Template, "id" | "use_count">) =>
    invoke<Template>("create_template", data),

  updateTemplate: (id: string, data: Partial<Template>) =>
    invoke<Template>("update_template", { id, ...data }),

  deleteTemplate: (id: string) => invoke<void>("delete_template", { id }),

  // ── Search (Phase 3) ──
  searchAll: (query: string, limit?: number) =>
    invoke<SearchResult[]>("search_all", { query, limit }),

  // ── AI Reformat (Phase 4) ──
  reformatContent: (text: string, platform: string) =>
    invoke<ReformatResult>("reformat_content", {
      request: { text, platform, tone: null, max_length: null },
    }),

  reformatAllPlatforms: (text: string, platforms: string[]) =>
    invoke<ReformatResult[]>("reformat_all_platforms", { text, platforms }),
};
```

### 2.7 Frontend — Zustand Store

```typescript
// src/stores/clipboardStore.ts

import { create } from "zustand";
import { api, ClipboardItem } from "../lib/tauri";
import { listen } from "@tauri-apps/api/event";

interface ClipboardState {
  items: ClipboardItem[];
  loading: boolean;

  load: () => Promise<void>;
  pin: (id: string, pinned: boolean) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  pasteItem: (id: string) => Promise<void>;
  startListening: () => void;
}

export const useClipboardStore = create<ClipboardState>((set, get) => ({
  items: [],
  loading: false,

  load: async () => {
    set({ loading: true });
    try {
      const items = await api.getRecentItems(100);
      set({ items });
    } finally {
      set({ loading: false });
    }
  },

  pin: async (id, pinned) => {
    await api.pinItem(id, pinned);
    set((s) => ({
      items: s.items.map((i) =>
        i.id === id ? { ...i, is_pinned: pinned } : i,
      ),
    }));
  },

  remove: async (id) => {
    await api.deleteItem(id);
    set((s) => ({
      items: s.items.filter((i) => i.id !== id),
    }));
  },

  clearAll: async () => {
    await api.clearHistory();
    // Giữ lại pinned items
    set((s) => ({
      items: s.items.filter((i) => i.is_pinned),
    }));
  },

  pasteItem: async (id) => {
    const content = await api.getClipContent(id);
    await api.pasteToActiveApp(content);
  },

  startListening: () => {
    // Listen cho clipboard-changed event từ Rust
    listen<{ id: string; preview: string; content_type: string }>(
      "clipboard-changed",
      (_event) => {
        // Reload list khi có item mới
        get().load();
      },
    );
  },
}));
```

### 2.8 Frontend — History List UI

```tsx
// src/components/History/HistoryList.tsx

import { useEffect } from "react";
import { useClipboardStore } from "../../stores/clipboardStore";
import { Pin, Trash2, Copy, Clock } from "lucide-react";

export function HistoryList() {
  const { items, loading, load, pin, remove, pasteItem, startListening } =
    useClipboardStore();

  useEffect(() => {
    load();
    startListening();
  }, []);

  if (loading && items.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-40
                      text-zinc-400 text-sm"
      >
        Loading...
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3
                      border-b border-zinc-100 dark:border-zinc-800"
      >
        <h2 className="text-sm font-medium">Clipboard History</h2>
        <span className="text-xs text-zinc-400">{items.length} items</span>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto">
        {items.map((item) => (
          <div
            key={item.id}
            className="group px-4 py-3 border-b border-zinc-50
                       dark:border-zinc-900
                       hover:bg-zinc-50 dark:hover:bg-zinc-900/50
                       cursor-pointer transition-colors"
            onClick={() => pasteItem(item.id)}
          >
            <div className="flex items-start gap-3">
              {/* Pin indicator */}
              {item.is_pinned && (
                <Pin size={12} className="text-blue-500 mt-1 shrink-0" />
              )}

              {/* Content preview */}
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm text-zinc-700 dark:text-zinc-300
                             truncate leading-relaxed"
                >
                  {item.content_preview}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                    <Clock size={10} />
                    {formatTimeAgo(item.created_at)}
                  </span>
                  {item.source_app && (
                    <span className="text-[10px] text-zinc-400">
                      from {item.source_app}
                    </span>
                  )}
                  {item.use_count > 0 && (
                    <span className="text-[10px] text-zinc-400">
                      used {item.use_count}x
                    </span>
                  )}
                </div>
              </div>

              {/* Actions (visible on hover) */}
              <div
                className="flex items-center gap-1 opacity-0
                            group-hover:opacity-100 transition-opacity"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    pin(item.id, !item.is_pinned);
                  }}
                  className="p-1.5 rounded hover:bg-zinc-200
                           dark:hover:bg-zinc-700"
                  title={item.is_pinned ? "Unpin" : "Pin"}
                >
                  <Pin
                    size={14}
                    className={
                      item.is_pinned ? "text-blue-500" : "text-zinc-400"
                    }
                  />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(item.id);
                  }}
                  className="p-1.5 rounded hover:bg-red-100
                           dark:hover:bg-red-900/30"
                  title="Delete"
                >
                  <Trash2
                    size={14}
                    className="text-zinc-400
                                               hover:text-red-500"
                  />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
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
  return `${diffDay}d ago`;
}
```

### 2.9 Main Window Layout

```tsx
// src/windows/MainWindow.tsx

import { HistoryList } from "../components/History/HistoryList";

export default function MainWindow() {
  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div
        className="w-48 border-r border-zinc-100 dark:border-zinc-800
                      flex flex-col"
      >
        <div className="p-4">
          <h1 className="text-base font-semibold tracking-tight">PasteFlow</h1>
        </div>
        <nav className="flex-1 px-2">
          <NavItem active label="History" />
          <NavItem label="Templates" />
          <NavItem label="AI Reformat" />
          <NavItem label="Settings" />
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col">
        <HistoryList />
      </div>
    </div>
  );
}

function NavItem({ label, active }: { label: string; active?: boolean }) {
  return (
    <button
      className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-0.5
        transition-colors ${
          active
            ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium"
            : "text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-zinc-700 dark:hover:text-zinc-300"
        }`}
    >
      {label}
    </button>
  );
}
```

### 2.10 App Entry Point

```tsx
// src/App.tsx

import MainWindow from "./windows/MainWindow";

function App() {
  return <MainWindow />;
}

export default App;
```

### 2.11 Test tuần 1

```bash
npm run tauri dev

# Test checklist:
# ✅ App mở, hiện sidebar + empty history
# ✅ Copy text ở bất kỳ app nào → item xuất hiện trong history
# ✅ Click item → text được paste vào app trước đó
# ✅ Pin/unpin hoạt động
# ✅ Delete item hoạt động
# ✅ History persist sau khi restart app
```

---

## PHASE 3: Tuần 2 — Quick Paste Popup + Global Hotkey

> Mục tiêu: Cmd+Shift+V mở popup, search + paste nhanh.

### 3.1 Quick Paste Window (Rust side)

Thêm vào `main.rs` trong `.setup()`:

```rust
// Thêm vào setup closure, sau khi init DB và watcher

// ── Quick Paste Window ──
let _quick_paste = tauri::WebviewWindowBuilder::new(
    app,
    "quick-paste",
    tauri::WebviewUrl::App("index.html".into()),
)
.title("Quick Paste")
.inner_size(560.0, 460.0)
.resizable(false)
.decorations(false)
.always_on_top(true)
.center()
.visible(false)
.skip_taskbar(true)   // Không hiện trên taskbar
.build()?;

// ── Global Hotkey: Cmd+Shift+V ──
use tauri_plugin_global_shortcut::{
    GlobalShortcutExt, Shortcut, ShortcutState,
};

let handle = app.handle().clone();
app.handle().plugin(
    tauri_plugin_global_shortcut::Builder::new()
        .with_handler(move |_app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                if let Some(win) = handle.get_webview_window("quick-paste") {
                    if win.is_visible().unwrap_or(false) {
                        let _ = win.hide();
                    } else {
                        let _ = win.center();
                        let _ = win.show();
                        let _ = win.set_focus();
                    }
                }
            }
        })
        .build(),
)?;

let shortcut: Shortcut = "CmdOrCtrl+Shift+V".parse()?;
app.global_shortcut().register(shortcut)?;
```

### 3.2 Quick Paste Frontend

```tsx
// src/windows/QuickPaste.tsx
// (Full code đã có trong architecture doc — tham khảo phần 5.2)
// Key points:
// - Auto-focus input khi popup mở
// - 100ms debounce search
// - Arrow key navigation
// - Enter = paste + đóng popup
// - Escape = đóng
// - Cmd+1..9 = quick paste by index
```

### 3.3 Multi-window routing

```tsx
// src/main.tsx

import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./styles/globals.css";

async function init() {
  const label = getCurrentWindow().label;

  if (label === "quick-paste") {
    const { default: QuickPaste } = await import("./windows/QuickPaste");
    ReactDOM.createRoot(document.getElementById("root")!).render(
      <React.StrictMode>
        <QuickPaste />
      </React.StrictMode>,
    );
  } else {
    const { default: MainWindow } = await import("./windows/MainWindow");
    ReactDOM.createRoot(document.getElementById("root")!).render(
      <React.StrictMode>
        <MainWindow />
      </React.StrictMode>,
    );
  }
}

init();
```

### 3.4 Search Command (Rust)

```rust
// src-tauri/src/search/mod.rs
pub mod fuzzy;

// src-tauri/src/search/fuzzy.rs

use serde::Serialize;
use crate::db::DbPool;
use std::sync::Arc;

#[derive(Serialize, Clone)]
pub struct SearchResult {
    pub id: String,
    pub result_type: String,
    pub title: String,
    pub preview: String,
    pub score: f64,
    pub group_name: Option<String>,
}

#[tauri::command]
pub fn search_all(
    db: tauri::State<'_, Arc<DbPool>>,
    query: String,
    limit: Option<i32>,
) -> Result<Vec<SearchResult>, String> {
    let limit = limit.unwrap_or(15);
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut results: Vec<SearchResult> = Vec::new();

    // Search templates first (higher priority)
    {
        let mut stmt = conn.prepare(
            "SELECT t.id, t.title, t.content, g.name
             FROM templates t
             LEFT JOIN template_groups g ON t.group_id = g.id
             WHERE t.title LIKE '%' || ?1 || '%'
                OR t.content LIKE '%' || ?1 || '%'
                OR t.tags LIKE '%' || ?1 || '%'
             ORDER BY t.use_count DESC
             LIMIT ?2"
        ).map_err(|e| e.to_string())?;

        let rows = stmt.query_map(
            rusqlite::params![query, limit],
            |row| {
                let content: String = row.get(2)?;
                Ok(SearchResult {
                    id: row.get(0)?,
                    result_type: "template".into(),
                    title: row.get(1)?,
                    preview: content.chars().take(100).collect(),
                    score: 1.0,
                    group_name: row.get(3)?,
                })
            }
        ).map_err(|e| e.to_string())?;

        for row in rows.flatten() {
            results.push(row);
        }
    }

    // Search clipboard history
    {
        let remaining = limit - results.len() as i32;
        if remaining > 0 {
            let mut stmt = conn.prepare(
                "SELECT id, content_preview, source_app
                 FROM clipboard_items
                 WHERE content_preview LIKE '%' || ?1 || '%'
                 ORDER BY use_count DESC, created_at DESC
                 LIMIT ?2"
            ).map_err(|e| e.to_string())?;

            let rows = stmt.query_map(
                rusqlite::params![query, remaining],
                |row| {
                    let preview: String = row.get(1)?;
                    let source: Option<String> = row.get(2)?;
                    Ok(SearchResult {
                        id: row.get(0)?,
                        result_type: "history".into(),
                        title: source.unwrap_or_default(),
                        preview,
                        score: 0.5,
                        group_name: None,
                    })
                }
            ).map_err(|e| e.to_string())?;

            for row in rows.flatten() {
                results.push(row);
            }
        }
    }

    Ok(results)
}
```

### 3.5 Register search command trong main.rs

```rust
// Thêm vào invoke_handler
.invoke_handler(tauri::generate_handler![
    // ... existing commands ...
    search::fuzzy::search_all,
])
```

### 3.6 Test tuần 2

```bash
npm run tauri dev

# Test checklist:
# ✅ Cmd+Shift+V mở popup ở center screen
# ✅ Popup mở = input auto-focused
# ✅ Gõ text → kết quả hiện real-time
# ✅ Arrow keys navigate, Enter paste
# ✅ Click ra ngoài popup → popup ẩn
# ✅ Escape đóng popup
# ✅ Paste thành công vào app đang focus
# ✅ Cmd+Shift+V toggle (mở/đóng)
```

---

## PHASE 4: Tuần 3 — Template Manager

> Mục tiêu: CRUD templates, groups, variable expansion.

### 4.1 Template Commands (Rust)

```rust
// src-tauri/src/templates/mod.rs
pub mod crud;
pub mod groups;

// src-tauri/src/templates/groups.rs

use serde::{Deserialize, Serialize};
use crate::db::DbPool;
use std::sync::Arc;

#[derive(Serialize, Deserialize, Clone)]
pub struct TemplateGroup {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub color: String,
    pub sort_order: i32,
    pub template_count: i32,
}

#[tauri::command]
pub fn list_groups(
    db: tauri::State<'_, Arc<DbPool>>,
) -> Result<Vec<TemplateGroup>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT g.id, g.name, g.icon, g.color, g.sort_order,
                COUNT(t.id) as template_count
         FROM template_groups g
         LEFT JOIN templates t ON t.group_id = g.id
         GROUP BY g.id
         ORDER BY g.sort_order"
    ).map_err(|e| e.to_string())?;

    let groups = stmt.query_map([], |row| {
        Ok(TemplateGroup {
            id: row.get(0)?,
            name: row.get(1)?,
            icon: row.get(2)?,
            color: row.get(3)?,
            sort_order: row.get(4)?,
            template_count: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?;

    Ok(groups.filter_map(|g| g.ok()).collect())
}

#[tauri::command]
pub fn create_group(
    db: tauri::State<'_, Arc<DbPool>>,
    name: String,
    icon: String,
    color: String,
) -> Result<TemplateGroup, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO template_groups (id, name, icon, color) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![id, name, icon, color],
    ).map_err(|e| e.to_string())?;

    Ok(TemplateGroup {
        id,
        name,
        icon,
        color,
        sort_order: 0,
        template_count: 0,
    })
}

// src-tauri/src/templates/crud.rs

use serde::{Deserialize, Serialize};
use crate::db::DbPool;
use std::sync::Arc;

#[derive(Serialize, Deserialize, Clone)]
pub struct Template {
    pub id: String,
    pub group_id: Option<String>,
    pub title: String,
    pub content: String,
    pub shortcut: Option<String>,
    pub tags: String,
    pub variables: String,
    pub use_count: i32,
}

#[tauri::command]
pub fn list_templates(
    db: tauri::State<'_, Arc<DbPool>>,
    group_id: Option<String>,
) -> Result<Vec<Template>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let (sql, params): (&str, Vec<Box<dyn rusqlite::types::ToSql>>) =
        if let Some(ref gid) = group_id {
            (
                "SELECT id, group_id, title, content, shortcut, tags, variables, use_count
                 FROM templates WHERE group_id = ?1 ORDER BY use_count DESC",
                vec![Box::new(gid.clone())],
            )
        } else {
            (
                "SELECT id, group_id, title, content, shortcut, tags, variables, use_count
                 FROM templates ORDER BY use_count DESC",
                vec![],
            )
        };

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(
        rusqlite::params_from_iter(params.iter()),
        |row| {
            Ok(Template {
                id: row.get(0)?,
                group_id: row.get(1)?,
                title: row.get(2)?,
                content: row.get(3)?,
                shortcut: row.get(4)?,
                tags: row.get(5)?,
                variables: row.get(6)?,
                use_count: row.get(7)?,
            })
        }
    ).map_err(|e| e.to_string())?;

    Ok(rows.filter_map(|r| r.ok()).collect())
}

#[tauri::command]
pub fn create_template(
    db: tauri::State<'_, Arc<DbPool>>,
    group_id: Option<String>,
    title: String,
    content: String,
    shortcut: Option<String>,
    tags: Option<String>,
) -> Result<Template, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let tags_str = tags.unwrap_or_else(|| "[]".to_string());

    // Auto-detect variables: tìm {{...}} trong content
    let variables = extract_variables(&content);
    let variables_str = serde_json::to_string(&variables)
        .unwrap_or_else(|_| "[]".to_string());

    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO templates (id, group_id, title, content, shortcut, tags, variables)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![id, group_id, title, content, shortcut, tags_str, variables_str],
    ).map_err(|e| e.to_string())?;

    Ok(Template {
        id, group_id, title, content, shortcut,
        tags: tags_str,
        variables: variables_str,
        use_count: 0,
    })
}

#[tauri::command]
pub fn update_template(
    db: tauri::State<'_, Arc<DbPool>>,
    id: String,
    title: Option<String>,
    content: Option<String>,
    group_id: Option<String>,
    shortcut: Option<String>,
    tags: Option<String>,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    if let Some(t) = title {
        conn.execute(
            "UPDATE templates SET title = ?1, updated_at = datetime('now','localtime') WHERE id = ?2",
            rusqlite::params![t, id],
        ).map_err(|e| e.to_string())?;
    }
    if let Some(c) = content {
        let vars = extract_variables(&c);
        let vars_str = serde_json::to_string(&vars).unwrap_or("[]".into());
        conn.execute(
            "UPDATE templates SET content = ?1, variables = ?2,
             updated_at = datetime('now','localtime') WHERE id = ?3",
            rusqlite::params![c, vars_str, id],
        ).map_err(|e| e.to_string())?;
    }
    // ... similar for other fields

    Ok(())
}

#[tauri::command]
pub fn delete_template(
    db: tauri::State<'_, Arc<DbPool>>,
    id: String,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM templates WHERE id = ?1", [&id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// Extract {{variable_name}} from content
fn extract_variables(content: &str) -> Vec<String> {
    let re = regex::Regex::new(r"\{\{(\w+)\}\}").unwrap();
    re.captures_iter(content)
        .map(|cap| cap[1].to_string())
        .collect::<std::collections::HashSet<_>>()
        .into_iter()
        .collect()
}
```

Thêm `regex` vào Cargo.toml:

```bash
cd src-tauri && cargo add regex && cd ..
```

### 4.2 Test tuần 3

```bash
# Test checklist:
# ✅ Tạo group mới (Social Media, Clients, Code...)
# ✅ Tạo template trong group
# ✅ Template với {{variable}} tự detect biến
# ✅ Search tìm được cả template lẫn history
# ✅ Quick Paste popup hiện template results
# ✅ Paste template hoạt động
```

---

## PHASE 5: Tuần 4 — AI Reformat

> Mục tiêu: Paste text → chọn platform → AI rewrite.

### 5.1 AI Module (Rust)

```rust
// src-tauri/src/ai/mod.rs
pub mod reformat;
pub mod prompts;

// (Code đầy đủ đã có trong architecture doc phần 4.3)
// Key: reformat_content + reformat_all_platforms + build_platform_prompt
```

### 5.2 Settings Command

```rust
// Thêm vào db.rs hoặc tạo file settings.rs

#[tauri::command]
pub fn get_setting(
    db: tauri::State<'_, Arc<DbPool>>,
    key: String,
) -> Result<String, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        [&key],
        |row| row.get(0),
    ).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_setting(
    db: tauri::State<'_, Arc<DbPool>>,
    key: String,
    value: String,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        rusqlite::params![key, value],
    ).map_err(|e| e.to_string())?;
    Ok(())
}
```

### 5.3 Test tuần 4

```bash
# Test checklist:
# ✅ Settings page: nhập API key
# ✅ Paste text vào Reformat panel
# ✅ Click reformat → hiện loading
# ✅ 4 platform results hiện đúng
# ✅ Click Copy → text vào clipboard
# ✅ Tokens used tracking
# ✅ Reformat history lưu lại
```

---

## PHASE 6: Tuần 5 — System Tray + Polish

> Mục tiêu: App chạy background, auto-start, UX polish.

### 6.1 System Tray

```rust
// Thêm vào main.rs setup

use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::menu::{Menu, MenuItem};

// Build tray menu
let show = MenuItem::with_id(app, "show", "Show PasteFlow", true, None::<&str>)?;
let quick = MenuItem::with_id(app, "quick", "Quick Paste (⌘⇧V)", true, None::<&str>)?;
let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
let menu = Menu::with_items(app, &[&show, &quick, &quit])?;

let handle_for_tray = app.handle().clone();
let _tray = TrayIconBuilder::new()
    .icon(app.default_window_icon().unwrap().clone())
    .tooltip("PasteFlow — Clipboard Manager")
    .menu(&menu)
    .on_menu_event(move |app, event| {
        match event.id.as_ref() {
            "show" => {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
            "quick" => {
                if let Some(w) = app.get_webview_window("quick-paste") {
                    let _ = w.center();
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        }
    })
    .on_tray_icon_event(move |tray, event| {
        if let TrayIconEvent::Click {
            button: MouseButton::Left,
            button_state: MouseButtonState::Up, ..
        } = event {
            if let Some(w) = tray.app_handle().get_webview_window("main") {
                let _ = w.show();
                let _ = w.set_focus();
            }
        }
    })
    .build(app)?;
```

### 6.2 Auto-start on Login

```rust
// Trong setup:
use tauri_plugin_autostart::MacosLauncher;

// Thêm plugin
.plugin(tauri_plugin_autostart::init(
    MacosLauncher::LaunchAgent,
    Some(vec![]),
))

// Command để toggle
#[tauri::command]
pub fn toggle_autostart(
    app: tauri::AppHandle,
    enabled: bool,
) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;
    let manager = app.autolaunch();
    if enabled {
        manager.enable().map_err(|e| e.to_string())?;
    } else {
        manager.disable().map_err(|e| e.to_string())?;
    }
    Ok(())
}
```

### 6.3 Close to tray (không quit khi đóng window)

```rust
// Trong setup, sau khi tạo main window:
let main_window = app.get_webview_window("main").unwrap();
let mw = main_window.clone();
main_window.on_window_event(move |event| {
    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        // Ẩn thay vì đóng
        api.prevent_close();
        let _ = mw.hide();
    }
});
```

### 6.4 UX Polish checklist

```
✅ Dark mode tự detect theo OS
✅ Keyboard shortcut hints trong UI
✅ Empty states (no history yet, no templates)
✅ Loading indicators cho AI reformat
✅ Toast notifications (copied!, pasted!, etc.)
✅ Smooth animations (popup appear/disappear)
✅ Focus trap trong Quick Paste popup
✅ History auto-cleanup (keep max 5000 items)
```

---

## PHASE 7: Tuần 6 — Build + Landing Page + Launch

### 7.1 Build Production

```bash
# ── macOS ──
npm run tauri build
# Output: src-tauri/target/release/bundle/
#   ├── dmg/PasteFlow_0.1.0_aarch64.dmg    (Apple Silicon)
#   ├── dmg/PasteFlow_0.1.0_x64.dmg        (Intel)
#   └── macos/PasteFlow.app

# ── Windows ──
npm run tauri build
# Output: src-tauri/target/release/bundle/
#   ├── nsis/PasteFlow_0.1.0_x64-setup.exe
#   └── msi/PasteFlow_0.1.0_x64_en-US.msi

# ── Cross-compile (macOS → Windows, cần setup) ──
# Dùng GitHub Actions thay vì local cross-compile (dễ hơn nhiều)
```

### 7.2 GitHub Actions CI/CD

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags: ["v*"]

jobs:
  build:
    strategy:
      matrix:
        include:
          - os: macos-latest
            target: aarch64-apple-darwin
          - os: macos-latest
            target: x86_64-apple-darwin
          - os: windows-latest
            target: x86_64-pc-windows-msvc

    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.target }}

      - name: Install dependencies
        run: npm ci

      - name: Build Tauri
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          # Code signing (macOS):
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
          APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
        with:
          tagName: v__VERSION__
          releaseName: "PasteFlow v__VERSION__"
          releaseBody: "See changelog for details."
          releaseDraft: true
```

### 7.3 Landing Page (1 trang duy nhất)

```
Dùng: Astro / Next.js static / hoặc đơn giản nhất: Carrd.co ($19/year)

Cấu trúc landing page:
├── Hero: "Stop losing your clipboard. Start pasting smarter."
│   └── CTA: "Download Free" + "Watch Demo (30s)"
├── Pain → Solution (3 columns):
│   ├── "Clipboard forgets" → "History remembers"
│   ├── "Same text, typed 20x" → "Templates, 1 keystroke"
│   └── "1 post, 4 platforms" → "AI reformats instantly"
├── Demo GIF/Video (15-30 giây)
├── Pricing:
│   ├── Free: 50 history, 5 templates
│   ├── Pro $6/mo: unlimited + AI
│   └── Lifetime $39: everything forever
├── Testimonials (sau khi có beta users)
└── FAQ + Download buttons
```

### 7.4 Payment Setup

```
Option 1: LemonSqueezy (recommended)
  - Tạo account: https://lemonsqueezy.com
  - Tạo 2 products: Pro Monthly ($6) + Lifetime ($39)
  - Lấy API key cho license validation
  - Không cần server riêng

Option 2: Gumroad
  - Đơn giản hơn nhưng phí cao hơn (10%)
  - Tốt cho lifetime deals

Implementation trong app:
  1. User mua → nhận license key qua email
  2. Nhập key trong Settings → app gọi LemonSqueezy API validate
  3. Lưu license info (encrypted) vào SQLite
  4. Check local mỗi lần mở app
  5. Grace period 30 ngày nếu offline
```

### 7.5 License Validation (Rust)

```rust
// src-tauri/src/system/license.rs

#[derive(Serialize, Deserialize)]
pub struct LicenseInfo {
    pub key: String,
    pub valid: bool,
    pub plan: String,        // "free", "pro", "lifetime"
    pub validated_at: String,
}

#[tauri::command]
pub async fn validate_license(
    db: tauri::State<'_, Arc<DbPool>>,
    license_key: String,
) -> Result<LicenseInfo, String> {
    let client = reqwest::Client::new();
    let res = client
        .post("https://api.lemonsqueezy.com/v1/licenses/validate")
        .json(&serde_json::json!({
            "license_key": license_key,
        }))
        .send().await
        .map_err(|e| e.to_string())?;

    let data: serde_json::Value = res.json().await
        .map_err(|e| e.to_string())?;

    let valid = data["valid"].as_bool().unwrap_or(false);
    let plan = if valid { "pro" } else { "free" };

    let info = LicenseInfo {
        key: license_key,
        valid,
        plan: plan.to_string(),
        validated_at: chrono::Local::now().to_rfc3339(),
    };

    // Lưu vào settings
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('license',?1)",
        [serde_json::to_string(&info).unwrap()],
    ).map_err(|e| e.to_string())?;

    Ok(info)
}
```

---

## PHASE 8: Tuần 6+ — Launch & Distribution

### 8.1 Launch Checklist

```
PRE-LAUNCH (2-3 ngày trước):
□ README.md hoàn chỉnh trên GitHub
□ Landing page live
□ Download links hoạt động (GitHub Releases)
□ Payment flow test end-to-end
□ 3-5 beta testers đã dùng + feedback

LAUNCH DAY:
□ Post Reddit: r/SideProject, r/macapps, r/windows, r/productivity
□ Post Twitter/X: demo GIF + link
□ Post Hacker News: "Show HN: PasteFlow – ..."
□ Post Product Hunt (schedule 12:01 AM PT Tuesday)
□ Post Dev.to: "How I built a clipboard manager in 6 weeks"
□ Post Indie Hackers: building in public story

POST-LAUNCH (tuần 7-8):
□ Monitor crash reports
□ Respond to feedback (GitHub Issues)
□ Iterate based on top 3 feature requests
□ Weekly update post (Twitter, Indie Hackers)
```

### 8.2 Lịch trình tóm tắt

```
Tuần 1: Clipboard watcher + history list + basic UI
Tuần 2: Quick Paste popup + global hotkey + search
Tuần 3: Template manager + groups + variables
Tuần 4: AI reformat + settings + API integration
Tuần 5: System tray + auto-start + polish + testing
Tuần 6: Build + landing page + payment + LAUNCH

Milestone quan trọng:
  - Cuối tuần 2: Dogfood bản thân (dùng hàng ngày)
  - Cuối tuần 4: MVP hoàn chỉnh, cho 3-5 người test
  - Cuối tuần 6: Public launch
```

---

## Appendix: Troubleshooting

```
❌ "Clipboard permission denied" trên macOS
   → System Preferences > Privacy > Accessibility > Thêm PasteFlow

❌ Global hotkey không hoạt động
   → Check conflict với app khác (CleanShot, Alfred, Raycast)
   → Cho user chọn hotkey khác trong Settings

❌ Paste không hoạt động vào một số app
   → Một số app (banking, password manager) block simulated keystrokes
   → Fallback: chỉ set clipboard, user tự Cmd+V

❌ App chạy chậm khi history lớn
   → Pagination: chỉ load 50 items đầu, lazy load thêm
   → Cleanup job: tự xoá items > 30 ngày (trừ pinned)

❌ Windows build lỗi
   → Kiểm tra Visual Studio Build Tools đã cài đủ components
   → Chạy: rustup default stable-x86_64-pc-windows-msvc
```
