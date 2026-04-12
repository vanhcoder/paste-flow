# Feature 03: Smart Content Detection + Quick Actions

> **Tier:** 1 — Build ngay vào MVP
> **Thời gian:** 2-3 ngày
> **Độ khó:** ⭐⭐ (Easy-Medium)
> **Competitor:** 0

---

## 1. Mô tả tính năng

Mỗi khi user copy text, PasteFlow tự nhận diện loại content → hiện quick action buttons phù hợp ngay trong history list và Quick Paste popup.

**Detection → Actions map:**

| Detect | Quick Actions |
|--------|--------------|
| URL | Open in browser, Shorten (TinyURL API), Copy as markdown link, Generate QR code |
| Email address | Compose email, Copy "mailto:" link, Add to contacts |
| Phone number | Copy formatted (+84...), Open in FaceTime/WhatsApp |
| Hex color (#FF5733) | Show color swatch, Copy as RGB/HSL, Open in color picker |
| JSON | Format/prettify, Validate, Minify, Copy as YAML |
| Code snippet | Detect language, Copy with syntax highlight, Create Gist |
| IP address | Lookup geolocation, Copy as link, Ping |
| Date/Time | Convert timezone, Copy as ISO/Unix timestamp |
| Currency amount | Convert to USD/VND/EUR, Format with separators |
| Tracking number | Detect carrier (DHL/FedEx/USPS), Open tracking page |
| Crypto address | Detect chain (ETH/BTC), Open explorer |
| File path | Open in Finder/Explorer, Copy parent dir, Check exists |

---

## 2. Technical Architecture

### 2.1 Content Detector Engine

```rust
// src-tauri/src/clipboard/detector.rs

use regex::Regex;
use serde::{Deserialize, Serialize};
use lazy_static::lazy_static;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedContent {
    pub content_type: DetectedType,
    pub confidence: f32,          // 0.0 - 1.0
    pub extracted_value: String,  // cleaned/normalized value
    pub metadata: ContentMeta,
    pub actions: Vec<QuickAction>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DetectedType {
    Url,
    Email,
    Phone,
    HexColor,
    Json,
    Code,
    IpAddress,
    DateTime,
    Currency,
    TrackingNumber,
    CryptoAddress,
    FilePath,
    PlainText,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContentMeta {
    pub label: String,       // "URL", "Email", "Color"...
    pub icon: String,        // emoji icon
    pub sub_type: Option<String>, // "ethereum", "bitcoin", "python"...
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuickAction {
    pub id: String,
    pub label: String,
    pub icon: String,
    pub action_type: ActionType,
    pub payload: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ActionType {
    OpenUrl(String),
    CopyTransformed(String),
    RunCommand(String),
    ShowPreview,
    ApiCall { url: String, method: String },
}

lazy_static! {
    static ref URL_RE: Regex = Regex::new(
        r"^https?://[^\s<>\"]+$"
    ).unwrap();

    static ref EMAIL_RE: Regex = Regex::new(
        r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$"
    ).unwrap();

    static ref PHONE_RE: Regex = Regex::new(
        r"^[\+]?[(]?[0-9]{1,4}[)]?[-\s\./0-9]{6,15}$"
    ).unwrap();

    static ref HEX_COLOR_RE: Regex = Regex::new(
        r"^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$"
    ).unwrap();

    static ref IP_RE: Regex = Regex::new(
        r"^(\d{1,3}\.){3}\d{1,3}$"
    ).unwrap();

    static ref FILE_PATH_RE: Regex = Regex::new(
        r"^(/[^/\0]+)+/?$|^[A-Za-z]:\\[^\0]+$"
    ).unwrap();

    static ref TRACKING_RE: Regex = Regex::new(
        r"^(1Z[A-Z0-9]{16}|[0-9]{12,22}|[A-Z]{2}[0-9]{9}[A-Z]{2})$"
    ).unwrap();

    static ref ETH_RE: Regex = Regex::new(r"^0x[0-9a-fA-F]{40}$").unwrap();
    static ref BTC_RE: Regex = Regex::new(r"^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$").unwrap();
}

pub fn detect_content(text: &str) -> DetectedContent {
    let trimmed = text.trim();

    // Priority order: most specific first
    if let Some(result) = try_detect_url(trimmed) { return result; }
    if let Some(result) = try_detect_email(trimmed) { return result; }
    if let Some(result) = try_detect_hex_color(trimmed) { return result; }
    if let Some(result) = try_detect_phone(trimmed) { return result; }
    if let Some(result) = try_detect_json(trimmed) { return result; }
    if let Some(result) = try_detect_ip(trimmed) { return result; }
    if let Some(result) = try_detect_crypto(trimmed) { return result; }
    if let Some(result) = try_detect_file_path(trimmed) { return result; }
    if let Some(result) = try_detect_tracking(trimmed) { return result; }
    if let Some(result) = try_detect_code(trimmed) { return result; }

    // Default: plain text
    DetectedContent {
        content_type: DetectedType::PlainText,
        confidence: 1.0,
        extracted_value: trimmed.to_string(),
        metadata: ContentMeta {
            label: "Text".into(),
            icon: "📝".into(),
            sub_type: None,
        },
        actions: vec![],
    }
}

fn try_detect_url(text: &str) -> Option<DetectedContent> {
    if !URL_RE.is_match(text) { return None; }

    Some(DetectedContent {
        content_type: DetectedType::Url,
        confidence: 0.95,
        extracted_value: text.to_string(),
        metadata: ContentMeta {
            label: "URL".into(),
            icon: "🔗".into(),
            sub_type: extract_domain(text),
        },
        actions: vec![
            QuickAction {
                id: "open-url".into(),
                label: "Open in browser".into(),
                icon: "🌐".into(),
                action_type: ActionType::OpenUrl(text.to_string()),
                payload: text.to_string(),
            },
            QuickAction {
                id: "copy-md-link".into(),
                label: "Copy as markdown".into(),
                icon: "📎".into(),
                action_type: ActionType::CopyTransformed(
                    format!("[Link]({})", text)
                ),
                payload: format!("[Link]({})", text),
            },
            QuickAction {
                id: "shorten-url".into(),
                label: "Shorten URL".into(),
                icon: "✂️".into(),
                action_type: ActionType::ApiCall {
                    url: format!("https://tinyurl.com/api-create.php?url={}", text),
                    method: "GET".into(),
                },
                payload: text.to_string(),
            },
            QuickAction {
                id: "qr-code".into(),
                label: "Generate QR".into(),
                icon: "📱".into(),
                action_type: ActionType::OpenUrl(
                    format!("https://api.qrserver.com/v1/create-qr-code/?size=200x200&data={}", text)
                ),
                payload: text.to_string(),
            },
        ],
    })
}

fn try_detect_email(text: &str) -> Option<DetectedContent> {
    if !EMAIL_RE.is_match(text) { return None; }

    Some(DetectedContent {
        content_type: DetectedType::Email,
        confidence: 0.95,
        extracted_value: text.to_string(),
        metadata: ContentMeta {
            label: "Email".into(),
            icon: "📧".into(),
            sub_type: None,
        },
        actions: vec![
            QuickAction {
                id: "compose-email".into(),
                label: "Compose email".into(),
                icon: "✉️".into(),
                action_type: ActionType::OpenUrl(format!("mailto:{}", text)),
                payload: text.to_string(),
            },
            QuickAction {
                id: "copy-mailto".into(),
                label: "Copy mailto link".into(),
                icon: "📋".into(),
                action_type: ActionType::CopyTransformed(
                    format!("mailto:{}", text)
                ),
                payload: format!("mailto:{}", text),
            },
        ],
    })
}

fn try_detect_hex_color(text: &str) -> Option<DetectedContent> {
    if !HEX_COLOR_RE.is_match(text) { return None; }

    let hex = text.trim_start_matches('#');
    let (r, g, b) = if hex.len() == 3 {
        let r = u8::from_str_radix(&hex[0..1].repeat(2), 16).unwrap_or(0);
        let g = u8::from_str_radix(&hex[1..2].repeat(2), 16).unwrap_or(0);
        let b = u8::from_str_radix(&hex[2..3].repeat(2), 16).unwrap_or(0);
        (r, g, b)
    } else {
        let r = u8::from_str_radix(&hex[0..2], 16).unwrap_or(0);
        let g = u8::from_str_radix(&hex[2..4], 16).unwrap_or(0);
        let b = u8::from_str_radix(&hex[4..6], 16).unwrap_or(0);
        (r, g, b)
    };

    Some(DetectedContent {
        content_type: DetectedType::HexColor,
        confidence: 0.99,
        extracted_value: text.to_string(),
        metadata: ContentMeta {
            label: format!("Color {}", text),
            icon: "🎨".into(),
            sub_type: None,
        },
        actions: vec![
            QuickAction {
                id: "copy-rgb".into(),
                label: format!("Copy RGB: rgb({},{},{})", r, g, b),
                icon: "🔢".into(),
                action_type: ActionType::CopyTransformed(
                    format!("rgb({}, {}, {})", r, g, b)
                ),
                payload: format!("rgb({}, {}, {})", r, g, b),
            },
            QuickAction {
                id: "copy-hsl".into(),
                label: "Copy as HSL".into(),
                icon: "🔢".into(),
                action_type: ActionType::CopyTransformed(
                    rgb_to_hsl(r, g, b)
                ),
                payload: rgb_to_hsl(r, g, b),
            },
            QuickAction {
                id: "preview-color".into(),
                label: "Preview color".into(),
                icon: "👁️".into(),
                action_type: ActionType::ShowPreview,
                payload: text.to_string(),
            },
        ],
    })
}

fn try_detect_json(text: &str) -> Option<DetectedContent> {
    if !(text.starts_with('{') || text.starts_with('[')) { return None; }
    serde_json::from_str::<serde_json::Value>(text).ok()?;

    let is_minified = !text.contains('\n');

    Some(DetectedContent {
        content_type: DetectedType::Json,
        confidence: 0.99,
        extracted_value: text.to_string(),
        metadata: ContentMeta {
            label: "JSON".into(),
            icon: "{ }".into(),
            sub_type: None,
        },
        actions: vec![
            QuickAction {
                id: "format-json".into(),
                label: if is_minified { "Prettify" } else { "Minify" }.into(),
                icon: "✨".into(),
                action_type: ActionType::CopyTransformed(
                    if is_minified {
                        serde_json::to_string_pretty(
                            &serde_json::from_str::<serde_json::Value>(text).unwrap()
                        ).unwrap()
                    } else {
                        serde_json::to_string(
                            &serde_json::from_str::<serde_json::Value>(text).unwrap()
                        ).unwrap()
                    }
                ),
                payload: text.to_string(),
            },
            QuickAction {
                id: "validate-json".into(),
                label: "✅ Valid JSON".into(),
                icon: "✅".into(),
                action_type: ActionType::ShowPreview,
                payload: "valid".into(),
            },
        ],
    })
}

fn try_detect_phone(text: &str) -> Option<DetectedContent> {
    let cleaned = text.replace([' ', '-', '.', '(', ')'], "");
    if !PHONE_RE.is_match(&cleaned) || cleaned.len() < 8 { return None; }

    Some(DetectedContent {
        content_type: DetectedType::Phone,
        confidence: 0.8,
        extracted_value: cleaned.clone(),
        metadata: ContentMeta {
            label: "Phone".into(),
            icon: "📞".into(),
            sub_type: None,
        },
        actions: vec![
            QuickAction {
                id: "call".into(),
                label: "Call".into(),
                icon: "📞".into(),
                action_type: ActionType::OpenUrl(format!("tel:{}", cleaned)),
                payload: cleaned.clone(),
            },
            QuickAction {
                id: "whatsapp".into(),
                label: "WhatsApp".into(),
                icon: "💬".into(),
                action_type: ActionType::OpenUrl(
                    format!("https://wa.me/{}", cleaned.trim_start_matches('+'))
                ),
                payload: cleaned,
            },
        ],
    })
}

// Helper functions
fn extract_domain(url: &str) -> Option<String> {
    url.split("//").nth(1)?
        .split('/').next()
        .map(|s| s.to_string())
}

fn rgb_to_hsl(r: u8, g: u8, b: u8) -> String {
    let r = r as f64 / 255.0;
    let g = g as f64 / 255.0;
    let b = b as f64 / 255.0;
    let max = r.max(g).max(b);
    let min = r.min(g).min(b);
    let l = (max + min) / 2.0;

    if max == min {
        return format!("hsl(0, 0%, {:.0}%)", l * 100.0);
    }

    let d = max - min;
    let s = if l > 0.5 { d / (2.0 - max - min) } else { d / (max + min) };
    let h = if max == r {
        ((g - b) / d + if g < b { 6.0 } else { 0.0 }) * 60.0
    } else if max == g {
        ((b - r) / d + 2.0) * 60.0
    } else {
        ((r - g) / d + 4.0) * 60.0
    };

    format!("hsl({:.0}, {:.0}%, {:.0}%)", h, s * 100.0, l * 100.0)
}
```

### 2.2 Tauri Command

```rust
#[tauri::command]
pub fn detect_clipboard_content(
    content: String,
) -> Result<DetectedContent, String> {
    Ok(detect_content(&content))
}

#[tauri::command]
pub fn execute_quick_action(
    action: QuickAction,
) -> Result<(), String> {
    match &action.action_type {
        ActionType::OpenUrl(url) => {
            open::that(url).map_err(|e| e.to_string())?;
        }
        ActionType::CopyTransformed(text) => {
            let mut clipboard = arboard::Clipboard::new()
                .map_err(|e| e.to_string())?;
            clipboard.set_text(text).map_err(|e| e.to_string())?;
        }
        ActionType::RunCommand(cmd) => {
            std::process::Command::new("sh")
                .args(["-c", cmd])
                .spawn()
                .map_err(|e| e.to_string())?;
        }
        ActionType::ShowPreview => {
            // Handled by frontend
        }
        ActionType::ApiCall { url, method } => {
            // Async HTTP call — handled separately
        }
    }
    Ok(())
}
```

---

## 3. Frontend Integration

### Quick Paste popup — show actions inline:

```tsx
// Trong ResultList.tsx, thêm action buttons khi item có detected actions

{item.detected?.actions?.length > 0 && (
  <div className="flex gap-1 mt-1">
    {item.detected.actions.slice(0, 3).map((action) => (
      <button
        key={action.id}
        onClick={(e) => {
          e.stopPropagation();
          api.executeQuickAction(action);
        }}
        className="text-[10px] px-2 py-0.5 rounded
                   bg-blue-50 dark:bg-blue-900/30
                   text-blue-600 dark:text-blue-400
                   hover:bg-blue-100 dark:hover:bg-blue-900/50"
      >
        {action.label}
      </button>
    ))}
  </div>
)}
```

---

## 4. Build Steps

```
Ngày 1:
  ✅ Implement all regex detectors
  ✅ Build QuickAction mapping for each type
  ✅ Unit tests for detection accuracy

Ngày 2:
  ✅ Tauri commands: detect + execute
  ✅ Integrate detection into clipboard watcher (detect on copy)
  ✅ Store detected type in clipboard_items table

Ngày 3:
  ✅ Frontend: show action buttons in history list
  ✅ Frontend: show actions in Quick Paste popup
  ✅ Color preview widget (inline swatch)
  ✅ Test all action types end-to-end
```
