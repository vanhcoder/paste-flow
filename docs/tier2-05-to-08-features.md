# Tier 2 Features — Build sau MVP (Tháng 2-3)

---

# Feature 05: Clipboard Workflows / Automation Rules

> **Thời gian:** 5-7 ngày | **Độ khó:** ⭐⭐⭐⭐ (Hard) | **Competitor:** 0

---

## 1. Mô tả

IFTTT / Zapier cho clipboard. User tạo rule dạng:

**WHEN** [trigger] → **THEN** [action]

**Ví dụ thực tế:**

| Trigger | Action | Use case |
|---------|--------|----------|
| Copy URL chứa "shopee.com" | Auto thêm `?affiliate_id=xxx` | Affiliate marketer |
| Copy URL chứa "utm_" | Lưu vào file tracking_urls.csv | Campaign manager |
| Copy text > 500 từ | Auto summarize bằng AI | Content researcher |
| Copy từ app "Figma" | Auto lưu vào folder "Design/" | Designer |
| Copy email address | Auto add vào Google Sheet "Leads" | Sales |
| Copy chứa "invoice" | Auto tạo template invoice | Freelancer |
| Copy tracking number | Auto mở tracking page | E-commerce |
| Copy code snippet | Auto format + lưu vào snippets | Developer |
| Copy bất kỳ lúc 18:00-06:00 | Không lưu history (privacy) | Personal |

---

## 2. Technical Architecture

### 2.1 Rule Engine

```rust
// src-tauri/src/workflows/mod.rs

use serde::{Deserialize, Serialize};
use regex::Regex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowRule {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    pub trigger: Trigger,
    pub actions: Vec<Action>,
    pub run_count: u32,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Trigger {
    ContentContains(String),        // text chứa substring
    ContentMatches(String),         // regex match
    ContentType(String),            // "url", "email", "code"...
    SourceApp(String),              // copy từ app cụ thể
    ContentLength { min: usize, max: Option<usize> },
    TimeRange { start_hour: u8, end_hour: u8 },
    Combined(Vec<Trigger>),         // AND nhiều triggers
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Action {
    AppendToClipboard(String),      // Thêm text vào cuối
    PrependToClipboard(String),     // Thêm text vào đầu
    ReplaceInClipboard {
        find: String,
        replace: String,
    },
    SaveToFile(String),             // Append vào file
    CopyToFolder {
        folder: String,
        filename_pattern: String,   // "{{date}}_{{time}}.txt"
    },
    ApplyTransform(String),         // transform_id từ Feature 04
    SendNotification(String),       // Desktop notification
    AddTag(String),                 // Tag clipboard item
    AutoPin,                        // Pin item tự động
    SkipHistory,                    // Không lưu vào history
    OpenUrl(String),                // Open URL (có thể dùng {{clipboard}})
    RunAiReformat {
        platform: String,
        auto_copy: bool,
    },
    RunShellCommand(String),        // Advanced: chạy command
    SendToWebhook(String),          // POST clipboard content tới URL
}

// Evaluate trigger against clipboard content
pub fn evaluate_trigger(
    trigger: &Trigger,
    content: &str,
    source_app: Option<&str>,
    content_type: &str,
) -> bool {
    match trigger {
        Trigger::ContentContains(s) =>
            content.to_lowercase().contains(&s.to_lowercase()),

        Trigger::ContentMatches(pattern) =>
            Regex::new(pattern).map(|re| re.is_match(content)).unwrap_or(false),

        Trigger::ContentType(t) => content_type == t,

        Trigger::SourceApp(app) =>
            source_app.map(|s| s.to_lowercase().contains(&app.to_lowercase()))
                .unwrap_or(false),

        Trigger::ContentLength { min, max } => {
            let len = content.len();
            len >= *min && max.map(|m| len <= m).unwrap_or(true)
        }

        Trigger::TimeRange { start_hour, end_hour } => {
            let now = chrono::Local::now().hour() as u8;
            if start_hour <= end_hour {
                now >= *start_hour && now < *end_hour
            } else {
                now >= *start_hour || now < *end_hour
            }
        }

        Trigger::Combined(triggers) =>
            triggers.iter().all(|t| evaluate_trigger(t, content, source_app, content_type)),
    }
}

// Execute action
pub fn execute_action(
    action: &Action,
    content: &str,
    clipboard: &mut arboard::Clipboard,
) -> Result<ActionResult, String> {
    match action {
        Action::AppendToClipboard(suffix) => {
            let new_content = format!("{}{}", content, suffix);
            clipboard.set_text(&new_content).map_err(|e| e.to_string())?;
            Ok(ActionResult::Modified(new_content))
        }

        Action::PrependToClipboard(prefix) => {
            let new_content = format!("{}{}", prefix, content);
            clipboard.set_text(&new_content).map_err(|e| e.to_string())?;
            Ok(ActionResult::Modified(new_content))
        }

        Action::ReplaceInClipboard { find, replace } => {
            let new_content = content.replace(find.as_str(), replace.as_str());
            clipboard.set_text(&new_content).map_err(|e| e.to_string())?;
            Ok(ActionResult::Modified(new_content))
        }

        Action::SaveToFile(path) => {
            use std::io::Write;
            let expanded = expand_variables(path, content);
            let mut file = std::fs::OpenOptions::new()
                .create(true).append(true)
                .open(&expanded).map_err(|e| e.to_string())?;
            writeln!(file, "{}", content).map_err(|e| e.to_string())?;
            Ok(ActionResult::Saved(expanded))
        }

        Action::SendNotification(msg) => {
            let expanded = expand_variables(msg, content);
            // Use tauri notification plugin
            Ok(ActionResult::Notified(expanded))
        }

        Action::AutoPin => Ok(ActionResult::Pinned),
        Action::SkipHistory => Ok(ActionResult::Skipped),

        Action::ApplyTransform(transform_id) => {
            let result = super::text_transforms::transform_text(content, transform_id)?;
            clipboard.set_text(&result).map_err(|e| e.to_string())?;
            Ok(ActionResult::Modified(result))
        }

        Action::SendToWebhook(url) => {
            // Async HTTP POST
            Ok(ActionResult::WebhookSent(url.clone()))
        }

        _ => Ok(ActionResult::NoOp),
    }
}

fn expand_variables(template: &str, content: &str) -> String {
    let now = chrono::Local::now();
    template
        .replace("{{clipboard}}", content)
        .replace("{{date}}", &now.format("%Y-%m-%d").to_string())
        .replace("{{time}}", &now.format("%H:%M:%S").to_string())
        .replace("{{timestamp}}", &now.timestamp().to_string())
        .replace("{{preview}}", &content.chars().take(50).collect::<String>())
}

#[derive(Debug, Serialize)]
pub enum ActionResult {
    Modified(String),
    Saved(String),
    Notified(String),
    Pinned,
    Skipped,
    WebhookSent(String),
    NoOp,
}
```

### 2.2 Integration với Clipboard Watcher

```rust
// Trong watcher loop, sau khi detect new content:

let rules = load_enabled_rules(&db)?;
let content_type = detect_content_type(&current);
let source = get_active_app_name();
let mut skip_history = false;
let mut modified_content = current.clone();

for rule in &rules {
    if evaluate_trigger(&rule.trigger, &current, source.as_deref(), &content_type) {
        for action in &rule.actions {
            match execute_action(action, &modified_content, &mut clipboard)? {
                ActionResult::Modified(new) => modified_content = new,
                ActionResult::Skipped => skip_history = true,
                ActionResult::Pinned => { /* mark as pinned when saving */ }
                _ => {}
            }
            increment_rule_count(&db, &rule.id)?;
        }
    }
}

if !skip_history {
    save_to_history(&db, &modified_content, &app);
}
```

---

## 3. Database Schema

```sql
CREATE TABLE IF NOT EXISTS workflow_rules (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    enabled     INTEGER DEFAULT 1,
    trigger_json TEXT NOT NULL,   -- JSON serialized Trigger
    actions_json TEXT NOT NULL,   -- JSON serialized Vec<Action>
    run_count   INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now','localtime'))
);
```

---

## 4. Build Steps

```
Ngày 1-2: Rule engine core (Trigger evaluate + Action execute)
Ngày 3:   Integration với clipboard watcher
Ngày 4-5: Frontend rule builder UI (visual, drag-drop triggers/actions)
Ngày 6:   Preset rules (affiliate URL, tracking, etc.)
Ngày 7:   Testing + edge cases
```

---
---

# Feature 06: Smart Variables trong Templates

> **Thời gian:** 2-3 ngày | **Độ khó:** ⭐⭐ (Easy) | **Competitor:** TextExpander ($40/năm)

---

## 1. Mô tả

Templates hỗ trợ built-in variables tự động fill:

**System variables:**
- `{{today}}` → "2026-04-12"
- `{{today_vn}}` → "12/04/2026"
- `{{now}}` → "14:35"
- `{{weekday}}` → "Saturday"
- `{{month}}` → "April"
- `{{year}}` → "2026"
- `{{timestamp}}` → "1744451700"
- `{{random_id}}` → "a7f3b2c1"
- `{{uuid}}` → "550e8400-e29b-..."
- `{{counter:invoice}}` → "INV-0042" (auto-increment per name)

**User-defined variables (set once, auto-fill forever):**
- `{{my_name}}` → "Nguyen Van A"
- `{{my_email}}` → "a@example.com"
- `{{my_phone}}` → "+84 912 345 678"
- `{{my_company}}` → "XYZ Agency"
- `{{my_portfolio}}` → "https://portfolio.com"
- `{{my_rate}}` → "$50/hr"

**Clipboard variable:**
- `{{clipboard}}` → nội dung clipboard hiện tại
- `{{last_paste}}` → nội dung paste gần nhất

**Conditional:**
- `{{greeting}}` → "Good morning" / "Good afternoon" / "Good evening" (based on time)

---

## 2. Technical Implementation

```rust
// src-tauri/src/templates/variables.rs

use chrono::Local;
use std::collections::HashMap;

pub fn expand_smart_variables(
    content: &str,
    user_vars: &HashMap<String, String>,
    counters: &mut HashMap<String, u32>,
    current_clipboard: Option<&str>,
) -> String {
    let now = Local::now();
    let mut result = content.to_string();

    // ── System variables ──
    let system_vars: HashMap<&str, String> = HashMap::from([
        ("today", now.format("%Y-%m-%d").to_string()),
        ("today_vn", now.format("%d/%m/%Y").to_string()),
        ("today_us", now.format("%m/%d/%Y").to_string()),
        ("now", now.format("%H:%M").to_string()),
        ("now_full", now.format("%H:%M:%S").to_string()),
        ("weekday", now.format("%A").to_string()),
        ("weekday_short", now.format("%a").to_string()),
        ("month", now.format("%B").to_string()),
        ("month_num", now.format("%m").to_string()),
        ("year", now.format("%Y").to_string()),
        ("timestamp", now.timestamp().to_string()),
        ("random_id", format!("{:08x}", rand::random::<u32>())),
        ("uuid", uuid::Uuid::new_v4().to_string()),
        ("greeting", get_time_greeting(now.hour())),
        ("day_period", get_day_period(now.hour())),
    ]);

    for (key, value) in &system_vars {
        result = result.replace(&format!("{{{{{}}}}}", key), value);
    }

    // ── User variables ──
    for (key, value) in user_vars {
        result = result.replace(&format!("{{{{{}}}}}", key), value);
    }

    // ── Clipboard variable ──
    if let Some(clip) = current_clipboard {
        result = result.replace("{{clipboard}}", clip);
    }

    // ── Counter variables: {{counter:name}} ──
    let counter_re = regex::Regex::new(r"\{\{counter:(\w+)\}\}").unwrap();
    let result_clone = result.clone();
    for cap in counter_re.captures_iter(&result_clone) {
        let name = &cap[1];
        let count = counters.entry(name.to_string()).or_insert(0);
        *count += 1;
        let formatted = format!("{:04}", count); // 0001, 0002...
        result = result.replace(&cap[0], &formatted);
    }

    // ── Counter with prefix: {{counter:INV-:name}} ──
    let prefix_counter_re = regex::Regex::new(r"\{\{counter:([^:]+):(\w+)\}\}").unwrap();
    let result_clone = result.clone();
    for cap in prefix_counter_re.captures_iter(&result_clone) {
        let prefix = &cap[1];
        let name = &cap[2];
        let count = counters.entry(name.to_string()).or_insert(0);
        *count += 1;
        result = result.replace(&cap[0], &format!("{}{:04}", prefix, count));
    }

    result
}

fn get_time_greeting(hour: u32) -> String {
    match hour {
        5..=11 => "Good morning".into(),
        12..=16 => "Good afternoon".into(),
        17..=20 => "Good evening".into(),
        _ => "Hi".into(),
    }
}

fn get_day_period(hour: u32) -> String {
    match hour {
        5..=11 => "morning".into(),
        12..=16 => "afternoon".into(),
        17..=20 => "evening".into(),
        _ => "night".into(),
    }
}
```

### Database: User variables + counters

```sql
CREATE TABLE IF NOT EXISTS user_variables (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS counters (
    name   TEXT PRIMARY KEY,
    value  INTEGER DEFAULT 0
);
```

---

## 3. Build Steps

```
Ngày 1: Implement expand_smart_variables() + tất cả system vars
Ngày 2: User variables CRUD UI + counter persistence
Ngày 3: Integrate vào template expand flow + test
```

---
---

# Feature 07: Paste Analytics Dashboard

> **Thời gian:** 3-4 ngày | **Độ khó:** ⭐⭐⭐ (Medium) | **Competitor:** 0

---

## 1. Mô tả

Dashboard hiện stats clipboard usage:

```
┌─────────────────────────────────────────────┐
│ 📊 Your Clipboard Insights — This Week      │
├──────────────┬──────────────┬───────────────┤
│ 342 copies   │ 287 pastes   │ 47 min saved  │
├──────────────┴──────────────┴───────────────┤
│                                              │
│  📈 Daily activity (bar chart)               │
│  ████ ██ ████████ ███ █████ ██ ███          │
│  Mon  Tue  Wed    Thu  Fri  Sat Sun          │
│                                              │
├──────────────────────────────────────────────┤
│ 🏆 Most pasted items:                       │
│  1. "https://myportfolio.com"    38 times    │
│     💡 Create a template for this?           │
│  2. "Hi, thanks for reaching..."  24 times   │
│  3. "+84 912 345 678"            19 times    │
│                                              │
├──────────────────────────────────────────────┤
│ 📱 Top source apps:                         │
│  Chrome  ████████████ 45%                    │
│  VS Code ██████ 22%                          │
│  Slack   ████ 15%                            │
│  Figma   ██ 8%                               │
│                                              │
├──────────────────────────────────────────────┤
│ ⏰ Most productive hours:                   │
│  9-11 AM  ████████████████ Peak              │
│  2-4 PM   ████████████ High                  │
│  7-9 PM   ██████ Medium                      │
│                                              │
├──────────────────────────────────────────────┤
│ 💰 Time saved this month: 3.2 hours         │
│ That's worth ~$160 at $50/hr                 │
└──────────────────────────────────────────────┘
```

---

## 2. Technical Implementation

```rust
// src-tauri/src/analytics/mod.rs

#[derive(Serialize)]
pub struct AnalyticsSummary {
    pub period: String,
    pub total_copies: u32,
    pub total_pastes: u32,
    pub unique_items: u32,
    pub time_saved_minutes: f64,
    pub top_items: Vec<TopItem>,
    pub top_source_apps: Vec<AppUsage>,
    pub hourly_distribution: Vec<HourlyData>,
    pub daily_activity: Vec<DailyData>,
    pub template_suggestions: Vec<TemplateSuggestion>,
}

#[derive(Serialize)]
pub struct TemplateSuggestion {
    pub content_preview: String,
    pub paste_count: u32,
    pub reason: String,  // "Bạn paste text này 24 lần tuần qua"
}

#[tauri::command]
pub fn get_analytics(
    db: tauri::State<'_, Arc<DbPool>>,
    period: String,  // "today", "week", "month"
) -> Result<AnalyticsSummary, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let date_filter = match period.as_str() {
        "today" => "date(created_at) = date('now','localtime')",
        "week" => "created_at >= datetime('now','-7 days','localtime')",
        "month" => "created_at >= datetime('now','-30 days','localtime')",
        _ => "created_at >= datetime('now','-7 days','localtime')",
    };

    // Total copies
    let total_copies: u32 = conn.query_row(
        &format!("SELECT COUNT(*) FROM clipboard_items WHERE {}", date_filter),
        [], |row| row.get(0),
    ).unwrap_or(0);

    // Total pastes (sum of use_count)
    let total_pastes: u32 = conn.query_row(
        &format!("SELECT COALESCE(SUM(use_count),0) FROM clipboard_items WHERE {}", date_filter),
        [], |row| row.get(0),
    ).unwrap_or(0);

    // Top items by use_count
    let mut stmt = conn.prepare(&format!(
        "SELECT content_preview, use_count FROM clipboard_items
         WHERE {} AND use_count > 0
         ORDER BY use_count DESC LIMIT 10", date_filter
    )).map_err(|e| e.to_string())?;

    let top_items: Vec<TopItem> = stmt.query_map([], |row| {
        Ok(TopItem {
            preview: row.get(0)?,
            count: row.get(1)?,
        })
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok()).collect();

    // Template suggestions: items pasted > 5 times that aren't templates yet
    let suggestions: Vec<TemplateSuggestion> = top_items.iter()
        .filter(|i| i.count >= 5)
        .map(|i| TemplateSuggestion {
            content_preview: i.preview.clone(),
            paste_count: i.count,
            reason: format!("Pasted {} times — save as template?", i.count),
        })
        .collect();

    // Time saved: each paste from history/template saves ~30 seconds
    let time_saved_minutes = total_pastes as f64 * 0.5; // 30 sec per paste

    Ok(AnalyticsSummary {
        period,
        total_copies,
        total_pastes,
        unique_items: total_copies, // simplified
        time_saved_minutes,
        top_items,
        top_source_apps: vec![], // TODO: query source_app stats
        hourly_distribution: vec![],
        daily_activity: vec![],
        template_suggestions: suggestions,
    })
}
```

---

## 3. Build Steps

```
Ngày 1: SQL queries cho tất cả analytics metrics
Ngày 2: Tauri command + data aggregation
Ngày 3: Frontend dashboard UI (dùng recharts)
Ngày 4: Template suggestion logic + "time saved" notification
```

---
---

# Feature 08: Screenshot → OCR → Editable Text

> **Thời gian:** 3-4 ngày | **Độ khó:** ⭐⭐⭐ (Medium) | **Competitor:** Chỉ ClipZ (mobile)

---

## 1. Mô tả

Hotkey `Cmd+Shift+O` → chụp vùng màn hình → OCR extract text → text vào clipboard.

**Use cases:**
- Copy text từ hình ảnh, PDF scan, video frame
- Copy text từ app không cho select (banking app, receipt)
- Copy text từ screenshot nhận được qua chat
- Extract data từ card visit chụp ảnh

---

## 2. Technical Implementation

### 2.1 Screen Capture

```rust
// src-tauri/src/system/screenshot.rs

#[tauri::command]
pub async fn capture_screen_region(app: AppHandle) -> Result<String, String> {
    // Dùng OS native screenshot tool

    #[cfg(target_os = "macos")]
    {
        let output_path = format!("/tmp/pasteflow_ocr_{}.png", uuid::Uuid::new_v4());
        let status = std::process::Command::new("screencapture")
            .args(["-i", "-s", &output_path]) // -i interactive, -s selection
            .status()
            .map_err(|e| e.to_string())?;

        if status.success() && std::path::Path::new(&output_path).exists() {
            Ok(output_path)
        } else {
            Err("Screenshot cancelled".into())
        }
    }

    #[cfg(target_os = "windows")]
    {
        // Dùng Snipping Tool API hoặc PowerShell
        let output_path = format!("{}\\pasteflow_ocr_{}.png",
            std::env::temp_dir().display(), uuid::Uuid::new_v4());
        // Windows: dùng built-in snippet hoặc custom capture window
        // Simpler: dùng crate `screenshots`
        Err("TODO: implement Windows capture".into())
    }
}
```

### 2.2 OCR Engine

```rust
// Option A: Tesseract (offline, free)
// cargo add leptess  (Tesseract binding)

// Option B: OS native OCR
// macOS: Vision framework (free, offline, best quality)
// Windows: Windows.Media.Ocr (free, offline)

// Option C: Cloud API fallback
// OpenAI Vision API / Google Cloud Vision

#[cfg(target_os = "macos")]
pub fn ocr_image(image_path: &str) -> Result<String, String> {
    // Dùng macOS Vision framework qua Swift bridge hoặc osascript
    let output = std::process::Command::new("osascript")
        .args(["-e", &format!(r#"
            use framework "Vision"
            set imagePath to POSIX file "{}"
            set theImage to current application's NSImage's alloc()'s initWithContentsOfFile:(POSIX path of imagePath)
            set requestHandler to current application's VNImageRequestHandler's alloc()'s initWithData:(theImage's TIFFRepresentation()) options:(current application's NSDictionary's dictionary())
            set textRequest to current application's VNRecognizeTextRequest's alloc()'s init()
            textRequest's setRecognitionLevel:(current application's VNRequestTextRecognitionLevelAccurate)
            requestHandler's performRequests:({{textRequest}}) |error|:(missing value)
            set results to textRequest's results()
            set outputText to ""
            repeat with obs in results
                set outputText to outputText & (obs's topCandidates:(1)'s firstObject()'s |string|() as text) & linefeed
            end repeat
            return outputText
        "#, image_path)])
        .output()
        .map_err(|e| e.to_string())?;

    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if text.is_empty() {
        Err("No text detected in image".into())
    } else {
        Ok(text)
    }
}

// Full command combining capture + OCR
#[tauri::command]
pub async fn screenshot_to_text(app: AppHandle) -> Result<OcrResult, String> {
    // 1. Capture screen region
    let image_path = capture_screen_region(app).await?;

    // 2. OCR
    let text = ocr_image(&image_path)?;

    // 3. Set clipboard
    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.set_text(&text).map_err(|e| e.to_string())?;

    // 4. Cleanup temp file
    let _ = std::fs::remove_file(&image_path);

    Ok(OcrResult {
        text: text.clone(),
        char_count: text.len(),
        line_count: text.lines().count(),
    })
}

#[derive(Serialize)]
pub struct OcrResult {
    text: String,
    char_count: usize,
    line_count: usize,
}
```

---

## 3. Build Steps

```
Ngày 1: Screen capture integration (macOS + Windows)
Ngày 2: OCR engine (macOS Vision + Windows OCR API)
Ngày 3: Hotkey binding + toast notification + clipboard integration
Ngày 4: Fallback to Tesseract/Cloud API + multi-language support
```

---

## 4. Dependencies

```toml
# Cargo.toml — nếu dùng Tesseract fallback:
leptess = "0.13"  # Tesseract OCR binding

# Hoặc dùng crate screenshots cho Windows:
screenshots = "0.8"
```
