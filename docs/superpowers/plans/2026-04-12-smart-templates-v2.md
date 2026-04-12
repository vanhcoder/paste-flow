# Smart Templates V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the template system with typed variables, built-in auto-fill (dates, clipboard), recent value memory, a preview screen with Copy/Paste choice, and pin/favorites.

**Architecture:** Backend changes to DB schema (new table + columns), template variable parsing (structured metadata), and new commands. Frontend adds a variable engine (parsing, formatting, built-in resolution), redesigned VariableModal with rich inputs, a new TemplatePreview component, and pinned templates in QuickPaste.

**Tech Stack:** Rust/Tauri (backend), React/TypeScript/Tailwind (frontend), SQLite, Zustand stores.

**Spec:** `docs/superpowers/specs/2026-04-12-smart-templates-v2-design.md`

---

### Task 1: DB Schema Changes

**Files:**
- Modify: `src-tauri/src/db.rs`

- [ ] **Step 1: Add `variable_history` table and `is_pinned` column**

In `src-tauri/src/db.rs`, add to the end of the `run_migrations()` function (before the final `);`), after the settings INSERT:

```rust
    // ── Smart Templates V2 migrations ──
    let _ = conn.execute_batch("
        ALTER TABLE templates ADD COLUMN is_pinned INTEGER DEFAULT 0;
    ");

    conn.execute_batch("
        CREATE TABLE IF NOT EXISTS variable_history (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            template_id   TEXT NOT NULL,
            variable_name TEXT NOT NULL,
            value         TEXT NOT NULL,
            used_at       TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE INDEX IF NOT EXISTS idx_var_history_lookup
            ON variable_history(template_id, variable_name, used_at DESC);
    ").expect("Failed to create variable_history table");
```

Note: `ALTER TABLE ... ADD COLUMN` uses `let _ =` because it will fail silently if column already exists (idempotent migration).

- [ ] **Step 2: Add variable format migration logic**

Add a new function in `db.rs` that migrates old-format variables (JSON array of strings) to new format (JSON array of objects). Call it at the end of `run_migrations()`:

```rust
fn migrate_variable_format(conn: &Connection) {
    let mut stmt = conn.prepare(
        "SELECT id, variables FROM templates WHERE variables IS NOT NULL AND variables != '[]'"
    ).unwrap();

    let rows: Vec<(String, String)> = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    }).unwrap().filter_map(|r| r.ok()).collect();

    for (id, vars_json) in rows {
        // Check if already new format (array of objects)
        if vars_json.contains("\"name\"") {
            continue;
        }
        // Old format: ["var1", "var2"] → new format: [{"name":"var1","type":"text"}, ...]
        if let Ok(old_vars) = serde_json::from_str::<Vec<String>>(&vars_json) {
            let new_vars: Vec<serde_json::Value> = old_vars.into_iter().map(|name| {
                serde_json::json!({"name": name, "type": "text"})
            }).collect();
            if let Ok(new_json) = serde_json::to_string(&new_vars) {
                let _ = conn.execute(
                    "UPDATE templates SET variables = ?1 WHERE id = ?2",
                    rusqlite::params![new_json, id],
                );
            }
        }
    }
}
```

Call at the end of `run_migrations()`:
```rust
    migrate_variable_format(conn);
```

- [ ] **Step 3: Verify compilation**

Run: `cd src-tauri && cargo check`
Expected: Compiles with no errors.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/db.rs
git commit -m "feat(db): add variable_history table, is_pinned column, variable format migration"
```

---

### Task 2: Backend Variable Parser

**Files:**
- Create: `src-tauri/src/templates/variables.rs`
- Modify: `src-tauri/src/templates/mod.rs` (use new parser)

- [ ] **Step 1: Create variable parser module**

Create `src-tauri/src/templates/variables.rs`:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VariableMeta {
    pub name: String,
    #[serde(rename = "type")]
    pub var_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<serde_json::Value>,
}

/// Parse template content and extract structured variable metadata.
/// Syntax: {{name}}, {{name:type}}, {{name:type:options}}
/// Built-in variables (ALL_CAPS like TODAY, NOW) are excluded.
pub fn parse_variables(content: &str) -> Vec<VariableMeta> {
    let re = regex::Regex::new(r"\{\{([^}]+)\}\}").unwrap();
    let mut seen = std::collections::HashSet::new();
    let mut result = Vec::new();

    for cap in re.captures_iter(content) {
        let raw = cap[1].trim().to_string();

        // Skip built-in variables (all uppercase, optionally with :format)
        let name_part = raw.split(':').next().unwrap_or("");
        if name_part == name_part.to_uppercase() && name_part.chars().all(|c| c.is_ascii_uppercase() || c == '_') {
            continue;
        }

        // Deduplicate by name
        let parts: Vec<&str> = raw.splitn(3, ':').collect();
        let name = parts[0].to_string();
        if seen.contains(&name) {
            continue;
        }
        seen.insert(name.clone());

        let var_type = parts.get(1).unwrap_or(&"text").to_string();
        let options = parts.get(2).map(|o| {
            if var_type == "select" {
                // Comma-separated options → JSON array
                let opts: Vec<&str> = o.split(',').map(|s| s.trim()).collect();
                serde_json::json!(opts)
            } else {
                // Currency code, date format, etc. → JSON string
                serde_json::json!(o.to_string())
            }
        });

        result.push(VariableMeta {
            name,
            var_type,
            options,
        });
    }

    result
}

/// Serialize variable metadata to JSON string for DB storage.
pub fn variables_to_json(vars: &[VariableMeta]) -> String {
    serde_json::to_string(vars).unwrap_or_else(|_| "[]".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_text_variable() {
        let vars = parse_variables("Hello {{name}}, welcome!");
        assert_eq!(vars.len(), 1);
        assert_eq!(vars[0].name, "name");
        assert_eq!(vars[0].var_type, "text");
    }

    #[test]
    fn test_typed_variables() {
        let content = "Price: {{price:currency:VND}}, Date: {{date:date:YYYY-MM-DD}}";
        let vars = parse_variables(content);
        assert_eq!(vars.len(), 2);
        assert_eq!(vars[0].name, "price");
        assert_eq!(vars[0].var_type, "currency");
        assert_eq!(vars[1].name, "date");
        assert_eq!(vars[1].var_type, "date");
    }

    #[test]
    fn test_select_variable() {
        let vars = parse_variables("Dear {{title:select:Mr,Mrs,Ms}}");
        assert_eq!(vars.len(), 1);
        assert_eq!(vars[0].var_type, "select");
        let opts = vars[0].options.as_ref().unwrap().as_array().unwrap();
        assert_eq!(opts.len(), 3);
    }

    #[test]
    fn test_builtin_excluded() {
        let vars = parse_variables("Today is {{TODAY}} and {{name}} says hi");
        assert_eq!(vars.len(), 1);
        assert_eq!(vars[0].name, "name");
    }

    #[test]
    fn test_deduplication() {
        let vars = parse_variables("{{name}} and {{name}} again");
        assert_eq!(vars.len(), 1);
    }
}
```

- [ ] **Step 2: Register module and update `create_template` / `update_template`**

In `src-tauri/src/templates/mod.rs`, add at the top (after existing `use` statements):

```rust
pub mod variables;
```

Then replace the variable extraction logic in `create_template` (the regex block around lines 137-139) with:

```rust
    let vars = variables::parse_variables(&payload.content);
    let variables_json = variables::variables_to_json(&vars);
```

And replace the same block in `update_template` (around lines 172-174) with:

```rust
        let vars = variables::parse_variables(&c);
        let variables_json = variables::variables_to_json(&vars);
```

Remove the `regex` crate import from these functions since `variables.rs` handles it internally.

- [ ] **Step 3: Run tests and verify**

Run: `cd src-tauri && cargo test -- templates::variables`
Expected: All 5 tests pass.

Run: `cd src-tauri && cargo check`
Expected: Compiles with no errors.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/templates/variables.rs src-tauri/src/templates/mod.rs
git commit -m "feat(templates): add structured variable parser with type support"
```

---

### Task 3: Backend Template Commands (Pin, use_count, Variable History)

**Files:**
- Modify: `src-tauri/src/templates/mod.rs`
- Modify: `src-tauri/src/lib.rs` (register new commands)

- [ ] **Step 1: Add new structs and commands to `templates/mod.rs`**

Add these structs after the existing `UpdateTemplatePayload`:

```rust
#[derive(Deserialize)]
pub struct SaveVariableValuesPayload {
    pub template_id: String,
    pub values: Vec<VariableValue>,
}

#[derive(Deserialize)]
pub struct VariableValue {
    pub name: String,
    pub value: String,
}
```

Add these new commands at the end of the file (before the closing):

```rust
#[tauri::command]
pub fn pin_template(db: State<Arc<DbPool>>, id: String, pinned: bool) -> Result<(), String> {
    let conn = db.0.lock().unwrap();
    conn.execute(
        "UPDATE templates SET is_pinned = ?1 WHERE id = ?2",
        params![pinned as i32, id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn increment_template_use_count(db: State<Arc<DbPool>>, id: String) -> Result<(), String> {
    let conn = db.0.lock().unwrap();
    conn.execute(
        "UPDATE templates SET use_count = use_count + 1 WHERE id = ?1",
        params![id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn save_variable_values(
    db: State<Arc<DbPool>>,
    payload: SaveVariableValuesPayload,
) -> Result<(), String> {
    let conn = db.0.lock().unwrap();
    for v in &payload.values {
        if v.value.is_empty() {
            continue;
        }
        // Upsert: if same value exists, update used_at; else insert
        let existing: Option<i64> = conn.prepare(
            "SELECT id FROM variable_history WHERE template_id = ?1 AND variable_name = ?2 AND value = ?3"
        ).map_err(|e| e.to_string())?
         .query_row(params![payload.template_id, v.name, v.value], |row| row.get(0))
         .ok();

        if let Some(row_id) = existing {
            conn.execute(
                "UPDATE variable_history SET used_at = datetime('now','localtime') WHERE id = ?1",
                params![row_id],
            ).map_err(|e| e.to_string())?;
        } else {
            conn.execute(
                "INSERT INTO variable_history (template_id, variable_name, value) VALUES (?1, ?2, ?3)",
                params![payload.template_id, v.name, v.value],
            ).map_err(|e| e.to_string())?;
        }

        // Cleanup: keep only 10 most recent per variable per template
        conn.execute(
            "DELETE FROM variable_history WHERE id IN (
                SELECT id FROM variable_history
                WHERE template_id = ?1 AND variable_name = ?2
                ORDER BY used_at DESC
                LIMIT -1 OFFSET 10
            )",
            params![payload.template_id, v.name],
        ).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn get_recent_values(
    db: State<Arc<DbPool>>,
    template_id: String,
    variable_name: String,
) -> Result<Vec<String>, String> {
    let conn = db.0.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT value FROM variable_history
         WHERE template_id = ?1 AND variable_name = ?2
         ORDER BY used_at DESC LIMIT 10"
    ).map_err(|e| e.to_string())?;

    let values = stmt.query_map(params![template_id, variable_name], |row| {
        row.get::<_, String>(0)
    }).map_err(|e| e.to_string())?
      .filter_map(|r| r.ok())
      .collect();

    Ok(values)
}
```

- [ ] **Step 2: Update `Template` struct to include `is_pinned`**

In `templates/mod.rs`, add `is_pinned` to the `Template` struct:

```rust
pub struct Template {
    pub id: String,
    pub group_id: Option<String>,
    pub title: String,
    pub content: String,
    pub shortcut: Option<String>,
    pub tags: String,
    pub variables: String,
    pub use_count: i32,
    pub is_pinned: bool,
    pub created_at: String,
}
```

Update `map_template` to read the new column (add it to all SELECT queries and the mapping function):

```rust
fn map_template(row: &rusqlite::Row) -> rusqlite::Result<Template> {
    Ok(Template {
        id: row.get(0)?,
        group_id: row.get(1)?,
        title: row.get(2)?,
        content: row.get(3)?,
        shortcut: row.get(4)?,
        tags: row.get(5)?,
        variables: row.get(6)?,
        use_count: row.get(7)?,
        is_pinned: row.get::<_, i32>(8)? != 0,
        created_at: row.get(9)?,
    })
}
```

Update ALL `SELECT` statements in `list_templates`, `get_template` to include `is_pinned`:

```sql
SELECT id, group_id, title, content, shortcut, tags, variables, use_count, is_pinned, created_at FROM templates ...
```

- [ ] **Step 3: Register new commands in `lib.rs`**

Add to the `invoke_handler` array in `src-tauri/src/lib.rs`:

```rust
            templates::pin_template,
            templates::increment_template_use_count,
            templates::save_variable_values,
            templates::get_recent_values,
```

- [ ] **Step 4: Verify compilation**

Run: `cd src-tauri && cargo check`
Expected: Compiles with no errors.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/templates/mod.rs src-tauri/src/lib.rs
git commit -m "feat(templates): add pin, use_count increment, and variable history commands"
```

---

### Task 4: Backend Search — Pinned Templates

**Files:**
- Modify: `src-tauri/src/search/fuzzy.rs`

- [ ] **Step 1: Update search to show pinned templates first on empty query**

Replace the `search_all` function in `src-tauri/src/search/fuzzy.rs`. The key changes:
- Empty query → return pinned templates first, then recent clipboard
- Non-empty query → pinned templates get score boost (+0.5, so 1.5 vs 1.0)

```rust
#[tauri::command]
pub fn search_all(
    db: State<Arc<DbPool>>,
    query: String,
    limit: Option<i32>,
) -> Result<Vec<SearchResult>, String> {
    let conn = db.0.lock().unwrap();
    let max = limit.unwrap_or(15) as usize;
    let mut results: Vec<SearchResult> = Vec::new();

    if query.trim().is_empty() {
        // ── Empty query: pinned templates first, then recent clipboard ──
        let mut stmt = conn.prepare(
            "SELECT t.id, t.title, t.content, g.name as group_name
             FROM templates t
             LEFT JOIN template_groups g ON t.group_id = g.id
             WHERE t.is_pinned = 1
             ORDER BY t.use_count DESC, t.created_at DESC
             LIMIT ?1"
        ).map_err(|e| e.to_string())?;

        let pinned: Vec<SearchResult> = stmt.query_map(params![max as i64], |row| {
            let content: String = row.get(2)?;
            Ok(SearchResult {
                id: row.get(0)?,
                result_type: "template".to_string(),
                title: row.get(1)?,
                preview: content.chars().take(100).collect(),
                score: 2.0, // highest priority
                group_name: row.get(3)?,
            })
        }).map_err(|e| e.to_string())?
          .filter_map(|r| r.ok()).collect();

        let pinned_count = pinned.len();
        results.extend(pinned);

        // Fill remaining with recent clipboard
        let remaining = max.saturating_sub(pinned_count);
        if remaining > 0 {
            let mut stmt2 = conn.prepare(
                "SELECT id, content_preview, source_app
                 FROM clipboard_items
                 ORDER BY created_at DESC
                 LIMIT ?1"
            ).map_err(|e| e.to_string())?;

            let history: Vec<SearchResult> = stmt2.query_map(params![remaining as i64], |row| {
                Ok(SearchResult {
                    id: row.get(0)?,
                    result_type: "history".to_string(),
                    title: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
                    preview: row.get::<_, Option<String>>(1)?.unwrap_or_default(),
                    score: 0.5,
                    group_name: None,
                })
            }).map_err(|e| e.to_string())?
              .filter_map(|r| r.ok()).collect();

            results.extend(history);
        }
    } else {
        // ── Search query: templates first (pinned boosted), then history ──
        let like = format!("%{}%", query);

        let mut stmt = conn.prepare(
            "SELECT t.id, t.title, t.content, g.name as group_name, t.is_pinned
             FROM templates t
             LEFT JOIN template_groups g ON t.group_id = g.id
             WHERE t.title LIKE ?1 OR t.content LIKE ?1 OR t.tags LIKE ?1
             ORDER BY t.is_pinned DESC, t.use_count DESC
             LIMIT ?2"
        ).map_err(|e| e.to_string())?;

        let templates: Vec<SearchResult> = stmt.query_map(params![like, max as i64], |row| {
            let content: String = row.get(2)?;
            let is_pinned: i32 = row.get(4)?;
            Ok(SearchResult {
                id: row.get(0)?,
                result_type: "template".to_string(),
                title: row.get(1)?,
                preview: content.chars().take(100).collect(),
                score: if is_pinned != 0 { 1.5 } else { 1.0 },
                group_name: row.get(3)?,
            })
        }).map_err(|e| e.to_string())?
          .filter_map(|r| r.ok()).collect();

        let tpl_count = templates.len();
        results.extend(templates);

        // Fill remaining with history
        let remaining = max.saturating_sub(tpl_count);
        if remaining > 0 {
            let mut stmt2 = conn.prepare(
                "SELECT id, content_preview, source_app
                 FROM clipboard_items
                 WHERE content_preview LIKE ?1 OR source_app LIKE ?1
                 ORDER BY use_count DESC, created_at DESC
                 LIMIT ?2"
            ).map_err(|e| e.to_string())?;

            let history: Vec<SearchResult> = stmt2.query_map(params![like, remaining as i64], |row| {
                Ok(SearchResult {
                    id: row.get(0)?,
                    result_type: "history".to_string(),
                    title: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
                    preview: row.get::<_, Option<String>>(1)?.unwrap_or_default(),
                    score: 0.5,
                    group_name: None,
                })
            }).map_err(|e| e.to_string())?
              .filter_map(|r| r.ok()).collect();

            results.extend(history);
        }
    }

    Ok(results)
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd src-tauri && cargo check`
Expected: Compiles with no errors.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/search/fuzzy.rs
git commit -m "feat(search): pinned templates first on empty query, score boost for pinned in search"
```

---

### Task 5: Frontend Variable Engine

**Files:**
- Create: `src/lib/variables.ts`

- [ ] **Step 1: Create the variable engine**

Create `src/lib/variables.ts` — handles parsing, built-in resolution, and formatting:

```typescript
// ══════════════════════════════════════════
// Types
// ══════════════════════════════════════════

export interface VariableMeta {
  name: string;
  type: string;
  options?: string | string[];
}

// ══════════════════════════════════════════
// Built-in Variable Resolution
// ══════════════════════════════════════════

const DATE_TOKENS: Record<string, (d: Date) => string> = {
  YYYY: (d) => String(d.getFullYear()),
  YY: (d) => String(d.getFullYear()).slice(-2),
  MM: (d) => String(d.getMonth() + 1).padStart(2, "0"),
  DD: (d) => String(d.getDate()).padStart(2, "0"),
  MMMM: (d) =>
    d.toLocaleString("en-US", { month: "long" }),
  MMM: (d) =>
    d.toLocaleString("en-US", { month: "short" }),
  HH: (d) => String(d.getHours()).padStart(2, "0"),
  mm: (d) => String(d.getMinutes()).padStart(2, "0"),
  ss: (d) => String(d.getSeconds()).padStart(2, "0"),
};

function formatDate(date: Date, fmt: string): string {
  let result = fmt;
  // Replace longest tokens first to avoid partial matches (MMMM before MM)
  const sorted = Object.keys(DATE_TOKENS).sort((a, b) => b.length - a.length);
  for (const token of sorted) {
    result = result.replace(new RegExp(token, "g"), DATE_TOKENS[token](date));
  }
  return result;
}

function resolveBuiltin(name: string, format?: string): string | null {
  const now = new Date();

  switch (name) {
    case "TODAY":
      return formatDate(now, format || "DD/MM/YYYY");
    case "NOW":
      return formatDate(now, format || "DD/MM/YYYY HH:mm");
    case "WEEKDAY":
      return now.toLocaleString("en-US", { weekday: "long" });
    case "MONTH":
      return now.toLocaleString("en-US", { month: "long" });
    case "YEAR":
      return String(now.getFullYear());
    case "CLIPBOARD":
      return null; // Resolved separately via clipboard API
    default:
      return null;
  }
}

function isBuiltinVariable(name: string): boolean {
  return /^[A-Z_]+$/.test(name);
}

/**
 * Replace all built-in variables in content (TODAY, NOW, WEEKDAY, etc.)
 * Returns content with built-ins resolved + the clipboard value if CLIPBOARD was used.
 */
export function resolveBuiltins(
  content: string,
  clipboardText?: string,
): string {
  return content.replace(/\{\{([^}]+)\}\}/g, (match, raw: string) => {
    const parts = raw.trim().split(":");
    const name = parts[0];

    if (!isBuiltinVariable(name)) return match; // Not a built-in

    if (name === "CLIPBOARD") {
      return clipboardText ?? match;
    }

    const format = parts.slice(1).join(":");
    const resolved = resolveBuiltin(name, format || undefined);
    return resolved ?? match;
  });
}

// ══════════════════════════════════════════
// User Variable Parsing
// ══════════════════════════════════════════

/**
 * Parse variable metadata from structured JSON (new format from backend).
 */
export function parseVariableMeta(variablesJson: string): VariableMeta[] {
  try {
    const parsed = JSON.parse(variablesJson);
    if (!Array.isArray(parsed)) return [];

    return parsed.map((v: any) => {
      if (typeof v === "string") {
        // Old format compatibility
        return { name: v, type: "text" };
      }
      return {
        name: v.name,
        type: v.type || "text",
        options: v.options,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Check if template content has any user-input variables (non-builtin).
 */
export function hasUserVariables(variablesJson: string): boolean {
  return parseVariableMeta(variablesJson).length > 0;
}

/**
 * Check if template content has any built-in variables.
 */
export function hasBuiltinVariables(content: string): boolean {
  const re = /\{\{([A-Z_]+(?::[^}]*)?)\}\}/;
  return re.test(content);
}

// ══════════════════════════════════════════
// Value Formatting
// ══════════════════════════════════════════

const CURRENCY_CONFIG: Record<
  string,
  { locale: string; currency: string; minimumFractionDigits: number }
> = {
  VND: { locale: "vi-VN", currency: "VND", minimumFractionDigits: 0 },
  USD: { locale: "en-US", currency: "USD", minimumFractionDigits: 2 },
  EUR: { locale: "de-DE", currency: "EUR", minimumFractionDigits: 2 },
  JPY: { locale: "ja-JP", currency: "JPY", minimumFractionDigits: 0 },
};

export function formatCurrency(value: number, currencyCode: string): string {
  const cfg = CURRENCY_CONFIG[currencyCode.toUpperCase()];
  if (!cfg) return `${value} ${currencyCode}`;
  return new Intl.NumberFormat(cfg.locale, {
    style: "currency",
    currency: cfg.currency,
    minimumFractionDigits: cfg.minimumFractionDigits,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Format a user-entered value based on variable type.
 * `rawValue` is the string from the input field.
 */
export function formatValue(
  rawValue: string,
  varMeta: VariableMeta,
): string {
  if (!rawValue) return "";

  switch (varMeta.type) {
    case "currency": {
      const num = parseFloat(rawValue.replace(/[^0-9.-]/g, ""));
      if (isNaN(num)) return rawValue;
      const code = (typeof varMeta.options === "string" ? varMeta.options : "USD");
      return formatCurrency(num, code);
    }
    case "number": {
      const num = parseFloat(rawValue.replace(/[^0-9.-]/g, ""));
      if (isNaN(num)) return rawValue;
      return formatNumber(num);
    }
    case "percent": {
      const num = parseFloat(rawValue.replace(/[^0-9.-]/g, ""));
      if (isNaN(num)) return rawValue;
      return formatPercent(num);
    }
    case "date": {
      // rawValue is a date string from input[type=date] → YYYY-MM-DD
      const d = new Date(rawValue + "T00:00:00");
      if (isNaN(d.getTime())) return rawValue;
      const fmt = (typeof varMeta.options === "string" ? varMeta.options : "DD/MM/YYYY");
      return formatDate(d, fmt);
    }
    default:
      return rawValue;
  }
}

/**
 * Apply all user-entered values to template content, with formatting.
 */
export function substituteVariables(
  content: string,
  values: Record<string, string>,
  variablesMeta: VariableMeta[],
): string {
  let result = content;
  const metaMap = new Map(variablesMeta.map((v) => [v.name, v]));

  for (const [name, rawValue] of Object.entries(values)) {
    const meta = metaMap.get(name) || { name, type: "text" };
    const formatted = formatValue(rawValue, meta);
    // Replace all occurrences of {{name}}, {{name:type}}, {{name:type:options}}
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`\\{\\{${escapedName}(?::[^}]*)?\\}\\}`, "g");
    result = result.replace(pattern, formatted || `{{${name}}}`);
  }

  return result;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/variables.ts
git commit -m "feat(frontend): add variable engine with types, built-in resolution, and formatting"
```

---

### Task 6: Frontend API + Type Updates

**Files:**
- Modify: `src/lib/tauri.ts`

- [ ] **Step 1: Update Template interface and add new API functions**

Update the `Template` interface to include `is_pinned`:

```typescript
export interface Template {
  id: string;
  group_id: string | null;
  title: string;
  content: string;
  shortcut: string | null;
  variables: string; // JSON string of VariableMeta[]
  use_count: number;
  is_pinned: boolean;
  created_at: string;
}
```

Add new API functions inside the `api` object:

```typescript
  // ── Template Actions ──
  pinTemplate: (id: string, pinned: boolean) =>
    invoke<void>("pin_template", { id, pinned }),

  incrementTemplateUseCount: (id: string) =>
    invoke<void>("increment_template_use_count", { id }),

  saveVariableValues: (templateId: string, values: { name: string; value: string }[]) =>
    invoke<void>("save_variable_values", { payload: { template_id: templateId, values } }),

  getRecentValues: (templateId: string, variableName: string) =>
    invoke<string[]>("get_recent_values", { templateId, variableName }),
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/tauri.ts
git commit -m "feat(api): add pin, use_count, and variable history API functions"
```

---

### Task 7: VariableModal Redesign

**Files:**
- Rewrite: `src/components/Templates/VariableModal.tsx`

- [ ] **Step 1: Rewrite VariableModal with rich variable types and recent values**

Rewrite `src/components/Templates/VariableModal.tsx` with support for all variable types, recent value chips, and the new structured variable metadata:

```tsx
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Template, api } from "../../lib/tauri";
import { parseVariableMeta, VariableMeta } from "../../lib/variables";

interface Props {
  template: Template;
  onClose: () => void;
  onConfirm: (values: Record<string, string>) => void;
}

export function VariableModal({ template, onClose, onConfirm }: Props) {
  const variables = parseVariableMeta(template.variables);
  const [values, setValues] = useState<Record<string, string>>({});
  const [recentValues, setRecentValues] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const initial: Record<string, string> = {};
    variables.forEach((v) => (initial[v.name] = ""));
    setValues(initial);

    // Load recent values for each variable
    variables.forEach((v) => {
      api.getRecentValues(template.id, v.name).then((recent) => {
        setRecentValues((prev) => ({ ...prev, [v.name]: recent }));
      });
    });
  }, [template.id]);

  const updateValue = (name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = () => {
    onConfirm(values);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-md mx-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
            Fill Variables
          </p>
          <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200 mt-1">
            {template.title}
          </p>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[50vh] overflow-y-auto">
          {variables.map((v) => (
            <VariableField
              key={v.name}
              meta={v}
              value={values[v.name] || ""}
              recentValues={recentValues[v.name] || []}
              onChange={(val) => updateValue(v.name, val)}
            />
          ))}
        </div>

        <div className="px-5 py-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-5 py-2 text-xs font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
          >
            Continue
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function VariableField({
  meta,
  value,
  recentValues,
  onChange,
}: {
  meta: VariableMeta;
  value: string;
  recentValues: string[];
  onChange: (val: string) => void;
}) {
  const label = meta.name.replace(/_/g, " ");

  const inputClasses =
    "w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all";

  return (
    <div>
      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
        {label}
        <span className="ml-1 text-zinc-400 normal-case font-normal tracking-normal">
          ({meta.type})
        </span>
      </label>

      {meta.type === "select" ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClasses}
        >
          <option value="">Select...</option>
          {(Array.isArray(meta.options) ? meta.options : []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : meta.type === "multiline" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${label}...`}
          rows={3}
          className={inputClasses + " resize-none"}
        />
      ) : meta.type === "date" ? (
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClasses}
        />
      ) : meta.type === "currency" || meta.type === "number" || meta.type === "percent" ? (
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            meta.type === "currency"
              ? `Amount (${typeof meta.options === "string" ? meta.options : "USD"})`
              : meta.type === "percent"
                ? "e.g. 0.15 for 15%"
                : "Enter number..."
          }
          step={meta.type === "percent" ? "0.01" : "1"}
          className={inputClasses}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${label}...`}
          className={inputClasses}
        />
      )}

      {/* Recent value chips */}
      {recentValues.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {recentValues.map((rv, i) => (
            <button
              key={i}
              onClick={() => onChange(rv)}
              className="px-2 py-0.5 text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 border border-zinc-200 dark:border-zinc-700 transition-colors"
            >
              {rv}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Templates/VariableModal.tsx
git commit -m "feat(ui): redesign VariableModal with rich variable types and recent value chips"
```

---

### Task 8: TemplatePreview Component

**Files:**
- Create: `src/components/Templates/TemplatePreview.tsx`

- [ ] **Step 1: Create preview component with Copy/Paste actions**

Create `src/components/Templates/TemplatePreview.tsx`:

```tsx
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Copy, Zap, ArrowLeft } from "lucide-react";

interface Props {
  title: string;
  content: string;
  onCopy: () => void;
  onPaste: () => void;
  onBack: () => void;
}

export function TemplatePreview({ title, content, onCopy, onPaste, onBack }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onPaste();
      } else if (e.key === "c" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        onCopy();
      } else if (e.key === "Escape" || e.key === "Backspace") {
        e.preventDefault();
        onBack();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCopy, onPaste, onBack]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex flex-col bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Preview</p>
          <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{title}</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <pre className="text-sm text-zinc-700 dark:text-zinc-200 whitespace-pre-wrap font-sans leading-relaxed">
          {content}
        </pre>
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
        <div className="flex gap-3 text-[10px] text-zinc-400">
          <span><kbd className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-[9px] font-bold border border-zinc-200 dark:border-zinc-700">C</kbd> Copy</span>
          <span><kbd className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-[9px] font-bold border border-zinc-200 dark:border-zinc-700">Enter</kbd> Paste</span>
          <span><kbd className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-[9px] font-bold border border-zinc-200 dark:border-zinc-700">Esc</kbd> Back</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCopy}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors border border-zinc-200 dark:border-zinc-700"
          >
            <Copy size={13} /> Copy
          </button>
          <button
            onClick={onPaste}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
          >
            <Zap size={13} className="fill-current" /> Paste
          </button>
        </div>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Templates/TemplatePreview.tsx
git commit -m "feat(ui): add TemplatePreview component with Copy/Paste actions"
```

---

### Task 9: QuickPaste Integration

**Files:**
- Modify: `src/windows/QuickPaste.tsx`

- [ ] **Step 1: Rewrite QuickPaste with pinned section, preview flow, and variable engine**

Rewrite `src/windows/QuickPaste.tsx` to integrate:
- Pinned templates section when query is empty
- Built-in variable resolution
- VariableModal for user variables
- TemplatePreview with Copy/Paste choice
- use_count increment + variable history save

```tsx
import { useEffect, useRef, useState } from "react";
import { useSearchStore as useLocalSearchStore } from "../stores/searchStore";
import { api, Template } from "../lib/tauri";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Search, Clock, Layers, Command, Pin } from "lucide-react";
import { VariableModal } from "../components/Templates/VariableModal";
import { TemplatePreview } from "../components/Templates/TemplatePreview";
import { AnimatePresence } from "framer-motion";
import {
  resolveBuiltins,
  parseVariableMeta,
  hasUserVariables,
  hasBuiltinVariables,
  substituteVariables,
} from "../lib/variables";

type FlowState =
  | { step: "search" }
  | { step: "variables"; template: Template; resolvedContent: string }
  | { step: "preview"; template: Template; finalContent: string; values: Record<string, string> };

export default function QuickPaste() {
  const { query, results, loading, selectedIdx, setQuery, moveSelection, search, reset } =
    useLocalSearchStore();
  const [flow, setFlow] = useState<FlowState>({ step: "search" });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    search();

    const unlisten = getCurrentWindow().onFocusChanged(({ payload: focused }) => {
      if (focused) {
        reset();
        search();
        setFlow({ step: "search" });
        inputRef.current?.focus();
      }
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  useEffect(() => {
    const el = document.getElementById(`item-${selectedIdx}`);
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedIdx]);

  // ── Template action flow ──
  const startTemplateFlow = async (tpl: Template) => {
    // Resolve built-in variables first
    let content = tpl.content;
    if (hasBuiltinVariables(content)) {
      // Read clipboard for {{CLIPBOARD}} support
      let clipboardText: string | undefined;
      try {
        const items = await api.getRecentItems(1);
        clipboardText = items[0]?.content_text ?? undefined;
      } catch {
        // ignore
      }
      content = resolveBuiltins(content, clipboardText);
    }

    const vars = parseVariableMeta(tpl.variables);
    if (vars.length > 0) {
      // Has user variables → show modal
      setFlow({ step: "variables", template: tpl, resolvedContent: content });
    } else {
      // No user variables → go to preview (or paste directly for simple templates)
      if (!hasBuiltinVariables(tpl.content)) {
        // Simple template, no variables at all → paste directly
        await doPaste(tpl, content, {});
      } else {
        // Has built-ins resolved → show preview
        setFlow({ step: "preview", template: tpl, finalContent: content, values: {} });
      }
    }
  };

  const handleVariableConfirm = (values: Record<string, string>) => {
    if (flow.step !== "variables") return;
    const meta = parseVariableMeta(flow.template.variables);
    const finalContent = substituteVariables(flow.resolvedContent, values, meta);
    setFlow({ step: "preview", template: flow.template, finalContent, values });
  };

  const handleCopy = async () => {
    if (flow.step !== "preview") return;
    // Copy to clipboard only
    await api.setSetting("_noop", ""); // dummy to avoid unused
    navigator.clipboard.writeText(flow.finalContent);
    await afterPaste(flow.template, flow.values);
    await getCurrentWindow().hide();
  };

  const handlePaste = async () => {
    if (flow.step !== "preview") return;
    await getCurrentWindow().hide();
    await api.pasteToActiveApp(flow.finalContent);
    await afterPaste(flow.template, flow.values);
  };

  const doPaste = async (tpl: Template, content: string, values: Record<string, string>) => {
    await getCurrentWindow().hide();
    await api.pasteToActiveApp(content);
    await afterPaste(tpl, values);
  };

  const afterPaste = async (tpl: Template, values: Record<string, string>) => {
    // Increment use count
    await api.incrementTemplateUseCount(tpl.id).catch(() => {});
    // Save variable values
    const entries = Object.entries(values)
      .filter(([, v]) => v)
      .map(([name, value]) => ({ name, value }));
    if (entries.length > 0) {
      await api.saveVariableValues(tpl.id, entries).catch(() => {});
    }
    setFlow({ step: "search" });
    reset();
  };

  // ── Action handler ──
  const handleAction = async (idx?: number) => {
    try {
      const targetIdx = idx !== undefined ? idx : selectedIdx;
      const item = results[targetIdx];
      if (!item) return;

      if (item.result_type === "history") {
        const content = await api.getClipContent(item.id);
        await getCurrentWindow().hide();
        await api.pasteToActiveApp(content);
        reset();
      } else {
        const tpl = await api.getTemplate(item.id);
        if (tpl) await startTemplateFlow(tpl);
      }
    } catch (err: any) {
      alert("ERROR: " + err.message);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveSelection("down");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveSelection("up");
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleAction();
    } else if (e.key === "Escape") {
      e.preventDefault();
      getCurrentWindow().hide();
    } else if (e.metaKey || e.ctrlKey) {
      const num = parseInt(e.key);
      if (num >= 1 && num <= 9) {
        e.preventDefault();
        handleAction(num - 1);
      }
    }
  };

  return (
    <div className="h-screen w-screen bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-[12px] shadow-2xl flex flex-col overflow-hidden select-none relative">
      {/* Search Header */}
      <div className="flex items-center px-4 py-4 border-b border-zinc-100 dark:border-zinc-800 gap-3">
        <Search size={18} className={loading ? "text-blue-500 animate-pulse" : "text-zinc-400"} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search history & templates..."
          className="flex-1 bg-transparent border-none outline-none text-base text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 font-medium"
        />
        <div className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[10px] text-zinc-400 font-bold tracking-widest uppercase">
          Popup
        </div>
      </div>

      {/* Results List */}
      <div className="flex-1 overflow-y-auto hide-scrollbar py-2">
        {results.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-400 py-10">
            <Command size={32} strokeWidth={1} className="mb-2 opacity-20" />
            <p className="text-sm font-medium">No results found</p>
          </div>
        ) : (
          <>
            {/* Section headers for empty query */}
            {query.trim() === "" && results.some((r) => r.score >= 2.0) && (
              <p className="px-4 pt-1 pb-1 text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1">
                <Pin size={10} /> Pinned
              </p>
            )}
            {results.map((item, idx) => {
              // Insert "Recent" header between pinned and history
              const showRecentHeader =
                query.trim() === "" &&
                idx > 0 &&
                results[idx - 1].score >= 2.0 &&
                item.score < 2.0;

              return (
                <div key={`${item.id}-${idx}`}>
                  {showRecentHeader && (
                    <p className="px-4 pt-3 pb-1 text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1">
                      <Clock size={10} /> Recent
                    </p>
                  )}
                  <div
                    id={`item-${idx}`}
                    onMouseEnter={() => useLocalSearchStore.setState({ selectedIdx: idx })}
                    onClick={() => handleAction(idx)}
                    className={`mx-2 px-3 py-3 rounded-xl cursor-pointer transition-all flex items-start gap-3 relative
                      ${
                        selectedIdx === idx
                          ? "bg-blue-600 dark:bg-blue-600 text-white shadow-lg shadow-blue-500/20 translate-x-1"
                          : "hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-300"
                      }`}
                  >
                    <div className={`mt-0.5 shrink-0 ${selectedIdx === idx ? "text-blue-100" : "text-zinc-400"}`}>
                      {item.result_type === "history" ? <Clock size={14} /> : item.score >= 2.0 ? <Pin size={14} /> : <Layers size={14} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-[10px] font-bold uppercase tracking-wider truncate mb-0.5 ${selectedIdx === idx ? "text-blue-100/80" : "text-zinc-400"}`}>
                          {item.title} {item.group_name && `\u2022 ${item.group_name}`}
                        </p>
                        {idx < 9 && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                            selectedIdx === idx
                              ? "border-blue-400 bg-blue-500 text-white"
                              : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-400"
                          }`}>
                            \u2318{idx + 1}
                          </span>
                        )}
                      </div>
                      <p className={`text-sm truncate font-medium ${selectedIdx === idx ? "text-white" : "text-zinc-700 dark:text-zinc-200"}`}>
                        {item.preview}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-zinc-50/50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
        <div className="flex gap-4">
          <Hint keybd="\u2191\u2193" action="Navigate" />
          <Hint keybd="\u23CE" action="Paste" />
          <Hint keybd="Esc" action="Close" />
        </div>
      </div>

      {/* Overlay flows */}
      <AnimatePresence>
        {flow.step === "variables" && (
          <VariableModal
            template={flow.template}
            onClose={() => setFlow({ step: "search" })}
            onConfirm={handleVariableConfirm}
          />
        )}
        {flow.step === "preview" && (
          <TemplatePreview
            title={flow.template.title}
            content={flow.finalContent}
            onCopy={handleCopy}
            onPaste={handlePaste}
            onBack={() => {
              if (hasUserVariables(flow.template.variables)) {
                setFlow({ step: "variables", template: flow.template, resolvedContent: flow.finalContent });
              } else {
                setFlow({ step: "search" });
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Hint({ keybd, action }: { keybd: string; action: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <kbd className="px-1.5 py-0.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-[9px] font-bold text-zinc-500 shadow-sm">
        {keybd}
      </kbd>
      <span className="text-[10px] font-medium text-zinc-400">{action}</span>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/windows/QuickPaste.tsx
git commit -m "feat(quickpaste): integrate pinned section, preview flow, and variable engine"
```

---

### Task 10: TemplateManager Updates

**Files:**
- Modify: `src/components/Templates/TemplateManager.tsx`
- Modify: `src/stores/templateStore.ts`

- [ ] **Step 1: Add pin action to templateStore**

In `src/stores/templateStore.ts`, add a `pinTemplate` action:

```typescript
  pinTemplate: async (id: string, pinned: boolean) => {
    await api.pinTemplate(id, pinned);
    const groupId = getState().selectedGroupId;
    await getState().loadTemplates(groupId ?? undefined);
  },
```

- [ ] **Step 2: Update TemplateManager with pin toggle and use_count display**

In `src/components/Templates/TemplateManager.tsx`, make these changes:

1. Import `Pin` from lucide-react
2. On each template card, add a pin toggle button (next to edit/delete buttons):

```tsx
<button
  onClick={(e) => {
    e.stopPropagation();
    pinTemplate(tpl.id, !tpl.is_pinned);
  }}
  className={`p-1.5 rounded-lg transition-colors ${
    tpl.is_pinned
      ? "text-blue-500 bg-blue-50 dark:bg-blue-900/30"
      : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
  }`}
  title={tpl.is_pinned ? "Unpin" : "Pin to Quick Paste"}
>
  <Pin size={14} />
</button>
```

3. Display use_count on template cards:

```tsx
{tpl.use_count > 0 && (
  <span className="text-[10px] text-zinc-400">
    Used {tpl.use_count}x
  </span>
)}
```

4. Update the `handleConfirmExpansion` function to use the new variable engine instead of manual regex replacement, and to go through the preview flow:

Import variables utilities:
```typescript
import { resolveBuiltins, parseVariableMeta, substituteVariables, hasBuiltinVariables } from "../../lib/variables";
```

Replace the substitution logic:
```typescript
const handleConfirmExpansion = async (values: Record<string, string>) => {
  if (!expandingTemplate) return;
  let content = expandingTemplate.content;
  if (hasBuiltinVariables(content)) {
    content = resolveBuiltins(content);
  }
  const meta = parseVariableMeta(expandingTemplate.variables);
  const finalContent = substituteVariables(content, values, meta);

  await api.pasteToActiveApp(finalContent);
  await api.incrementTemplateUseCount(expandingTemplate.id).catch(() => {});

  const entries = Object.entries(values).filter(([,v]) => v).map(([name, value]) => ({ name, value }));
  if (entries.length > 0) {
    await api.saveVariableValues(expandingTemplate.id, entries).catch(() => {});
  }

  setExpandingTemplate(null);
};
```

- [ ] **Step 3: Verify app compiles**

Run: `cd src-tauri && cargo check`
Expected: No errors.

Run the dev server and visually verify:
- Pin button appears on template cards
- Pinning a template shows it in QuickPaste when query is empty
- Use count displays on cards

- [ ] **Step 4: Commit**

```bash
git add src/stores/templateStore.ts src/components/Templates/TemplateManager.tsx
git commit -m "feat(templates): add pin toggle, use_count display, and variable engine integration"
```

---

### Task 11: Final Verification

- [ ] **Step 1: Full compilation check**

```bash
cd src-tauri && cargo check
cd .. && npm run build
```

Expected: Both compile with no errors.

- [ ] **Step 2: Manual test checklist**

Run: `npm run tauri dev`

Test each feature:
1. Create template with `{{name}}` → text input in modal
2. Create template with `{{msg:multiline}}` → textarea in modal
3. Create template with `{{title:select:Mr,Mrs,Ms}}` → dropdown in modal
4. Create template with `{{date:date}}` → date picker in modal
5. Create template with `{{price:currency:VND}}` → number input, formatted output
6. Create template with `{{TODAY}}` in content → auto-resolves to today's date
7. Create template with `{{NOW:HH:mm}}` → auto-resolves to current time
8. Fill variables → Preview screen shows formatted content
9. Preview → Copy → content in clipboard (not auto-pasted)
10. Preview → Paste → content pasted to active app
11. Use template twice → recent values show as chips
12. Pin a template → appears first in QuickPaste empty query
13. Use count increments after paste

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: Smart Templates V2 - complete implementation"
```
