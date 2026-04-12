# Tier 3 Features — Scale (Tháng 4+)

---

# Feature 09: Team Shared Clipboard

> **Thời gian:** 7-10 ngày | **Độ khó:** ⭐⭐⭐⭐⭐ (Hard) | **Revenue:** Team plan $15/tháng
> **Competitor:** Chỉ Paste có Shared Pinboards (Apple-only, $30/năm)

---

## 1. Mô tả

Team members chia sẻ template groups, snippets, brand voice guidelines qua cloud sync.

**Use cases:**
- Agency leader tạo bộ "Client Email Templates" chuẩn → cả team 5 người dùng chung
- Design team share brand colors, font names, component descriptions
- Sales team share pitch scripts, objection handling templates
- Support team share FAQ responses, troubleshooting steps

**KHÔNG phải** real-time clipboard sync (privacy nightmare). Chỉ sync **templates + snippet groups** mà user chủ động share.

---

## 2. Architecture

### 2.1 Cloud Backend (minimal)

```
Option A: Firebase Firestore (recommended cho MVP)
  - Free tier: 50K reads/day, 20K writes/day
  - Real-time sync built-in
  - Auth với email/password hoặc Google
  - Đủ cho ~500 teams

Option B: Supabase
  - PostgreSQL + real-time subscriptions
  - Free tier: 500MB database, 50K monthly active users
  - Auth built-in

Option C: Self-hosted (sau khi có revenue)
  - Simple REST API (Rust Axum / Node Express)
  - SQLite on server hoặc PostgreSQL
  - Deploy trên Railway / Fly.io
```

### 2.2 Data Model

```typescript
// Shared data structure

interface Team {
  id: string;
  name: string;
  created_by: string;      // user_id
  invite_code: string;     // 8-char join code
  members: TeamMember[];
  created_at: string;
}

interface TeamMember {
  user_id: string;
  email: string;
  role: "owner" | "admin" | "member";
  joined_at: string;
}

interface SharedTemplateGroup {
  id: string;
  team_id: string;
  name: string;
  icon: string;
  color: string;
  created_by: string;
  updated_at: string;       // for conflict resolution
}

interface SharedTemplate {
  id: string;
  group_id: string;
  team_id: string;
  title: string;
  content: string;
  variables: string[];
  created_by: string;
  updated_at: string;
  version: number;          // optimistic locking
}
```

### 2.3 Sync Strategy

```
PULL-based sync (simple, reliable):

1. App startup → fetch latest from cloud
2. Every 5 minutes → check for updates (versioned)
3. User manually triggers sync
4. Real-time listener for template changes (Firestore onSnapshot)

Conflict resolution:
- Last-write-wins with version number
- If version mismatch → prompt user: "Template was updated by [name]. Keep yours or use theirs?"
- Deleted items: soft delete with deleted_at timestamp

Offline support:
- All shared templates cached in local SQLite
- Queue changes when offline → sync when back online
- Mark items as "pending sync" with visual indicator
```

### 2.4 Rust Implementation

```rust
// src-tauri/src/sync/mod.rs

use serde::{Deserialize, Serialize};
use reqwest::Client;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncState {
    pub last_sync: Option<String>,
    pub pending_changes: Vec<PendingChange>,
    pub team_id: Option<String>,
    pub user_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingChange {
    pub id: String,
    pub change_type: ChangeType,
    pub entity_type: String,  // "template" | "group"
    pub entity_id: String,
    pub data: String,         // JSON serialized
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ChangeType {
    Create,
    Update,
    Delete,
}

#[tauri::command]
pub async fn sync_shared_templates(
    db: tauri::State<'_, Arc<DbPool>>,
    team_id: String,
    token: String,
) -> Result<SyncResult, String> {
    let client = Client::new();
    let last_sync = get_last_sync_time(&db)?;

    // 1. Push pending local changes
    let pending = get_pending_changes(&db)?;
    if !pending.is_empty() {
        let res = client.post(&format!("{}/api/sync/push", SYNC_URL))
            .bearer_auth(&token)
            .json(&PushRequest { team_id: team_id.clone(), changes: pending })
            .send().await
            .map_err(|e| e.to_string())?;

        if res.status().is_success() {
            clear_pending_changes(&db)?;
        }
    }

    // 2. Pull remote changes since last sync
    let res = client.get(&format!("{}/api/sync/pull", SYNC_URL))
        .bearer_auth(&token)
        .query(&[("team_id", &team_id), ("since", &last_sync.unwrap_or_default())])
        .send().await
        .map_err(|e| e.to_string())?;

    let remote_changes: Vec<RemoteChange> = res.json().await
        .map_err(|e| e.to_string())?;

    // 3. Apply remote changes to local DB
    let mut applied = 0;
    let mut conflicts = 0;
    for change in &remote_changes {
        match apply_remote_change(&db, change) {
            Ok(_) => applied += 1,
            Err(_) => conflicts += 1,
        }
    }

    // 4. Update last sync time
    update_last_sync_time(&db)?;

    Ok(SyncResult {
        pushed: pending.len() as u32,
        pulled: applied,
        conflicts,
    })
}

#[tauri::command]
pub async fn create_team(
    token: String,
    name: String,
) -> Result<Team, String> {
    let client = Client::new();
    let res = client.post(&format!("{}/api/teams", SYNC_URL))
        .bearer_auth(&token)
        .json(&serde_json::json!({ "name": name }))
        .send().await
        .map_err(|e| e.to_string())?;

    res.json().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn join_team(
    token: String,
    invite_code: String,
) -> Result<Team, String> {
    let client = Client::new();
    let res = client.post(&format!("{}/api/teams/join", SYNC_URL))
        .bearer_auth(&token)
        .json(&serde_json::json!({ "invite_code": invite_code }))
        .send().await
        .map_err(|e| e.to_string())?;

    res.json().await.map_err(|e| e.to_string())
}
```

---

## 3. Pricing Impact

```
Team Plan: $15/team/tháng (up to 10 members)
  - Shared template groups
  - Real-time sync
  - Team analytics
  - Admin controls (who can create/edit)
  - Audit log (who changed what)

Business Plan: $8/user/tháng (11+ members)
  - Everything in Team
  - SSO (Google Workspace)
  - Custom branding
  - Priority support
```

---

## 4. Build Steps

```
Ngày 1-2:  Firebase/Supabase setup + auth
Ngày 3-4:  Sync engine (push/pull/conflict resolution)
Ngày 5-6:  Team management UI (create, join, invite, roles)
Ngày 7-8:  Shared templates UI (visual indicator for shared vs personal)
Ngày 9-10: Testing + offline support + edge cases
```

---
---

# Feature 10: 1-Click Send to Notion / Google Sheets / Airtable

> **Thời gian:** 5-7 ngày | **Độ khó:** ⭐⭐⭐⭐ (Hard) | **Competitor:** 0

---

## 1. Mô tả

Clipboard item → right-click hoặc quick action → "Send to..." → chọn destination.

**Supported destinations:**

| Destination | Action | API |
|-------------|--------|-----|
| Notion database | Add new row | Notion API |
| Google Sheets | Append row | Google Sheets API |
| Airtable | Add record | Airtable API |
| Todoist | Create task | Todoist API |
| Trello | Create card | Trello API |
| Custom webhook | POST JSON | Any URL |

**Ví dụ flow:**

```
1. User copy "john@client.com - needs proposal by Friday"
2. Right-click → "Send to Notion: Leads Database"
3. PasteFlow auto-parse:
   - Email: john@client.com
   - Note: needs proposal by Friday
   - Date: auto-fill today
4. → New row appears in Notion database
```

---

## 2. Technical Implementation

### 2.1 Integration Config

```rust
// src-tauri/src/integrations/mod.rs

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Integration {
    pub id: String,
    pub name: String,
    pub integration_type: IntegrationType,
    pub config: IntegrationConfig,
    pub enabled: bool,
    pub field_mapping: Vec<FieldMap>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum IntegrationType {
    Notion,
    GoogleSheets,
    Airtable,
    Todoist,
    Trello,
    Webhook,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegrationConfig {
    pub api_key: Option<String>,
    pub database_id: Option<String>,    // Notion database ID
    pub spreadsheet_id: Option<String>, // Google Sheet ID
    pub sheet_name: Option<String>,
    pub webhook_url: Option<String>,
    pub base_id: Option<String>,        // Airtable base
    pub table_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldMap {
    pub source: FieldSource,     // where to get the value
    pub destination: String,     // column/field name in destination
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FieldSource {
    FullContent,                 // entire clipboard text
    ExtractedEmail,              // auto-extracted email from text
    ExtractedUrl,
    ExtractedPhone,
    ExtractedNumber,
    CurrentDate,
    CurrentTime,
    SourceApp,
    CustomRegex(String),         // user-defined extraction
    StaticValue(String),         // fixed value
}

#[tauri::command]
pub async fn send_to_integration(
    db: tauri::State<'_, Arc<DbPool>>,
    integration_id: String,
    content: String,
) -> Result<SendResult, String> {
    let integration = get_integration(&db, &integration_id)?;

    // Extract fields based on mapping
    let fields = extract_fields(&content, &integration.field_mapping);

    match integration.integration_type {
        IntegrationType::Notion => send_to_notion(&integration.config, &fields).await,
        IntegrationType::GoogleSheets => send_to_sheets(&integration.config, &fields).await,
        IntegrationType::Webhook => send_to_webhook(&integration.config, &content).await,
        _ => Err("Integration not yet supported".into()),
    }
}

async fn send_to_notion(
    config: &IntegrationConfig,
    fields: &HashMap<String, String>,
) -> Result<SendResult, String> {
    let client = reqwest::Client::new();
    let api_key = config.api_key.as_ref().ok_or("Notion API key not set")?;
    let db_id = config.database_id.as_ref().ok_or("Notion database ID not set")?;

    // Build Notion page properties from fields
    let mut properties = serde_json::Map::new();
    for (key, value) in fields {
        properties.insert(key.clone(), serde_json::json!({
            "rich_text": [{"text": {"content": value}}]
        }));
    }

    let body = serde_json::json!({
        "parent": {"database_id": db_id},
        "properties": properties
    });

    let res = client.post("https://api.notion.com/v1/pages")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Notion-Version", "2022-06-28")
        .json(&body)
        .send().await
        .map_err(|e| e.to_string())?;

    if res.status().is_success() {
        Ok(SendResult { success: true, message: "Added to Notion".into() })
    } else {
        let err = res.text().await.unwrap_or_default();
        Err(format!("Notion API error: {}", err))
    }
}

async fn send_to_sheets(
    config: &IntegrationConfig,
    fields: &HashMap<String, String>,
) -> Result<SendResult, String> {
    let client = reqwest::Client::new();
    let api_key = config.api_key.as_ref().ok_or("Google API key not set")?;
    let sheet_id = config.spreadsheet_id.as_ref().ok_or("Sheet ID not set")?;
    let sheet_name = config.sheet_name.as_deref().unwrap_or("Sheet1");

    // Append row
    let values: Vec<String> = fields.values().cloned().collect();
    let body = serde_json::json!({
        "values": [values]
    });

    let url = format!(
        "https://sheets.googleapis.com/v4/spreadsheets/{}/values/{}!A:Z:append?valueInputOption=USER_ENTERED&key={}",
        sheet_id, sheet_name, api_key
    );

    let res = client.post(&url)
        .json(&body)
        .send().await
        .map_err(|e| e.to_string())?;

    if res.status().is_success() {
        Ok(SendResult { success: true, message: "Added to Google Sheets".into() })
    } else {
        Err("Google Sheets API error".into())
    }
}

async fn send_to_webhook(
    config: &IntegrationConfig,
    content: &str,
) -> Result<SendResult, String> {
    let client = reqwest::Client::new();
    let url = config.webhook_url.as_ref().ok_or("Webhook URL not set")?;

    let body = serde_json::json!({
        "content": content,
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "source": "PasteFlow"
    });

    client.post(url).json(&body).send().await
        .map_err(|e| e.to_string())?;

    Ok(SendResult { success: true, message: "Sent to webhook".into() })
}
```

---

## 3. Database Schema

```sql
CREATE TABLE IF NOT EXISTS integrations (
    id                TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    integration_type  TEXT NOT NULL,
    config_json       TEXT NOT NULL,
    field_mapping_json TEXT DEFAULT '[]',
    enabled           INTEGER DEFAULT 1,
    use_count         INTEGER DEFAULT 0,
    created_at        TEXT DEFAULT (datetime('now','localtime'))
);
```

---

## 4. Build Steps

```
Ngày 1-2: Integration framework + config storage
Ngày 3:   Notion integration (API + field mapping)
Ngày 4:   Google Sheets integration
Ngày 5:   Webhook integration (catch-all cho Zapier/Make)
Ngày 6:   Frontend: integration setup wizard
Ngày 7:   Frontend: "Send to..." menu in history + quick paste
```

---
---

# Feature 11: Sensitive Content Detection + Auto-Expiry

> **Thời gian:** 3-4 ngày | **Độ khó:** ⭐⭐⭐ (Medium) | **Competitor:** Chỉ VeilClip có PIN lock

---

## 1. Mô tả

Tự động detect nội dung nhạy cảm → mask trong history → auto-delete sau thời gian cài đặt → cảnh báo khi paste vào app public.

**Detect patterns:**

| Pattern | Ví dụ | Action |
|---------|-------|--------|
| Credit card | 4532 1234 5678 9012 | Mask: **** **** **** 9012 |
| API key | sk-proj-abc123... | Mask: sk-proj-****... |
| AWS key | AKIA... | Mask + warning |
| Private key | -----BEGIN RSA... | Mask + auto-delete 1min |
| Password-like | P@ssw0rd!123 | Mask + auto-delete 5min |
| SSN | 123-45-6789 | Mask: ***-**-6789 |
| JWT token | eyJhbG... | Mask + auto-delete 5min |
| Connection string | postgres://user:pass@... | Mask password part |

---

## 2. Technical Implementation

```rust
// src-tauri/src/security/sensitive.rs

use regex::Regex;
use lazy_static::lazy_static;

#[derive(Debug, Clone, Serialize)]
pub struct SensitiveDetection {
    pub is_sensitive: bool,
    pub sensitivity_level: SensitivityLevel,
    pub detected_types: Vec<SensitiveType>,
    pub masked_preview: String,
    pub auto_delete_seconds: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
pub enum SensitivityLevel {
    None,
    Low,       // might be sensitive
    Medium,    // likely sensitive
    High,      // definitely sensitive (crypto keys, passwords)
    Critical,  // must not persist (private keys)
}

#[derive(Debug, Clone, Serialize)]
pub struct SensitiveType {
    pub pattern_name: String,
    pub matched_text: String,
    pub masked_text: String,
}

lazy_static! {
    static ref PATTERNS: Vec<(&'static str, Regex, SensitivityLevel, u32)> = vec![
        // (name, regex, level, auto_delete_seconds)
        ("credit_card", Regex::new(r"\b[3-6]\d{3}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b").unwrap(),
         SensitivityLevel::High, 300),

        ("aws_key", Regex::new(r"AKIA[0-9A-Z]{16}").unwrap(),
         SensitivityLevel::Critical, 60),

        ("openai_key", Regex::new(r"sk-[a-zA-Z0-9_-]{20,}").unwrap(),
         SensitivityLevel::Critical, 60),

        ("github_token", Regex::new(r"gh[ps]_[A-Za-z0-9_]{36,}").unwrap(),
         SensitivityLevel::Critical, 60),

        ("private_key", Regex::new(r"-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----").unwrap(),
         SensitivityLevel::Critical, 30),

        ("jwt_token", Regex::new(r"eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+").unwrap(),
         SensitivityLevel::High, 300),

        ("connection_string", Regex::new(r"(postgres|mysql|mongodb|redis)://[^\s]+:[^\s]+@").unwrap(),
         SensitivityLevel::Critical, 60),

        ("ssn", Regex::new(r"\b\d{3}-\d{2}-\d{4}\b").unwrap(),
         SensitivityLevel::High, 300),

        ("password_field", Regex::new(r"(?i)(password|passwd|pwd)\s*[:=]\s*\S+").unwrap(),
         SensitivityLevel::High, 300),

        ("env_secret", Regex::new(r"(?i)(SECRET|TOKEN|API_KEY|PRIVATE)\s*=\s*['\"]?\S+").unwrap(),
         SensitivityLevel::High, 300),
    ];
}

pub fn detect_sensitive(text: &str) -> SensitiveDetection {
    let mut detected: Vec<SensitiveType> = Vec::new();
    let mut max_level = SensitivityLevel::None;
    let mut min_delete_time: Option<u32> = None;

    for (name, regex, level, delete_secs) in PATTERNS.iter() {
        if let Some(m) = regex.find(text) {
            let matched = m.as_str().to_string();
            let masked = mask_sensitive(&matched, name);

            detected.push(SensitiveType {
                pattern_name: name.to_string(),
                matched_text: matched,
                masked_text: masked,
            });

            // Track highest sensitivity
            if sensitivity_rank(level) > sensitivity_rank(&max_level) {
                max_level = level.clone();
            }

            // Track shortest auto-delete time
            min_delete_time = Some(
                min_delete_time.map(|t| t.min(*delete_secs)).unwrap_or(*delete_secs)
            );
        }
    }

    let masked_preview = if detected.is_empty() {
        text.chars().take(200).collect()
    } else {
        let mut preview = text.to_string();
        for det in &detected {
            preview = preview.replace(&det.matched_text, &det.masked_text);
        }
        preview.chars().take(200).collect()
    };

    SensitiveDetection {
        is_sensitive: !detected.is_empty(),
        sensitivity_level: max_level,
        detected_types: detected,
        masked_preview,
        auto_delete_seconds: min_delete_time,
    }
}

fn mask_sensitive(text: &str, pattern_type: &str) -> String {
    match pattern_type {
        "credit_card" => {
            let digits: String = text.chars().filter(|c| c.is_ascii_digit()).collect();
            if digits.len() >= 4 {
                format!("**** **** **** {}", &digits[digits.len()-4..])
            } else {
                "****".into()
            }
        }
        "ssn" => {
            if text.len() >= 4 {
                format!("***-**-{}", &text[text.len()-4..])
            } else {
                "***".into()
            }
        }
        _ => {
            // Generic: show first 4 chars + ****
            if text.len() > 8 {
                format!("{}****{}", &text[..4], &text[text.len()-4..])
            } else {
                format!("{}****", &text[..text.len().min(4)])
            }
        }
    }
}

fn sensitivity_rank(level: &SensitivityLevel) -> u8 {
    match level {
        SensitivityLevel::None => 0,
        SensitivityLevel::Low => 1,
        SensitivityLevel::Medium => 2,
        SensitivityLevel::High => 3,
        SensitivityLevel::Critical => 4,
    }
}
```

### Auto-delete scheduler

```rust
// Trong clipboard watcher, sau khi save item:

if detection.is_sensitive {
    if let Some(delete_secs) = detection.auto_delete_seconds {
        let db_clone = db.clone();
        let item_id = id.clone();
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_secs(delete_secs as u64)).await;
            let conn = db_clone.0.lock().unwrap();
            let _ = conn.execute(
                "DELETE FROM clipboard_items WHERE id = ?1 AND is_pinned = 0",
                [&item_id],
            );
        });
    }
}
```

---

## 3. Build Steps

```
Ngày 1: All regex patterns + mask functions + unit tests
Ngày 2: Integration với watcher + auto-delete scheduler
Ngày 3: Frontend: masked preview + sensitivity badge + paste warning
Ngày 4: Settings: customize patterns, expiry times, excluded apps
```

---
---

# Feature 12: AI Content Writer từ Clipboard Context

> **Thời gian:** 4-5 ngày | **Độ khó:** ⭐⭐⭐ (Medium) | **Competitor:** 0

---

## 1. Mô tả

Chọn nhiều clipboard items → AI tổng hợp thành content hoàn chỉnh.

**Use cases:**

| Select | Output | User |
|--------|--------|------|
| 5 meeting notes | Meeting summary email | Office worker |
| Client brief + portfolio link | Upwork proposal | Freelancer |
| 3 product features | Product description | Seller |
| Research notes + stats | Blog post draft | Creator |
| Bug description + error log | Bug report (formatted) | Developer |
| Customer complaint + order info | Reply email | Support |

---

## 2. Technical Implementation

```rust
// src-tauri/src/ai/composer.rs

#[derive(Serialize, Deserialize)]
pub struct ComposeRequest {
    pub item_ids: Vec<String>,        // clipboard item IDs to combine
    pub output_type: OutputType,
    pub additional_context: Option<String>, // user instruction
    pub tone: Option<String>,
    pub max_length: Option<u32>,
}

#[derive(Serialize, Deserialize)]
pub enum OutputType {
    Email,
    EmailReply,
    MeetingSummary,
    Proposal,
    BlogPost,
    BugReport,
    ProductDescription,
    SocialPost,
    Custom(String),  // user-defined instruction
}

#[tauri::command]
pub async fn compose_from_clips(
    db: tauri::State<'_, Arc<DbPool>>,
    request: ComposeRequest,
) -> Result<ComposeResult, String> {
    // 1. Gather content from selected clipboard items
    let mut source_texts = Vec::new();
    for id in &request.item_ids {
        let content = get_clip_content_by_id(&db, id)?;
        source_texts.push(content);
    }

    let combined_sources = source_texts.iter()
        .enumerate()
        .map(|(i, text)| format!("--- Source {} ---\n{}", i + 1, text))
        .collect::<Vec<_>>()
        .join("\n\n");

    // 2. Build prompt based on output type
    let system_prompt = build_compose_prompt(&request.output_type, &request.tone);

    let user_prompt = if let Some(ctx) = &request.additional_context {
        format!(
            "Here are the source materials:\n\n{}\n\nAdditional instructions: {}\n\nPlease compose the output now.",
            combined_sources, ctx
        )
    } else {
        format!(
            "Here are the source materials:\n\n{}\n\nPlease compose the output now.",
            combined_sources
        )
    };

    // 3. Call LLM API
    let settings = get_ai_settings(&db)?;
    let result = call_llm(&settings, &system_prompt, &user_prompt).await?;

    Ok(ComposeResult {
        composed_text: result.text,
        source_count: request.item_ids.len(),
        output_type: format!("{:?}", request.output_type),
        tokens_used: result.tokens,
    })
}

fn build_compose_prompt(output_type: &OutputType, tone: &Option<String>) -> String {
    let tone_str = tone.as_deref().unwrap_or("professional");

    match output_type {
        OutputType::Email => format!(
            "You are an expert email writer. Compose a professional email from the provided source materials.\n\
            Structure: Subject line, greeting, body (clear paragraphs), CTA, sign-off.\n\
            Tone: {}. Output ONLY the email.", tone_str),

        OutputType::MeetingSummary => format!(
            "You are an expert at writing meeting summaries. Create a structured summary from the provided notes.\n\
            Structure: Meeting overview (1-2 sentences), Key decisions, Action items (with owners if mentioned), Next steps.\n\
            Tone: {}. Be concise. Output ONLY the summary.", tone_str),

        OutputType::Proposal => format!(
            "You are an expert freelance proposal writer. Create a compelling proposal from the provided materials.\n\
            Structure: Understanding of the project, Proposed approach, Timeline, Why you're the right fit, Next steps.\n\
            Tone: {}. Output ONLY the proposal.", tone_str),

        OutputType::BlogPost => format!(
            "You are an expert content writer. Create a blog post from the provided research and notes.\n\
            Structure: Compelling title, Hook intro, Main sections with headers, Conclusion with CTA.\n\
            Tone: {}. Make it engaging and well-structured. Output ONLY the blog post.", tone_str),

        OutputType::BugReport => format!(
            "You are a QA engineer. Create a clear bug report from the provided information.\n\
            Structure: Title, Environment, Steps to reproduce, Expected behavior, Actual behavior, Error logs (if any), Severity.\n\
            Tone: technical and precise. Output ONLY the bug report."),

        OutputType::ProductDescription => format!(
            "You are an expert e-commerce copywriter. Create a compelling product description.\n\
            Structure: Attention-grabbing title, Key benefits (not just features), Specs if relevant, CTA.\n\
            Tone: {}. Output ONLY the product description.", tone_str),

        OutputType::Custom(instruction) => instruction.clone(),

        _ => format!("Compose a well-written piece from the provided source materials. Tone: {}.", tone_str),
    }
}

#[derive(Serialize)]
pub struct ComposeResult {
    pub composed_text: String,
    pub source_count: usize,
    pub output_type: String,
    pub tokens_used: u32,
}
```

### Frontend: Multi-select + Compose UI

```
┌──────────────────────────────────────────────┐
│ 🤖 AI Compose from Clipboard                │
├──────────────────────────────────────────────┤
│ Selected items (3):                          │
│  ☑ "Client says they need redesign..."      │
│  ☑ "Budget is $5000, timeline 4 weeks"      │
│  ☑ "https://portfolio.com/case-study"       │
│  □ "meeting at 3pm tomorrow"     [Add more]  │
├──────────────────────────────────────────────┤
│ Output type:                                 │
│  [Proposal] [Email] [Summary] [Blog] [Custom]│
│                                              │
│ Additional instructions (optional):          │
│  ┌─────────────────────────────────────────┐ │
│  │ Mention 3 years experience, React focus │ │
│  └─────────────────────────────────────────┘ │
│                                              │
│              [✨ Compose]                    │
├──────────────────────────────────────────────┤
│ Result:                                      │
│ ┌─────────────────────────────────────────┐  │
│ │ Hi [Client Name],                       │  │
│ │                                         │  │
│ │ Thank you for sharing your redesign     │  │
│ │ requirements. Based on our discussion,  │  │
│ │ I'd like to propose the following...    │  │
│ │ ...                                     │  │
│ └─────────────────────────────────────────┘  │
│                                              │
│     [Copy] [Paste Now] [Save as Template]    │
└──────────────────────────────────────────────┘
```

---

## 3. Build Steps

```
Ngày 1: Compose engine + all output type prompts
Ngày 2: Multi-select UI in history list
Ngày 3: Compose panel UI + result preview
Ngày 4: "Save as Template" flow + compose history
Ngày 5: Testing with real use cases + prompt tuning
```

---

## 4. Monetization

```
Free: 0 compose/month (disabled)
Pro:  20 compose/month
Business: 100 compose/month
```

This is the strongest upsell feature — users who try it once will pay for it.
