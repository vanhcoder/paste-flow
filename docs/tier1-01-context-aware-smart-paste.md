# Feature 01: Context-Aware Smart Paste

> **Tier:** 1 — Build ngay vào MVP
> **Thời gian:** 3-4 ngày
> **Độ khó:** ⭐⭐⭐ (Medium)
> **Competitor:** 0 (Chỉ CmdOS có smart paste cho Excel, không có context-aware)

---

## 1. Mô tả tính năng

PasteFlow tự detect app đang focus → auto-transform content cho phù hợp trước khi paste.

**Ví dụ cụ thể:**

| Copy từ | Paste vào | Transform |
|---------|-----------|-----------|
| URL raw | Slack / Discord | `[title](url)` markdown link |
| URL raw | Email client | `<a href="url">title</a>` hyperlink |
| Code snippet | Gmail / Outlook | Wrap trong ``` code block |
| Bảng từ web | Excel / Sheets | Tab-separated values (TSV) |
| Text từ PDF | Bất kỳ đâu | Strip line breaks giữa paragraph |
| JSON raw | VS Code | Auto-format + indent |
| Màu hex (#FF5733) | Figma | Giữ nguyên hex |
| Màu hex (#FF5733) | Slack | Thêm color preview emoji 🟧 #FF5733 |
| Nhiều dòng text | Terminal | Join thành 1 dòng (tránh execute nhiều command) |

---

## 2. Pain Point cụ thể

### Freelancer / Creator:
- Copy text từ web → paste vào Google Docs → mang theo font, size, color rác
- Copy link từ Chrome → paste vào Slack → chỉ hiện raw URL dài loằng ngoằng
- Copy bảng price từ website → paste vào Excel → tất cả dồn vào 1 cell

### Developer:
- Copy code → paste vào email cho client → mất indentation, không có syntax highlight
- Copy JSON từ API response → paste vào editor → 1 dòng dài không đọc được
- Copy multi-line command → paste vào terminal → execute từng dòng riêng lẻ (nguy hiểm)

### MMO / Seller:
- Copy product description → paste vào Shopee listing → format hoàn toàn khác
- Copy giá từ spreadsheet → paste vào chat → mất format số (1,000,000 → 1000000)

---

## 3. Technical Architecture

### 3.1 Detect Active App

```rust
// src-tauri/src/system/active_app.rs

#[cfg(target_os = "macos")]
pub fn get_active_app() -> Option<AppInfo> {
    use std::process::Command;
    let output = Command::new("osascript")
        .args(["-e", r#"
            tell application "System Events"
                set frontApp to first application process whose frontmost is true
                return {name of frontApp, bundle identifier of frontApp}
            end tell
        "#])
        .output().ok()?;

    let raw = String::from_utf8_lossy(&output.stdout);
    let parts: Vec<&str> = raw.trim().split(", ").collect();

    Some(AppInfo {
        name: parts.get(0)?.to_string(),
        bundle_id: parts.get(1).map(|s| s.to_string()),
    })
}

#[cfg(target_os = "windows")]
pub fn get_active_app() -> Option<AppInfo> {
    use std::process::Command;
    let output = Command::new("powershell")
        .args(["-Command", r#"
            $proc = Get-Process | Where-Object {
                $_.MainWindowHandle -eq (
                    Add-Type -MemberDefinition '
                        [DllImport("user32.dll")]
                        public static extern IntPtr GetForegroundWindow();
                    ' -Name WinAPI -PassThru
                )::GetForegroundWindow()
            }
            "$($proc.ProcessName)|$($proc.MainModule.FileName)"
        "#])
        .output().ok()?;

    let raw = String::from_utf8_lossy(&output.stdout);
    let parts: Vec<&str> = raw.trim().split('|').collect();

    Some(AppInfo {
        name: parts.get(0)?.to_string(),
        bundle_id: parts.get(1).map(|s| s.to_string()),
    })
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct AppInfo {
    pub name: String,
    pub bundle_id: Option<String>,
}
```

### 3.2 Transform Rules Engine

```rust
// src-tauri/src/clipboard/transforms.rs

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransformRule {
    pub id: String,
    pub app_pattern: String,      // regex match app name/bundle_id
    pub content_type: ContentType, // what kind of content was copied
    pub transform: TransformAction,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ContentType {
    Url,
    Email,
    Code,
    Json,
    Table,         // tab/comma separated
    MultiLine,
    HexColor,
    PhoneNumber,
    PlainText,
    Any,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TransformAction {
    MarkdownLink,          // URL → [title](url)
    HtmlLink,              // URL → <a href>
    StripFormatting,       // Remove HTML/RTF
    StripLineBreaks,       // Join paragraph lines
    FormatJson,            // Pretty print JSON
    WrapCodeBlock,         // ``` ... ```
    TabSeparate,           // HTML table → TSV
    JoinSingleLine,        // Multi-line → single line
    FormatCurrency,        // 1000000 → 1,000,000
    NoTransform,           // Passthrough
    Custom(String),        // User-defined regex replace
}

// Detect content type from clipboard text
pub fn detect_content_type(text: &str) -> ContentType {
    let trimmed = text.trim();

    // URL
    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        if trimmed.lines().count() == 1 {
            return ContentType::Url;
        }
    }

    // Email
    let email_re = regex::Regex::new(
        r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    ).unwrap();
    if email_re.is_match(trimmed) {
        return ContentType::Email;
    }

    // Hex Color
    let color_re = regex::Regex::new(r"^#[0-9a-fA-F]{3,8}$").unwrap();
    if color_re.is_match(trimmed) {
        return ContentType::HexColor;
    }

    // JSON
    if (trimmed.starts_with('{') && trimmed.ends_with('}'))
        || (trimmed.starts_with('[') && trimmed.ends_with(']'))
    {
        if serde_json::from_str::<serde_json::Value>(trimmed).is_ok() {
            return ContentType::Json;
        }
    }

    // Table (tab-separated or HTML table)
    if trimmed.contains('\t') && trimmed.lines().count() > 1 {
        return ContentType::Table;
    }
    if trimmed.contains("<table") || trimmed.contains("<tr") {
        return ContentType::Table;
    }

    // Code (heuristic: contains common code patterns)
    let code_indicators = [
        "function ", "const ", "let ", "var ", "import ",
        "def ", "class ", "return ", "if (", "for (",
        "=>", "->", "::", "#!/", "SELECT ", "INSERT ",
    ];
    let indicator_count = code_indicators.iter()
        .filter(|&ind| trimmed.contains(ind))
        .count();
    if indicator_count >= 2 {
        return ContentType::Code;
    }

    // Multi-line
    if trimmed.lines().count() > 1 {
        return ContentType::MultiLine;
    }

    ContentType::PlainText
}

// Apply transform to text
pub fn apply_transform(text: &str, action: &TransformAction) -> String {
    match action {
        TransformAction::MarkdownLink => {
            // Fetch page title would be async, fallback to URL
            format!("[Link]({})", text.trim())
        }

        TransformAction::HtmlLink => {
            format!(r#"<a href="{}">{}</a>"#, text.trim(), text.trim())
        }

        TransformAction::StripFormatting => {
            // Remove HTML tags
            let re = regex::Regex::new(r"<[^>]+>").unwrap();
            re.replace_all(text, "").to_string()
        }

        TransformAction::StripLineBreaks => {
            // Join lines that are part of same paragraph
            // Keep double newlines as paragraph breaks
            text.replace("\r\n", "\n")
                .split("\n\n")
                .map(|para| para.lines().collect::<Vec<_>>().join(" "))
                .collect::<Vec<_>>()
                .join("\n\n")
        }

        TransformAction::FormatJson => {
            match serde_json::from_str::<serde_json::Value>(text) {
                Ok(v) => serde_json::to_string_pretty(&v)
                    .unwrap_or_else(|_| text.to_string()),
                Err(_) => text.to_string(),
            }
        }

        TransformAction::WrapCodeBlock => {
            format!("```\n{}\n```", text.trim())
        }

        TransformAction::JoinSingleLine => {
            text.lines()
                .map(|l| l.trim())
                .filter(|l| !l.is_empty())
                .collect::<Vec<_>>()
                .join(" ")
        }

        TransformAction::TabSeparate => {
            // Basic HTML table → TSV conversion
            let re_row = regex::Regex::new(r"<tr[^>]*>(.*?)</tr>").unwrap();
            let re_cell = regex::Regex::new(r"<t[dh][^>]*>(.*?)</t[dh]>").unwrap();
            let re_tag = regex::Regex::new(r"<[^>]+>").unwrap();

            re_row.captures_iter(text)
                .map(|row| {
                    re_cell.captures_iter(&row[1])
                        .map(|cell| re_tag.replace_all(&cell[1], "").trim().to_string())
                        .collect::<Vec<_>>()
                        .join("\t")
                })
                .collect::<Vec<_>>()
                .join("\n")
        }

        TransformAction::FormatCurrency => {
            // Add thousand separators
            let re = regex::Regex::new(r"(\d)(?=(\d{3})+(?!\d))").unwrap();
            re.replace_all(text, "$1,").to_string()
        }

        TransformAction::NoTransform => text.to_string(),

        TransformAction::Custom(pattern) => {
            // User-defined: "s/find/replace/g" style
            // Parse and apply regex replacement
            text.to_string() // TODO: implement custom regex
        }
    }
}
```

### 3.3 Default Rules Map

```rust
// src-tauri/src/clipboard/default_rules.rs

pub fn get_default_rules() -> Vec<TransformRule> {
    vec![
        // ── Slack / Discord ──
        TransformRule {
            id: "url-to-slack".into(),
            app_pattern: r"(?i)(slack|discord)".into(),
            content_type: ContentType::Url,
            transform: TransformAction::MarkdownLink,
            enabled: true,
        },
        TransformRule {
            id: "code-to-slack".into(),
            app_pattern: r"(?i)(slack|discord|teams)".into(),
            content_type: ContentType::Code,
            transform: TransformAction::WrapCodeBlock,
            enabled: true,
        },

        // ── Email clients ──
        TransformRule {
            id: "url-to-email".into(),
            app_pattern: r"(?i)(mail|outlook|thunderbird|gmail)".into(),
            content_type: ContentType::Url,
            transform: TransformAction::HtmlLink,
            enabled: true,
        },
        TransformRule {
            id: "code-to-email".into(),
            app_pattern: r"(?i)(mail|outlook|thunderbird|gmail)".into(),
            content_type: ContentType::Code,
            transform: TransformAction::WrapCodeBlock,
            enabled: true,
        },

        // ── Spreadsheet apps ──
        TransformRule {
            id: "table-to-excel".into(),
            app_pattern: r"(?i)(excel|sheets|numbers|calc)".into(),
            content_type: ContentType::Table,
            transform: TransformAction::TabSeparate,
            enabled: true,
        },

        // ── Terminal ──
        TransformRule {
            id: "multiline-to-terminal".into(),
            app_pattern: r"(?i)(terminal|iterm|warp|cmd|powershell|hyper|alacritty|kitty)".into(),
            content_type: ContentType::MultiLine,
            transform: TransformAction::JoinSingleLine,
            enabled: true,
        },

        // ── Code editors ──
        TransformRule {
            id: "json-to-editor".into(),
            app_pattern: r"(?i)(code|sublime|atom|intellij|webstorm|cursor)".into(),
            content_type: ContentType::Json,
            transform: TransformAction::FormatJson,
            enabled: true,
        },

        // ── PDF text cleanup (any app) ──
        TransformRule {
            id: "pdf-linebreak-fix".into(),
            app_pattern: r".*".into(), // any app
            content_type: ContentType::MultiLine,
            transform: TransformAction::StripLineBreaks,
            enabled: false, // user opt-in
        },
    ]
}
```

### 3.4 Integration vào Paste Flow

```rust
// Modify paste_to_active_app to include context-aware transform

#[tauri::command]
pub async fn smart_paste(
    db: tauri::State<'_, Arc<DbPool>>,
    content: String,
    use_smart_transform: bool,
) -> Result<PasteResult, String> {
    let mut final_content = content.clone();
    let mut transform_applied = None;

    if use_smart_transform {
        // 1. Detect active app
        if let Some(app_info) = get_active_app() {
            // 2. Detect content type
            let content_type = detect_content_type(&content);

            // 3. Find matching rule
            let rules = load_rules(&db)?; // user rules + defaults
            if let Some(rule) = find_matching_rule(&rules, &app_info, &content_type) {
                // 4. Apply transform
                final_content = apply_transform(&content, &rule.transform);
                transform_applied = Some(rule.id.clone());
            }
        }
    }

    // 5. Set clipboard and paste
    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.set_text(&final_content).map_err(|e| e.to_string())?;
    std::thread::sleep(std::time::Duration::from_millis(50));
    simulate_paste_keystroke()?;

    Ok(PasteResult {
        original_length: content.len(),
        final_length: final_content.len(),
        transform_applied,
    })
}
```

---

## 4. Frontend UI

### 4.1 Transform indicator trong Quick Paste popup

```
┌─────────────────────────────────────────────┐
│ 🔍 Search clipboard & templates...          │
├─────────────────────────────────────────────┤
│ ⚡ Smart Paste ON → Pasting to: Slack       │
│    URL will be converted to markdown link    │
├─────────────────────────────────────────────┤
│ 1  📋 https://figma.com/file/abc...         │
│    → Will paste as: [Figma](https://...)    │
│                                              │
│ 2  📋 const handleClick = () => {           │
│    → Will paste as: ```code block```        │
│                                              │
│ 3  📋 meeting notes from yesterday          │
│    → No transform needed                    │
└─────────────────────────────────────────────┘
```

### 4.2 Settings UI cho Rules

```
┌─────────────────────────────────────────────┐
│ Smart Paste Rules                            │
├─────────────────────────────────────────────┤
│ ✅ URL → Markdown link (Slack, Discord)     │
│ ✅ Code → Code block (Slack, Email)         │
│ ✅ Table → TSV (Excel, Sheets)              │
│ ✅ Multi-line → Single line (Terminal)       │
│ ✅ JSON → Pretty format (VS Code)           │
│ ☐  Strip line breaks (All apps) [disabled]  │
│                                              │
│ [+ Add custom rule]                          │
└─────────────────────────────────────────────┘
```

---

## 5. Database Schema Addition

```sql
CREATE TABLE IF NOT EXISTS transform_rules (
    id           TEXT PRIMARY KEY,
    app_pattern  TEXT NOT NULL,
    content_type TEXT NOT NULL,
    transform    TEXT NOT NULL,     -- JSON serialized TransformAction
    enabled      INTEGER DEFAULT 1,
    is_default   INTEGER DEFAULT 0, -- built-in vs user-created
    use_count    INTEGER DEFAULT 0,
    created_at   TEXT DEFAULT (datetime('now','localtime'))
);
```

---

## 6. Build Steps

```
Ngày 1:
  ✅ Implement get_active_app() cho macOS + Windows
  ✅ Implement detect_content_type()
  ✅ Test detection accuracy với 20+ samples

Ngày 2:
  ✅ Implement tất cả TransformAction variants
  ✅ Tạo default rules map
  ✅ Unit test mỗi transform

Ngày 3:
  ✅ Integrate vào smart_paste command
  ✅ Frontend: hiện transform preview trong Quick Paste
  ✅ Settings UI cho enable/disable rules

Ngày 4:
  ✅ Custom rule editor (add/edit/delete)
  ✅ Test end-to-end trên cả 2 OS
  ✅ Edge cases: empty clipboard, binary content, huge text
```

---

## 7. Metrics

- **Adoption target:** 70% users bật Smart Paste (default ON)
- **Success metric:** Giảm 50% số lần user phải sửa format sau paste
- **Upsell:** Custom rules chỉ có trong Pro tier
