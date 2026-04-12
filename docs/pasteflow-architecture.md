# PasteFlow — Technical Architecture (Tauri 2 + React + TypeScript)

---

## 1. Tổng quan kiến trúc

```
┌──────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                      │
│  ┌────────────┐ ┌─────────────┐ ┌──────────────────────┐│
│  │ Clipboard  │ │  Template   │ │  AI Reformat Panel   ││
│  │ History    │ │  Manager    │ │  (multi-platform)    ││
│  └─────┬──────┘ └──────┬──────┘ └──────────┬───────────┘│
│        │               │                   │            │
│  ┌─────▼───────────────▼───────────────────▼──────────┐ │
│  │              Zustand State Management              │ │
│  └──────────────────────┬─────────────────────────────┘ │
│                         │ invoke()                      │
├─────────────────────────┼───────────────────────────────┤
│                         │ IPC Bridge                    │
├─────────────────────────┼───────────────────────────────┤
│                    BACKEND (Rust)                        │
│                                                          │
│  ┌──────────────────────▼────────────────────────────┐  │
│  │               Command Router                      │  │
│  └──┬──────────┬──────────┬──────────┬───────────────┘  │
│     │          │          │          │                   │
│  ┌──▼───┐  ┌──▼───┐  ┌──▼────┐  ┌──▼──────────────┐   │
│  │Clip  │  │Templ │  │Search │  │AI Reformat      │   │
│  │Watch │  │CRUD  │  │Engine │  │(HTTP → LLM API) │   │
│  └──┬───┘  └──┬───┘  └──┬────┘  └──┬──────────────┘   │
│     │         │         │          │                    │
│  ┌──▼─────────▼─────────▼──────────▼──────────────┐    │
│  │              SQLite (rusqlite)                  │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─────────────────────┐  ┌──────────────────────────┐  │
│  │  Global Hotkey      │  │  System Tray             │  │
│  │  Cmd+Shift+V        │  │  (background daemon)     │  │
│  └─────────────────────┘  └──────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

**3 chế độ UI:**

```
1. MAIN WINDOW        — Quản lý template, xem history, settings
2. QUICK PASTE POPUP  — Cmd+Shift+V → overlay nhỏ, search + paste
3. SYSTEM TRAY        — App chạy background, luôn monitor clipboard
```

---

## 2. Project Structure

```
pasteflow/
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/
│   │   └── default.json
│   ├── src/
│   │   ├── main.rs                  # Entry, setup tray + hotkey
│   │   ├── lib.rs                   # Register all commands
│   │   ├── db.rs                    # SQLite init + migrations
│   │   │
│   │   ├── clipboard/
│   │   │   ├── mod.rs
│   │   │   ├── watcher.rs           # Polling clipboard mỗi 500ms
│   │   │   ├── history.rs           # Lưu/query history
│   │   │   └── paste.rs             # Simulate paste vào app đang focus
│   │   │
│   │   ├── templates/
│   │   │   ├── mod.rs
│   │   │   ├── crud.rs              # Tạo/sửa/xoá template
│   │   │   └── groups.rs            # Nhóm template (Social, Client, ...)
│   │   │
│   │   ├── ai/
│   │   │   ├── mod.rs
│   │   │   ├── reformat.rs          # Gọi LLM API để reformat
│   │   │   └── prompts.rs           # Prompt template cho từng platform
│   │   │
│   │   ├── search/
│   │   │   ├── mod.rs
│   │   │   └── fuzzy.rs             # Fuzzy search qua history + templates
│   │   │
│   │   └── system/
│   │       ├── mod.rs
│   │       ├── hotkey.rs            # Global shortcut registration
│   │       ├── tray.rs              # System tray menu
│   │       └── autostart.rs         # Launch on login
│
├── src/                              # React frontend
│   ├── main.tsx
│   ├── App.tsx
│   │
│   ├── windows/                      # Tauri multi-window
│   │   ├── MainWindow.tsx            # Full app UI
│   │   └── QuickPaste.tsx            # Popup overlay (Cmd+Shift+V)
│   │
│   ├── stores/
│   │   ├── clipboardStore.ts
│   │   ├── templateStore.ts
│   │   ├── searchStore.ts
│   │   └── settingsStore.ts
│   │
│   ├── components/
│   │   ├── History/
│   │   │   ├── HistoryList.tsx       # Danh sách clipboard items
│   │   │   ├── HistoryItem.tsx       # 1 item (preview, pin, delete)
│   │   │   └── HistoryFilter.tsx     # Filter by type, date, pinned
│   │   │
│   │   ├── Templates/
│   │   │   ├── TemplateManager.tsx   # CRUD templates
│   │   │   ├── TemplateGroup.tsx     # Nhóm: Social, Client, Code...
│   │   │   └── TemplateEditor.tsx    # Edit with syntax highlight
│   │   │
│   │   ├── QuickPaste/
│   │   │   ├── SearchBar.tsx         # Search input (cmdk style)
│   │   │   ├── ResultList.tsx        # Mixed results: history + templates
│   │   │   └── ReformatPreview.tsx   # Preview AI-reformatted variants
│   │   │
│   │   ├── AI/
│   │   │   ├── ReformatPanel.tsx     # Chọn platform → xem preview
│   │   │   ├── PlatformSelector.tsx  # Twitter, LinkedIn, Email, Custom
│   │   │   └── OutputCard.tsx        # Kết quả reformat, 1-click copy
│   │   │
│   │   └── Settings/
│   │       ├── General.tsx           # Hotkey config, max history
│   │       ├── AIConfig.tsx          # API key, model selection
│   │       └── Sync.tsx              # Export/import data
│   │
│   ├── lib/
│   │   ├── tauri.ts                  # Type-safe invoke wrappers
│   │   └── constants.ts
│   │
│   └── styles/
│       └── globals.css
│
├── src/quick-paste.html              # Entry point cho popup window
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── vite.config.ts
```

---

## 3. SQLite Schema

```sql
-- ══════════════════════════════════════════
-- CLIPBOARD HISTORY
-- ══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS clipboard_items (
    id            TEXT PRIMARY KEY DEFAULT (hex(randomblob(8))),
    content_type  TEXT NOT NULL CHECK(content_type IN ('text', 'image', 'html', 'file')),
    content_text  TEXT,                       -- plain text content
    content_html  TEXT,                       -- rich text (nếu copy từ browser)
    content_preview TEXT,                     -- 200 ký tự đầu, dùng cho search
    image_path    TEXT,                       -- path tới file ảnh (nếu copy image)
    source_app    TEXT,                       -- app nào đã copy (Chrome, VS Code...)
    byte_size     INTEGER DEFAULT 0,
    is_pinned     BOOLEAN DEFAULT 0,          -- pin = không bị xoá khi dọn history
    is_favorite   BOOLEAN DEFAULT 0,
    use_count     INTEGER DEFAULT 0,          -- đếm số lần paste lại
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_clip_created ON clipboard_items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clip_pinned ON clipboard_items(is_pinned) WHERE is_pinned = 1;
CREATE INDEX IF NOT EXISTS idx_clip_search ON clipboard_items(content_preview);


-- ══════════════════════════════════════════
-- TEMPLATE GROUPS & TEMPLATES
-- ══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS template_groups (
    id          TEXT PRIMARY KEY DEFAULT (hex(randomblob(8))),
    name        TEXT NOT NULL,                -- "Social Media", "Client Emails"...
    icon        TEXT DEFAULT '📁',
    color       TEXT DEFAULT '#3B82F6',
    sort_order  INTEGER DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS templates (
    id            TEXT PRIMARY KEY DEFAULT (hex(randomblob(8))),
    group_id      TEXT REFERENCES template_groups(id) ON DELETE SET NULL,
    title         TEXT NOT NULL,              -- "Twitter bio", "Upwork proposal"
    content       TEXT NOT NULL,              -- actual text block
    shortcut      TEXT,                       -- optional: "tw-bio" → type to expand
    tags          TEXT DEFAULT '[]',          -- JSON array for search
    variables     TEXT DEFAULT '[]',          -- ["{{client_name}}", "{{project}}"]
    use_count     INTEGER DEFAULT 0,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tpl_group ON templates(group_id);
CREATE INDEX IF NOT EXISTS idx_tpl_search ON templates(title, tags);


-- ══════════════════════════════════════════
-- AI REFORMAT HISTORY
-- ══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS reformat_history (
    id              TEXT PRIMARY KEY DEFAULT (hex(randomblob(8))),
    original_text   TEXT NOT NULL,
    platform        TEXT NOT NULL,            -- "twitter", "linkedin", "email"...
    reformatted     TEXT NOT NULL,
    model_used      TEXT DEFAULT 'gpt-4o-mini',
    tokens_used     INTEGER DEFAULT 0,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);


-- ══════════════════════════════════════════
-- USER SETTINGS
-- ══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS settings (
    key     TEXT PRIMARY KEY,
    value   TEXT NOT NULL
);

-- Default settings
INSERT OR IGNORE INTO settings (key, value) VALUES
    ('max_history_items', '5000'),
    ('clipboard_poll_ms', '500'),
    ('hotkey_quick_paste', 'CmdOrCtrl+Shift+V'),
    ('hotkey_reformat', 'CmdOrCtrl+Shift+R'),
    ('ai_provider', 'openai'),
    ('ai_api_key', ''),
    ('ai_model', 'gpt-4o-mini'),
    ('auto_start', 'true'),
    ('theme', 'system');
```

---

## 4. Rust Backend — Core Modules

### 4.1 Clipboard Watcher (QUAN TRỌNG NHẤT)

```rust
// clipboard/watcher.rs
// Polling clipboard mỗi 500ms, detect thay đổi, lưu vào DB

use arboard::Clipboard;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};
use crate::db::DbPool;

pub struct ClipboardWatcher {
    last_text: Arc<Mutex<String>>,
    running: Arc<Mutex<bool>>,
}

impl ClipboardWatcher {
    pub fn new() -> Self {
        Self {
            last_text: Arc::new(Mutex::new(String::new())),
            running: Arc::new(Mutex::new(false)),
        }
    }

    pub fn start(&self, app: AppHandle, db: DbPool) {
        let last_text = self.last_text.clone();
        let running = self.running.clone();
        *running.lock().unwrap() = true;

        // Spawn background thread — không block main thread
        std::thread::spawn(move || {
            let mut clipboard = Clipboard::new().expect("Failed to init clipboard");
            let poll_interval = std::time::Duration::from_millis(500);

            while *running.lock().unwrap() {
                // ── Text content ──
                if let Ok(text) = clipboard.get_text() {
                    let mut last = last_text.lock().unwrap();
                    if !text.is_empty() && *last != text {
                        *last = text.clone();
                        drop(last); // release lock trước khi DB write

                        // Detect source app (platform-specific)
                        let source = get_active_app_name();

                        // Lưu vào SQLite
                        let preview = text.chars().take(200).collect::<String>();
                        let byte_size = text.len() as i64;

                        if let Err(e) = save_clip_item(
                            &db, "text", &text, None, &preview,
                            None, source.as_deref(), byte_size
                        ) {
                            eprintln!("Failed to save clip: {}", e);
                        }

                        // Emit event → frontend update list
                        let _ = app.emit("clipboard-changed", ClipEvent {
                            content_type: "text".into(),
                            preview: preview.clone(),
                        });
                    }
                }

                // ── Image content (lưu file, track path) ──
                if let Ok(img) = clipboard.get_image() {
                    let path = save_image_to_disk(&img, &app);
                    if let Some(p) = path {
                        let _ = save_clip_item(
                            &db, "image", None, None, "[Image]",
                            Some(&p), None, img.bytes.len() as i64
                        );
                        let _ = app.emit("clipboard-changed", ClipEvent {
                            content_type: "image".into(),
                            preview: p,
                        });
                    }
                }

                std::thread::sleep(poll_interval);
            }
        });
    }
}

// Platform-specific: lấy tên app đang focus
#[cfg(target_os = "macos")]
fn get_active_app_name() -> Option<String> {
    use std::process::Command;
    let output = Command::new("osascript")
        .args(["-e", r#"tell application "System Events"
            get name of first application process whose frontmost is true
        end tell"#])
        .output().ok()?;
    let name = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if name.is_empty() { None } else { Some(name) }
}

#[cfg(target_os = "windows")]
fn get_active_app_name() -> Option<String> {
    // Dùng windows-sys crate hoặc powershell
    use std::process::Command;
    let output = Command::new("powershell")
        .args(["-Command", "(Get-Process | Where-Object {$_.MainWindowHandle -eq \
            (Add-Type '[DllImport(\"user32.dll\")] public static extern IntPtr \
            GetForegroundWindow();' -Name W -Pas)::GetForegroundWindow()}).ProcessName"])
        .output().ok()?;
    let name = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if name.is_empty() { None } else { Some(name) }
}

#[derive(serde::Serialize, Clone)]
struct ClipEvent {
    content_type: String,
    preview: String,
}
```

### 4.2 Smart Paste — Paste vào app đang focus

```rust
// clipboard/paste.rs
// Set clipboard content + simulate Cmd+V / Ctrl+V

use arboard::Clipboard;

#[tauri::command]
pub async fn paste_to_active_app(content: String) -> Result<(), String> {
    // 1. Set clipboard content
    let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.set_text(&content).map_err(|e| e.to_string())?;

    // 2. Simulate paste keystroke (Cmd+V / Ctrl+V)
    simulate_paste()?;

    Ok(())
}

#[cfg(target_os = "macos")]
fn simulate_paste() -> Result<(), String> {
    use std::process::Command;
    // osascript simulate Cmd+V
    Command::new("osascript")
        .args(["-e", r#"tell application "System Events"
            keystroke "v" using command down
        end tell"#])
        .output()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(target_os = "windows")]
fn simulate_paste() -> Result<(), String> {
    use std::process::Command;
    // PowerShell simulate Ctrl+V
    Command::new("powershell")
        .args(["-Command", r#"
            Add-Type -AssemblyName System.Windows.Forms
            [System.Windows.Forms.SendKeys]::SendWait("^v")
        "#])
        .output()
        .map_err(|e| e.to_string())?;
    Ok(())
}
```

### 4.3 AI Reformat Engine

```rust
// ai/reformat.rs

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct ReformatRequest {
    pub text: String,
    pub platform: String,        // "twitter", "linkedin", "email", "facebook"
    pub tone: Option<String>,    // "professional", "casual", "witty"
    pub max_length: Option<u32>, // platform-specific limit
}

#[derive(Serialize, Deserialize)]
pub struct ReformatResult {
    pub platform: String,
    pub reformatted: String,
    pub char_count: usize,
    pub tokens_used: u32,
}

#[tauri::command]
pub async fn reformat_content(
    db: tauri::State<'_, crate::db::DbPool>,
    request: ReformatRequest,
) -> Result<ReformatResult, String> {
    let settings = get_settings(&db)?;
    let api_key = settings.get("ai_api_key")
        .ok_or("API key not configured")?;
    let model = settings.get("ai_model")
        .unwrap_or(&"gpt-4o-mini".to_string())
        .clone();

    let system_prompt = build_platform_prompt(&request.platform, &request.tone);

    let body = serde_json::json!({
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": request.text}
        ],
        "max_tokens": 1000,
        "temperature": 0.7
    });

    let client = reqwest::Client::new();
    let response = client
        .post("https://api.openai.com/v1/chat/completions")
        .bearer_auth(api_key)
        .json(&body)
        .send().await
        .map_err(|e| e.to_string())?;

    let data: serde_json::Value = response.json().await
        .map_err(|e| e.to_string())?;

    let reformatted = data["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .to_string();

    let tokens = data["usage"]["total_tokens"].as_u64().unwrap_or(0) as u32;

    // Lưu history
    save_reformat_history(&db, &request.text, &request.platform,
                          &reformatted, &model, tokens)?;

    Ok(ReformatResult {
        platform: request.platform,
        char_count: reformatted.len(),
        reformatted,
        tokens_used: tokens,
    })
}

// ── Batch reformat: 1 text → nhiều platform cùng lúc ──

#[tauri::command]
pub async fn reformat_all_platforms(
    db: tauri::State<'_, crate::db::DbPool>,
    text: String,
    platforms: Vec<String>,
) -> Result<Vec<ReformatResult>, String> {
    let mut results = Vec::new();

    // Chạy song song với tokio::join hoặc futures::join_all
    let futures: Vec<_> = platforms.iter().map(|p| {
        reformat_content(db.clone(), ReformatRequest {
            text: text.clone(),
            platform: p.clone(),
            tone: None,
            max_length: None,
        })
    }).collect();

    for future in futures {
        match future.await {
            Ok(r) => results.push(r),
            Err(e) => eprintln!("Reformat error: {}", e),
        }
    }

    Ok(results)
}

// ai/prompts.rs

pub fn build_platform_prompt(platform: &str, tone: &Option<String>) -> String {
    let tone_str = tone.as_deref().unwrap_or("natural");

    match platform {
        "twitter" => format!(
            "You are an expert social media copywriter.\n\
            Rewrite the given text as a Twitter/X post.\n\
            Rules:\n\
            - Maximum 280 characters (STRICT)\n\
            - Start with a strong hook (first line must grab attention)\n\
            - Use line breaks for readability\n\
            - Add 2-3 relevant hashtags at the end\n\
            - Tone: {}\n\
            - Output ONLY the tweet, nothing else.", tone_str),

        "linkedin" => format!(
            "You are an expert LinkedIn content writer.\n\
            Rewrite the given text as a LinkedIn post.\n\
            Rules:\n\
            - Start with a bold first line (hook)\n\
            - Use short paragraphs (1-2 sentences each)\n\
            - Add line breaks between paragraphs for readability\n\
            - Professional but conversational tone\n\
            - End with a question or CTA to drive engagement\n\
            - 800-1500 characters ideal\n\
            - Tone: {}\n\
            - Output ONLY the post, nothing else.", tone_str),

        "email" => format!(
            "You are an expert email copywriter.\n\
            Rewrite the given text as a professional email.\n\
            Rules:\n\
            - First line: Subject: [compelling subject line]\n\
            - Then the email body\n\
            - Clear structure: greeting, main point, CTA, sign-off\n\
            - Concise but complete\n\
            - Tone: {}\n\
            - Output ONLY the email, nothing else.", tone_str),

        "facebook" => format!(
            "You are an expert Facebook content writer.\n\
            Rewrite the given text as a Facebook post.\n\
            Rules:\n\
            - Casual, conversational tone\n\
            - Can be longer than Twitter (300-800 chars)\n\
            - Use emojis sparingly (2-3 max)\n\
            - End with engagement driver (question, poll, or CTA)\n\
            - Tone: {}\n\
            - Output ONLY the post, nothing else.", tone_str),

        _ => format!(
            "Rewrite the following text in a {} tone.\n\
            Keep the core message but improve clarity and impact.\n\
            Output ONLY the rewritten text.", tone_str),
    }
}
```

### 4.4 Template với Variables

```rust
// templates/crud.rs

#[derive(Serialize, Deserialize, Debug)]
pub struct Template {
    pub id: String,
    pub group_id: Option<String>,
    pub title: String,
    pub content: String,
    pub shortcut: Option<String>,
    pub tags: Vec<String>,
    pub variables: Vec<String>,  // ["{{client_name}}", "{{rate}}"]
    pub use_count: i32,
}

#[tauri::command]
pub async fn expand_template(
    db: tauri::State<'_, crate::db::DbPool>,
    template_id: String,
    variable_values: std::collections::HashMap<String, String>,
) -> Result<String, String> {
    let template = get_template(&db, &template_id)?;
    let mut result = template.content.clone();

    // Replace {{variable}} với giá trị user nhập
    for (key, value) in &variable_values {
        let placeholder = format!("{{{{{}}}}}", key); // {{key}}
        result = result.replace(&placeholder, value);
    }

    // Tăng use_count
    increment_use_count(&db, &template_id)?;

    Ok(result)
}

// Ví dụ template với variable:
// Title: "Upwork Proposal"
// Content: "Hi {{client_name}},
//   I'd love to help with your {{project_type}} project.
//   My rate is ${{rate}}/hr and I can start {{start_date}}.
//   Here's my portfolio: {{portfolio_link}}
//   Best, {{my_name}}"
// Variables: ["client_name", "project_type", "rate", "start_date",
//             "portfolio_link", "my_name"]
```

### 4.5 Fuzzy Search

```rust
// search/fuzzy.rs

use serde::Serialize;

#[derive(Serialize)]
pub struct SearchResult {
    pub id: String,
    pub result_type: String,  // "history" | "template"
    pub title: String,        // template title hoặc preview text
    pub preview: String,
    pub score: f64,           // relevance score
    pub group_name: Option<String>,
}

#[tauri::command]
pub async fn search_all(
    db: tauri::State<'_, crate::db::DbPool>,
    query: String,
    limit: Option<i32>,
) -> Result<Vec<SearchResult>, String> {
    let limit = limit.unwrap_or(20);
    let mut results: Vec<SearchResult> = Vec::new();

    // 1. Search templates (ưu tiên cao hơn)
    let templates = search_templates(&db, &query, limit)?;
    for t in templates {
        results.push(SearchResult {
            id: t.id,
            result_type: "template".into(),
            title: t.title,
            preview: t.content.chars().take(100).collect(),
            score: 1.0, // template luôn ưu tiên
            group_name: t.group_name,
        });
    }

    // 2. Search clipboard history
    let clips = search_history(&db, &query, limit)?;
    for c in clips {
        results.push(SearchResult {
            id: c.id,
            result_type: "history".into(),
            title: c.source_app.unwrap_or_default(),
            preview: c.content_preview,
            score: 0.5,
            group_name: None,
        });
    }

    // 3. Sort by score + use_count
    results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap());
    results.truncate(limit as usize);

    Ok(results)
}

// SQL fuzzy search dùng LIKE + INSTR cho MVP
// Upgrade sau: dùng FTS5 (SQLite full-text search)
fn search_templates(db: &DbPool, query: &str, limit: i32)
    -> Result<Vec<TemplateSearchRow>, String>
{
    let sql = "
        SELECT t.*, g.name as group_name
        FROM templates t
        LEFT JOIN template_groups g ON t.group_id = g.id
        WHERE t.title LIKE '%' || ?1 || '%'
           OR t.content LIKE '%' || ?1 || '%'
           OR t.tags LIKE '%' || ?1 || '%'
        ORDER BY t.use_count DESC
        LIMIT ?2
    ";
    // execute...
    todo!()
}
```

---

## 5. Frontend — Key Components

### 5.1 Multi-Window Setup (Tauri 2)

```typescript
// main.tsx — Route giữa Main Window và Quick Paste popup

import { getCurrentWindow } from "@tauri-apps/api/window";

const windowLabel = getCurrentWindow().label;

if (windowLabel === "quick-paste") {
  // Render popup nhỏ
  import("./windows/QuickPaste").then(({ default: QuickPaste }) => {
    createRoot(document.getElementById("root")!).render(<QuickPaste />);
  });
} else {
  // Render full app
  import("./windows/MainWindow").then(({ default: MainWindow }) => {
    createRoot(document.getElementById("root")!).render(<MainWindow />);
  });
}
```

### 5.2 Quick Paste Popup (QUAN TRỌNG NHẤT cho UX)

```tsx
// windows/QuickPaste.tsx
// Popup nhỏ xuất hiện khi user nhấn Cmd+Shift+V
// Flow: search → chọn item → auto paste vào app đang focus → popup đóng

import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

interface SearchResult {
  id: string;
  result_type: "history" | "template";
  title: string;
  preview: string;
  score: number;
  group_name: string | null;
}

export default function QuickPaste() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus khi popup mở
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Search khi gõ (debounced)
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length === 0) {
        // Hiện recent items khi chưa gõ gì
        const recent = await invoke<SearchResult[]>("get_recent_items", {
          limit: 10,
        });
        setResults(recent);
      } else {
        const res = await invoke<SearchResult[]>("search_all", {
          query,
          limit: 15,
        });
        setResults(res);
      }
      setSelectedIdx(0);
    }, 100); // 100ms debounce — phải nhanh

    return () => clearTimeout(timer);
  }, [query]);

  // Keyboard navigation
  const handleKeyDown = async (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        await pasteItem(results[selectedIdx]);
        break;
      case "Escape":
        await getCurrentWindow().hide();
        break;
      // Cmd+1..9 → paste item tương ứng
      default:
        if (e.metaKey || e.ctrlKey) {
          const num = parseInt(e.key);
          if (num >= 1 && num <= 9 && results[num - 1]) {
            e.preventDefault();
            await pasteItem(results[num - 1]);
          }
        }
    }
  };

  const pasteItem = async (item: SearchResult) => {
    // 1. Ẩn popup trước
    await getCurrentWindow().hide();

    // 2. Đợi 50ms cho app trước đó lấy lại focus
    await new Promise((r) => setTimeout(r, 50));

    // 3. Paste vào app đang focus
    if (item.result_type === "template") {
      const content = await invoke<string>("get_template_content", {
        id: item.id,
      });
      await invoke("paste_to_active_app", { content });
    } else {
      const content = await invoke<string>("get_clip_content", {
        id: item.id,
      });
      await invoke("paste_to_active_app", { content });
    }
  };

  return (
    <div
      className="w-[560px] bg-white dark:bg-zinc-900 rounded-xl
                    shadow-2xl border border-zinc-200 dark:border-zinc-700
                    overflow-hidden"
    >
      {/* Search input */}
      <div className="p-3 border-b border-zinc-100 dark:border-zinc-800">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search clipboard & templates..."
          className="w-full bg-transparent text-base outline-none
                     text-zinc-900 dark:text-zinc-100
                     placeholder:text-zinc-400"
        />
      </div>

      {/* Results */}
      <div className="max-h-[400px] overflow-y-auto">
        {results.map((item, i) => (
          <div
            key={item.id}
            onClick={() => pasteItem(item)}
            className={`px-3 py-2 cursor-pointer flex items-start gap-3
              ${
                i === selectedIdx
                  ? "bg-blue-50 dark:bg-blue-900/30"
                  : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
          >
            {/* Shortcut number */}
            <span
              className="text-xs text-zinc-400 font-mono mt-1 w-4
                             shrink-0 text-right"
            >
              {i < 9 ? `${i + 1}` : ""}
            </span>

            {/* Type badge */}
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded mt-0.5
              shrink-0 font-medium
              ${
                item.result_type === "template"
                  ? "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300"
                  : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              {item.result_type === "template" ? "TPL" : "CLIP"}
            </span>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {item.result_type === "template" && (
                <div
                  className="text-xs font-medium text-zinc-700
                               dark:text-zinc-300 truncate"
                >
                  {item.title}
                  {item.group_name && (
                    <span className="text-zinc-400 ml-1">
                      · {item.group_name}
                    </span>
                  )}
                </div>
              )}
              <div
                className="text-sm text-zinc-600 dark:text-zinc-400
                            truncate"
              >
                {item.preview}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer hints */}
      <div
        className="px-3 py-2 border-t border-zinc-100 dark:border-zinc-800
                      flex gap-4 text-[10px] text-zinc-400"
      >
        <span>↑↓ navigate</span>
        <span>⏎ paste</span>
        <span>⌘1-9 quick paste</span>
        <span>esc close</span>
      </div>
    </div>
  );
}
```

### 5.3 AI Reformat Panel

```tsx
// components/AI/ReformatPanel.tsx

import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";

const PLATFORMS = [
  { id: "twitter", label: "Twitter/X", icon: "𝕏", maxLen: 280 },
  { id: "linkedin", label: "LinkedIn", icon: "in", maxLen: 1500 },
  { id: "email", label: "Email", icon: "✉", maxLen: null },
  { id: "facebook", label: "Facebook", icon: "f", maxLen: 800 },
];

interface ReformatResult {
  platform: string;
  reformatted: string;
  char_count: number;
  tokens_used: number;
}

export function ReformatPanel() {
  const [input, setInput] = useState("");
  const [results, setResults] = useState<ReformatResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const reformatAll = async () => {
    if (!input.trim()) return;
    setLoading(true);
    try {
      const res = await invoke<ReformatResult[]>("reformat_all_platforms", {
        text: input,
        platforms: PLATFORMS.map((p) => p.id),
      });
      setResults(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const copyResult = async (platform: string, text: string) => {
    await writeText(text);
    setCopied(platform);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Input area */}
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Paste hoặc viết nội dung gốc vào đây..."
        className="w-full h-32 p-4 resize-none border-b
                   bg-transparent text-sm outline-none"
      />

      <button
        onClick={reformatAll}
        disabled={loading || !input.trim()}
        className="mx-4 mt-3 py-2.5 rounded-lg bg-blue-600
                   text-white text-sm font-medium
                   disabled:opacity-50 hover:bg-blue-500
                   transition-colors"
      >
        {loading ? "Đang reformat..." : "Reformat cho tất cả platform"}
      </button>

      {/* Results grid */}
      <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-3">
        {results.map((r) => {
          const platform = PLATFORMS.find((p) => p.id === r.platform);
          const overLimit = platform?.maxLen && r.char_count > platform.maxLen;

          return (
            <div
              key={r.platform}
              className="border rounded-lg p-3 flex flex-col"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium">{platform?.label}</span>
                <span
                  className={`text-[10px] ${
                    overLimit ? "text-red-500" : "text-zinc-400"
                  }`}
                >
                  {r.char_count}
                  {platform?.maxLen && `/${platform.maxLen}`}
                </span>
              </div>

              <p
                className="text-sm flex-1 whitespace-pre-wrap mb-3
                          text-zinc-700 dark:text-zinc-300"
              >
                {r.reformatted}
              </p>

              <button
                onClick={() => copyResult(r.platform, r.reformatted)}
                className="text-xs py-1.5 rounded bg-zinc-100
                          dark:bg-zinc-800 hover:bg-zinc-200
                          dark:hover:bg-zinc-700 transition-colors"
              >
                {copied === r.platform ? "✓ Copied!" : "Copy"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

---

## 6. System Tray + Hotkey + Multi-Window

```rust
// main.rs

use tauri::{
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};

fn main() {
    tauri::Builder::default()
        // ── Plugins ──
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        // ── State ──
        .manage(db::init_db())
        .manage(clipboard::watcher::ClipboardWatcher::new())
        // ── Setup ──
        .setup(|app| {
            let handle = app.handle().clone();

            // ── System Tray ──
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("PasteFlow")
                .on_tray_icon_event(move |tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up, ..
                    } = event {
                        let win = tray.app_handle()
                            .get_webview_window("main").unwrap();
                        win.show().unwrap();
                        win.set_focus().unwrap();
                    }
                })
                .build(app)?;

            // ── Quick Paste Window (hidden by default) ──
            let quick_paste = tauri::WebviewWindowBuilder::new(
                app,
                "quick-paste",
                tauri::WebviewUrl::App("quick-paste.html".into()),
            )
            .title("Quick Paste")
            .inner_size(560.0, 480.0)
            .resizable(false)
            .decorations(false)          // No title bar
            .always_on_top(true)
            .center()
            .visible(false)              // Hidden until hotkey
            .build()?;

            // Ẩn khi mất focus (click ra ngoài)
            let qp = quick_paste.clone();
            quick_paste.on_window_event(move |event| {
                if let WindowEvent::Focused(false) = event {
                    let _ = qp.hide();
                }
            });

            // ── Global Hotkey: Cmd+Shift+V → toggle Quick Paste ──
            use tauri_plugin_global_shortcut::{
                GlobalShortcutExt, Shortcut, ShortcutState,
            };
            app.handle().plugin(
                tauri_plugin_global_shortcut::Builder::new()
                    .with_handler(move |_app, shortcut, event| {
                        if event.state == ShortcutState::Pressed {
                            let win = handle.get_webview_window("quick-paste")
                                .unwrap();
                            if win.is_visible().unwrap_or(false) {
                                let _ = win.hide();
                            } else {
                                let _ = win.center();
                                let _ = win.show();
                                let _ = win.set_focus();
                            }
                        }
                    })
                    .build(),
            )?;

            let shortcut: Shortcut = "CmdOrCtrl+Shift+V".parse()?;
            app.global_shortcut().register(shortcut)?;

            // ── Start Clipboard Watcher ──
            let watcher = app.state::<clipboard::watcher::ClipboardWatcher>();
            let db = app.state::<db::DbPool>();
            watcher.start(app.handle().clone(), db.inner().clone());

            Ok(())
        })
        // ── Commands ──
        .invoke_handler(tauri::generate_handler![
            clipboard::history::get_recent_items,
            clipboard::history::get_clip_content,
            clipboard::history::pin_item,
            clipboard::history::delete_item,
            clipboard::history::clear_history,
            clipboard::paste::paste_to_active_app,
            templates::crud::list_templates,
            templates::crud::create_template,
            templates::crud::update_template,
            templates::crud::delete_template,
            templates::crud::expand_template,
            templates::groups::list_groups,
            templates::groups::create_group,
            search::fuzzy::search_all,
            ai::reformat::reformat_content,
            ai::reformat::reformat_all_platforms,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## 7. Dependencies

### Cargo.toml

```toml
[dependencies]
tauri = { version = "2", features = ["tray-icon"] }
tauri-plugin-clipboard-manager = "2"
tauri-plugin-global-shortcut = "2"
tauri-plugin-autostart = "2"
tauri-plugin-fs = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
rusqlite = { version = "0.31", features = ["bundled"] }
arboard = "3"            # Cross-platform clipboard (read/write/image)
reqwest = { version = "0.12", features = ["json"] }  # HTTP cho AI API
tokio = { version = "1", features = ["full"] }
uuid = { version = "1", features = ["v4"] }
chrono = { version = "0.4", features = ["serde"] }
open = "5"
```

### package.json

```json
{
  "dependencies": {
    "@tauri-apps/api": "^2",
    "@tauri-apps/plugin-clipboard-manager": "^2",
    "@tauri-apps/plugin-global-shortcut": "^2",
    "@tauri-apps/plugin-autostart": "^2",
    "react": "^18",
    "react-dom": "^18",
    "zustand": "^4",
    "lucide-react": "^0.383",
    "cmdk": "^1"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2",
    "typescript": "^5",
    "vite": "^5",
    "tailwindcss": "^3",
    "@vitejs/plugin-react": "^4"
  }
}
```

---

## 8. User Flow chính

```
═══════════════════════════════════════════════════
  FLOW 1: Quick Paste (80% use case hàng ngày)
═══════════════════════════════════════════════════

User đang viết email trong Gmail
    │
    ├─→ Nhấn Cmd+Shift+V
    ├─→ Quick Paste popup xuất hiện (center screen)
    ├─→ Gõ "proposal" → thấy template "Upwork Proposal"
    ├─→ Nhấn Enter (hoặc ⌘1)
    ├─→ Popup ẩn → template được paste vào Gmail
    └─→ Tổng thời gian: ~2 giây (vs 30-60 giây trước đây)

═══════════════════════════════════════════════════
  FLOW 2: AI Reformat
═══════════════════════════════════════════════════

User viết xong 1 bài blog
    │
    ├─→ Select toàn bộ text → Copy (Cmd+C)
    ├─→ Mở PasteFlow main window (hoặc Cmd+Shift+R)
    ├─→ Text tự động fill vào Reformat panel
    ├─→ Click "Reformat cho tất cả platform"
    │     ├─→ Twitter:  280-char version với hook + hashtag
    │     ├─→ LinkedIn: Professional version với storytelling
    │     ├─→ Facebook: Casual version với emoji
    │     └─→ Email:    Newsletter version với subject line
    ├─→ Click "Copy" trên Twitter card
    ├─→ Switch sang Twitter → Paste → Post
    └─→ Tiết kiệm: 10 phút → 30 giây

═══════════════════════════════════════════════════
  FLOW 3: Background Clipboard History
═══════════════════════════════════════════════════

PasteFlow chạy background (system tray)
    │
    ├─→ User copy link từ Chrome      → saved
    ├─→ User copy code từ VS Code     → saved
    ├─→ User copy text từ Slack       → saved
    ├─→ 30 phút sau, cần link đó lại
    ├─→ Cmd+Shift+V → gõ vài ký tự → tìm thấy
    └─→ Không bao giờ mất clipboard nữa
```

---

## 9. Cleanup & Performance

```rust
// Chạy mỗi 24h: dọn history cũ, giữ pinned items

#[tauri::command]
pub async fn cleanup_old_history(
    db: tauri::State<'_, DbPool>,
) -> Result<u64, String> {
    let max_items: i64 = get_setting(&db, "max_history_items")?
        .parse().unwrap_or(5000);

    let deleted = db.execute(
        "DELETE FROM clipboard_items
         WHERE is_pinned = 0
         AND id NOT IN (
             SELECT id FROM clipboard_items
             ORDER BY created_at DESC
             LIMIT ?1
         )",
        [max_items],
    ).map_err(|e| e.to_string())?;

    // Xoá ảnh orphan
    cleanup_orphan_images(&db)?;

    // VACUUM để thu hồi disk space
    db.execute("VACUUM", []).map_err(|e| e.to_string())?;

    Ok(deleted as u64)
}
```

---

## 10. Build & Release

```bash
# Dev
npm run tauri dev

# Build production
npm run tauri build

# Output:
#   macOS: target/release/bundle/dmg/PasteFlow.dmg
#   Windows: target/release/bundle/nsis/PasteFlow-Setup.exe

# Auto-update (thêm sau MVP):
# Dùng tauri-plugin-updater + GitHub Releases
```

---

## 11. Monetization Integration

```
Free tier:
  - Clipboard history: 50 items
  - Templates: 5
  - AI reformat: 0 (disabled)

Pro tier ($6/month):
  - Clipboard history: unlimited (5000 default)
  - Templates: unlimited
  - AI reformat: 100 calls/month
  - Custom hotkeys
  - Auto-start on login

Lifetime ($39):
  - Everything in Pro
  - Forever

Implementation:
  - LemonSqueezy / Gumroad cho payment
  - License key validation (offline-first):
    1. User mua → nhận license key
    2. App gọi API validate key 1 lần
    3. Lưu encrypted license vào SQLite
    4. Check local mỗi khi mở app (30-day grace period nếu offline)
  - Không cần server riêng cho MVP
```
