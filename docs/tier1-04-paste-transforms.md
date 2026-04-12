# Feature 04: Paste Transforms

> **Tier:** 1 — Build ngay vào MVP
> **Thời gian:** 2 ngày
> **Độ khó:** ⭐⭐ (Easy)
> **Competitor:** CmdOS có 1 phần, nhưng không có transform menu dạng hotkey

---

## 1. Mô tả tính năng

Thay vì paste raw, user bấm hotkey → hiện transform menu → chọn kiểu transform → paste ngay.

**Hotkey:** `Cmd+Shift+T` (Transform Paste)

**Menu hiện ra:**

```
┌─────────────────────────────────┐
│ Transform & Paste               │
├─────────────────────────────────┤
│ Aa  UPPERCASE                   │
│ aa  lowercase                   │
│ Aa  Title Case                  │
│ aa  Sentence case               │
│ ─── ─── ─── ─── ─── ─── ───── │
│ abc slug-case                   │
│ abc camelCase                   │
│ ABC SNAKE_CASE                  │
│ abc kebab-case                  │
│ ─── ─── ─── ─── ─── ─── ───── │
│ ⌫  Strip HTML tags              │
│ ⌫  Strip formatting             │
│ ⌫  Remove line breaks           │
│ ⌫  Trim whitespace              │
│ ⌫  Remove duplicate lines       │
│ ─── ─── ─── ─── ─── ─── ───── │
│ 📧 Extract emails               │
│ 🔗 Extract URLs                 │
│ 🔢 Extract numbers              │
│ ─── ─── ─── ─── ─── ─── ───── │
│ #  Add line numbers             │
│ "" Wrap in quotes               │
│ 🔄 Reverse text                 │
│ 📊 Sort lines A→Z               │
│ 🔀 Shuffle lines                │
│ 🧮 Count words/chars            │
└─────────────────────────────────┘
```

---

## 2. Technical Architecture

### 2.1 All Transform Functions

```rust
// src-tauri/src/clipboard/text_transforms.rs

pub fn transform_text(text: &str, transform_id: &str) -> Result<String, String> {
    match transform_id {
        // ── Case transforms ──
        "uppercase" => Ok(text.to_uppercase()),
        "lowercase" => Ok(text.to_lowercase()),
        "title_case" => Ok(to_title_case(text)),
        "sentence_case" => Ok(to_sentence_case(text)),

        // ── Developer case transforms ──
        "slug_case" => Ok(to_slug(text)),
        "camel_case" => Ok(to_camel_case(text)),
        "snake_case" => Ok(to_snake_case(text)),
        "kebab_case" => Ok(to_kebab_case(text)),
        "pascal_case" => Ok(to_pascal_case(text)),
        "constant_case" => Ok(to_snake_case(text).to_uppercase()),

        // ── Strip / Clean ──
        "strip_html" => Ok(strip_html(text)),
        "strip_formatting" => Ok(strip_all_formatting(text)),
        "remove_line_breaks" => Ok(text.lines()
            .map(|l| l.trim())
            .filter(|l| !l.is_empty())
            .collect::<Vec<_>>()
            .join(" ")),
        "trim_whitespace" => Ok(text.lines()
            .map(|l| l.trim())
            .collect::<Vec<_>>()
            .join("\n")
            .trim().to_string()),
        "remove_duplicate_lines" => {
            let mut seen = std::collections::HashSet::new();
            Ok(text.lines()
                .filter(|line| seen.insert(line.to_string()))
                .collect::<Vec<_>>()
                .join("\n"))
        }
        "remove_empty_lines" => Ok(text.lines()
            .filter(|l| !l.trim().is_empty())
            .collect::<Vec<_>>()
            .join("\n")),

        // ── Extract ──
        "extract_emails" => Ok(extract_pattern(
            text, r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"
        )),
        "extract_urls" => Ok(extract_pattern(
            text, r"https?://[^\s<>\"']+"
        )),
        "extract_numbers" => Ok(extract_pattern(
            text, r"-?\d+\.?\d*"
        )),
        "extract_hashtags" => Ok(extract_pattern(
            text, r"#\w+"
        )),
        "extract_mentions" => Ok(extract_pattern(
            text, r"@\w+"
        )),

        // ── Format ──
        "add_line_numbers" => Ok(text.lines()
            .enumerate()
            .map(|(i, l)| format!("{:>3}  {}", i + 1, l))
            .collect::<Vec<_>>()
            .join("\n")),
        "wrap_quotes" => Ok(format!("\"{}\"", text)),
        "wrap_single_quotes" => Ok(format!("'{}'", text)),
        "wrap_backticks" => Ok(format!("`{}`", text)),
        "wrap_code_block" => Ok(format!("```\n{}\n```", text)),
        "reverse_text" => Ok(text.chars().rev().collect()),
        "reverse_lines" => Ok(text.lines().rev()
            .collect::<Vec<_>>().join("\n")),
        "sort_lines_asc" => {
            let mut lines: Vec<&str> = text.lines().collect();
            lines.sort_unstable();
            Ok(lines.join("\n"))
        }
        "sort_lines_desc" => {
            let mut lines: Vec<&str> = text.lines().collect();
            lines.sort_unstable();
            lines.reverse();
            Ok(lines.join("\n"))
        }
        "shuffle_lines" => {
            use rand::seq::SliceRandom;
            let mut lines: Vec<&str> = text.lines().collect();
            let mut rng = rand::thread_rng();
            lines.shuffle(&mut rng);
            Ok(lines.join("\n"))
        }

        // ── Stats (copy result) ──
        "count_stats" => {
            let chars = text.len();
            let words = text.split_whitespace().count();
            let lines = text.lines().count();
            let sentences = text.matches(|c| c == '.' || c == '!' || c == '?').count();
            Ok(format!(
                "{} chars | {} words | {} lines | ~{} sentences",
                chars, words, lines, sentences
            ))
        }

        // ── Encode/Decode ──
        "base64_encode" => {
            use base64::Engine;
            Ok(base64::engine::general_purpose::STANDARD.encode(text))
        }
        "base64_decode" => {
            use base64::Engine;
            let bytes = base64::engine::general_purpose::STANDARD
                .decode(text).map_err(|e| e.to_string())?;
            String::from_utf8(bytes).map_err(|e| e.to_string())
        }
        "url_encode" => Ok(urlencoding::encode(text).to_string()),
        "url_decode" => Ok(urlencoding::decode(text)
            .map_err(|e| e.to_string())?.to_string()),

        _ => Err(format!("Unknown transform: {}", transform_id)),
    }
}

// Helper functions
fn to_title_case(text: &str) -> String {
    text.split_whitespace()
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                None => String::new(),
                Some(c) => format!("{}{}", c.to_uppercase(), chars.as_str().to_lowercase()),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn to_sentence_case(text: &str) -> String {
    let lower = text.to_lowercase();
    let mut result = String::with_capacity(lower.len());
    let mut capitalize_next = true;

    for c in lower.chars() {
        if capitalize_next && c.is_alphabetic() {
            result.push(c.to_uppercase().next().unwrap());
            capitalize_next = false;
        } else {
            result.push(c);
            if c == '.' || c == '!' || c == '?' || c == '\n' {
                capitalize_next = true;
            }
        }
    }
    result
}

fn to_slug(text: &str) -> String {
    text.to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

fn to_camel_case(text: &str) -> String {
    let words: Vec<&str> = text.split(|c: char| !c.is_alphanumeric()).filter(|s| !s.is_empty()).collect();
    if words.is_empty() { return String::new(); }
    let first = words[0].to_lowercase();
    let rest: String = words[1..].iter().map(|w| to_title_case(w)).collect();
    format!("{}{}", first, rest)
}

fn to_snake_case(text: &str) -> String {
    let re = regex::Regex::new(r"[A-Z]").unwrap();
    let spaced = re.replace_all(text, |caps: &regex::Captures| {
        format!(" {}", caps[0].to_lowercase())
    });
    spaced.split(|c: char| !c.is_alphanumeric())
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("_")
        .to_lowercase()
}

fn to_kebab_case(text: &str) -> String {
    to_snake_case(text).replace('_', "-")
}

fn to_pascal_case(text: &str) -> String {
    text.split(|c: char| !c.is_alphanumeric())
        .filter(|s| !s.is_empty())
        .map(|w| to_title_case(w))
        .collect()
}

fn strip_html(text: &str) -> String {
    let re = regex::Regex::new(r"<[^>]+>").unwrap();
    let stripped = re.replace_all(text, "");
    // Decode common HTML entities
    stripped.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&nbsp;", " ")
}

fn strip_all_formatting(text: &str) -> String {
    strip_html(text).lines()
        .map(|l| l.trim())
        .collect::<Vec<_>>()
        .join("\n")
}

fn extract_pattern(text: &str, pattern: &str) -> String {
    let re = regex::Regex::new(pattern).unwrap();
    re.find_iter(text)
        .map(|m| m.as_str())
        .collect::<Vec<_>>()
        .join("\n")
}
```

### 2.2 Tauri Command

```rust
#[tauri::command]
pub fn get_available_transforms() -> Vec<TransformInfo> {
    vec![
        TransformInfo { id: "uppercase".into(), label: "UPPERCASE".into(), group: "Case".into(), hotkey: Some("U".into()) },
        TransformInfo { id: "lowercase".into(), label: "lowercase".into(), group: "Case".into(), hotkey: Some("L".into()) },
        TransformInfo { id: "title_case".into(), label: "Title Case".into(), group: "Case".into(), hotkey: Some("T".into()) },
        // ... all transforms
    ]
}

#[tauri::command]
pub fn apply_text_transform(
    content: String,
    transform_id: String,
) -> Result<TransformResult, String> {
    let result = transform_text(&content, &transform_id)?;
    Ok(TransformResult {
        original: content,
        transformed: result.clone(),
        transform_id,
        char_diff: result.len() as i64 - content.len() as i64,
    })
}

#[tauri::command]
pub fn transform_and_paste(
    content: String,
    transform_id: String,
) -> Result<(), String> {
    let result = transform_text(&content, &transform_id)?;
    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.set_text(&result).map_err(|e| e.to_string())?;
    std::thread::sleep(std::time::Duration::from_millis(50));
    simulate_paste_keystroke()?;
    Ok(())
}
```

---

## 3. Build Steps

```
Ngày 1:
  ✅ Implement all transform functions (30+ transforms)
  ✅ Unit tests for each transform
  ✅ Tauri commands

Ngày 2:
  ✅ Frontend: transform menu popup (Cmd+Shift+T)
  ✅ Live preview: show transformed text before paste
  ✅ Hotkey shortcuts within menu (U=upper, L=lower...)
  ✅ Recently used transforms at top
  ✅ Add `rand` + `base64` + `urlencoding` to Cargo.toml
```

---

## 4. Cargo.toml additions

```toml
rand = "0.8"
base64 = "0.22"
urlencoding = "2"
```
