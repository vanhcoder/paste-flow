# PasteFlow — Agent Context

> Tài liệu này cung cấp context tổng hợp cho AI agents khi làm việc với codebase PasteFlow.

---

## Tổng quan dự án

PasteFlow là một **clipboard manager thông minh** dạng desktop app, xây trên **Tauri 2 + React + TypeScript** (backend Rust, frontend React). App có 3 chức năng chính:

1. **Clipboard History** — Tự động lưu mọi thứ user copy, hiển thị history, pin/favorite, search lại.
2. **Template Manager** — Tạo/quản lý text templates có biến `{{variable}}`, nhóm theo group, paste nhanh.
3. **AI Reformat** — Dùng LLM API (OpenAI) để rewrite text cho nhiều platform (Twitter, LinkedIn, Email, Facebook) cùng lúc.

### 3 chế độ UI

| Chế độ | Mô tả |
|---|---|
| **Main Window** | Quản lý template, xem history, settings. Full app UI với sidebar navigation. |
| **Quick Paste Popup** | `Cmd+Shift+V` → overlay nhỏ center screen, search + chọn + tự paste vào app đang focus. |
| **System Tray** | App chạy background, luôn monitor clipboard. Click tray icon = show main window. |

---

## Tech Stack

| Layer | Công nghệ |
|---|---|
| Framework | Tauri 2 |
| Backend | Rust |
| Frontend | React + TypeScript |
| State Management | Zustand |
| Database | SQLite (rusqlite, WAL mode) |
| Styling | TailwindCSS |
| Bundler | Vite |
| AI | OpenAI API (gpt-4o-mini mặc định) |
| Clipboard | arboard crate (cross-platform) |
| Search | SQL LIKE (MVP), FTS5 sau |

---

## Project Structure

```
pasteflow/
├── src-tauri/                          # Rust backend
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/
│   │   └── default.json                # Tauri permissions
│   └── src/
│       ├── main.rs                     # Entry, setup tray + hotkey + watcher
│       ├── lib.rs                      # Register all commands
│       ├── db.rs                       # SQLite init + migrations (WAL mode)
│       ├── clipboard/
│       │   ├── mod.rs
│       │   ├── watcher.rs              # Polling clipboard mỗi 500ms
│       │   ├── history.rs              # Lưu/query history (CRUD + pin/favorite)
│       │   └── paste.rs                # Simulate paste (Cmd+V / Ctrl+V) vào app đang focus
│       ├── templates/
│       │   ├── mod.rs
│       │   ├── crud.rs                 # CRUD templates + variable expansion
│       │   └── groups.rs               # Nhóm template (Social, Client, Code...)
│       ├── ai/
│       │   ├── mod.rs
│       │   ├── reformat.rs             # Gọi LLM API, batch reformat nhiều platform
│       │   └── prompts.rs              # Prompt template cho từng platform
│       ├── search/
│       │   ├── mod.rs
│       │   └── fuzzy.rs                # Search qua history + templates
│       └── system/
│           ├── mod.rs
│           ├── hotkey.rs               # Global shortcut registration
│           ├── tray.rs                 # System tray menu
│           ├── autostart.rs            # Launch on login
│           └── license.rs              # LemonSqueezy license validation
│
├── src/                                # React frontend
│   ├── main.tsx                        # Entry, route theo window label
│   ├── App.tsx
│   ├── windows/
│   │   ├── MainWindow.tsx              # Full app UI (sidebar + content)
│   │   └── QuickPaste.tsx              # Popup overlay (Cmd+Shift+V)
│   ├── stores/
│   │   ├── clipboardStore.ts           # Zustand store cho clipboard history
│   │   ├── templateStore.ts
│   │   ├── searchStore.ts
│   │   └── settingsStore.ts
│   ├── components/
│   │   ├── History/
│   │   │   ├── HistoryList.tsx
│   │   │   ├── HistoryItem.tsx
│   │   │   └── HistoryFilter.tsx
│   │   ├── Templates/
│   │   │   ├── TemplateManager.tsx
│   │   │   ├── TemplateGroup.tsx
│   │   │   └── TemplateEditor.tsx
│   │   ├── QuickPaste/
│   │   │   ├── SearchBar.tsx
│   │   │   ├── ResultList.tsx
│   │   │   └── ReformatPreview.tsx
│   │   ├── AI/
│   │   │   ├── ReformatPanel.tsx
│   │   │   ├── PlatformSelector.tsx
│   │   │   └── OutputCard.tsx
│   │   └── Settings/
│   │       ├── General.tsx
│   │       ├── AIConfig.tsx
│   │       └── Sync.tsx
│   ├── lib/
│   │   ├── tauri.ts                    # Type-safe invoke wrappers (api object)
│   │   └── constants.ts
│   └── styles/
│       └── globals.css
│
├── docs/
│   ├── pasteflow-architecture.md       # Kiến trúc chi tiết + code mẫu đầy đủ
│   └── pasteflow-implementation-plan.md # Kế hoạch triển khai theo 8 phases
│
├── AGENTS.md                           # (file này)
└── README.md
```

---

## Database Schema (SQLite)

### Bảng chính

| Bảng | Mục đích |
|---|---|
| `clipboard_items` | Lưu history. Có `content_type` (text/image/html/file), `content_text`, `content_preview` (200 ký tự), `source_app`, `is_pinned`, `is_favorite`, `use_count`. |
| `template_groups` | Nhóm template. Có `name`, `icon` (emoji), `color` (hex), `sort_order`. |
| `templates` | Templates. Có `title`, `content`, `shortcut`, `tags` (JSON array), `variables` (JSON array `["{{client_name}}"]`). |
| `reformat_history` | Lịch sử AI reformat. Có `original_text`, `platform`, `reformatted`, `model_used`, `tokens_used`. |
| `settings` | Key-value settings. Mặc định: `max_history_items=5000`, `clipboard_poll_ms=500`, `hotkey_quick_paste=CmdOrCtrl+Shift+V`, `ai_model=gpt-4o-mini`. |

---

## Rust Commands (IPC Bridge)

Tất cả commands được gọi từ frontend qua `invoke()`:

### Clipboard
- `get_recent_items(limit?)` → `Vec<ClipboardItem>`
- `get_clip_content(id)` → `String` (tăng use_count)
- `pin_item(id, pinned)` → `()`
- `delete_item(id)` → `()`
- `clear_history()` → `u64` (số items đã xóa, giữ pinned)
- `paste_to_active_app(content)` → `()` (set clipboard + simulate Ctrl+V)

### Templates
- `list_groups()` → `Vec<TemplateGroup>`
- `create_group(name, icon, color)` → `TemplateGroup`
- `list_templates(group_id?)` → `Vec<Template>`
- `create_template(group_id?, title, content, shortcut?, tags?)` → `Template`
- `update_template(id, title?, content?, group_id?, shortcut?, tags?)` → `()`
- `delete_template(id)` → `()`
- `expand_template(template_id, variable_values)` → `String`

### Search
- `search_all(query, limit?)` → `Vec<SearchResult>` (templates ưu tiên > history)

### AI
- `reformat_content(request: ReformatRequest)` → `ReformatResult`
- `reformat_all_platforms(text, platforms)` → `Vec<ReformatResult>`

### Settings
- `get_setting(key)` → `String`
- `set_setting(key, value)` → `()`
- `validate_license(license_key)` → `LicenseInfo`

### System
- `toggle_autostart(enabled)` → `()`
- `cleanup_old_history()` → `u64`

---

## Kiến trúc quan trọng

### Clipboard Watcher
- Polling mỗi 500ms trên **background thread** (không block main).
- So sánh text mới vs `last_text` → nếu khác + không rỗng + < 1MB → lưu DB + emit event `clipboard-changed`.
- Frontend listen event → reload list.

### Quick Paste Flow
1. User nhấn `Cmd+Shift+V` → popup hiện (center, always-on-top, no decorations)
2. Input auto-focus, gõ text → debounce 100ms → `search_all()`
3. Arrow keys navigate, Enter = chọn
4. Popup hide → đợi 50ms → `paste_to_active_app(content)` → simulate Cmd+V vào app trước đó
5. `Cmd+1..9` = quick paste by index

### Multi-Window
- `main.tsx` check `getCurrentWindow().label`:
  - `"main"` → render `MainWindow`
  - `"quick-paste"` → render `QuickPaste`
- Quick Paste window: `visible: false`, `decorations: false`, `always_on_top: true`, ẩn khi mất focus.

### AI Reformat
- `build_platform_prompt()` tạo system prompt riêng cho mỗi platform (Twitter 280 chars, LinkedIn hook + CTA, Email subject + body, Facebook casual + emoji).
- `reformat_all_platforms()` chạy song song cho tất cả platforms.
- Kết quả lưu vào `reformat_history`.

### System Tray
- Tray menu: Show PasteFlow | Quick Paste (⌘⇧V) | Quit
- Click tray icon (left) = show main window
- Đóng main window = hide (không quit), app tiếp tục chạy background.

---

## Dependencies

### Rust (Cargo.toml)
- `tauri 2` (tray-icon feature), `tauri-plugin-clipboard-manager`, `tauri-plugin-global-shortcut`, `tauri-plugin-autostart`, `tauri-plugin-fs`
- `arboard 3`, `rusqlite` (bundled), `reqwest` (json), `tokio` (full)
- `serde`, `serde_json`, `uuid` (v4), `chrono` (serde), `regex`, `open 5`

### Frontend (package.json)
- `@tauri-apps/api ^2`, `@tauri-apps/plugin-clipboard-manager ^2`, `@tauri-apps/plugin-global-shortcut ^2`, `@tauri-apps/plugin-autostart ^2`
- `react ^18`, `react-dom ^18`, `zustand ^4`, `lucide-react`, `cmdk ^1`
- Dev: `@tauri-apps/cli ^2`, `typescript ^5`, `vite ^5`, `tailwindcss ^3`, `@vitejs/plugin-react ^4`

---

## Monetization

| Tier | Giá | Tính năng |
|---|---|---|
| Free | $0 | 50 history items, 5 templates, no AI |
| Pro | $6/tháng | Unlimited history (5000 mặc định), unlimited templates, 100 AI calls/tháng, custom hotkeys, auto-start |
| Lifetime | $39 | Everything in Pro, forever |

Payment qua LemonSqueezy. License key validate qua API, lưu encrypted vào SQLite, grace period 30 ngày offline.

---

## Tài liệu chi tiết

| File | Nội dung |
|---|---|
| [docs/pasteflow-architecture.md](docs/pasteflow-architecture.md) | Kiến trúc tổng thể, code mẫu đầy đủ cho tất cả modules (Rust + React), DB schema, dependencies, user flows |
| [docs/pasteflow-implementation-plan.md](docs/pasteflow-implementation-plan.md) | Kế hoạch triển khai 8 phases (6 tuần), từ setup môi trường đến launch, bao gồm CI/CD, landing page, payment |

---

## Quy ước code

- **Rust**: mỗi module trong folder riêng (`clipboard/`, `templates/`, `ai/`, `search/`, `system/`), mỗi folder có `mod.rs`.
- **Frontend**: components theo feature folder (`History/`, `Templates/`, `QuickPaste/`, `AI/`, `Settings/`).
- **State**: dùng Zustand store per-feature (`clipboardStore`, `templateStore`, ...).
- **IPC**: tất cả frontend → backend call qua `api` object trong `src/lib/tauri.ts` (type-safe wrappers).
- **DB**: SQLite WAL mode, migrations trong `db.rs`, dùng `rusqlite::params![]`.
- **Platform-specific**: dùng `#[cfg(target_os = "...")]` cho macOS/Windows/Linux differences.
