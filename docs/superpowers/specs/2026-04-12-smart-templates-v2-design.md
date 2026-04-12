# Smart Templates V2 — Design Spec

## Problem

Users who reply/paste the same content repeatedly (support, sales, content creation) need a faster, smarter template system. Current implementation is too basic: text-only variables, no memory of previous values, no way to preview output, and auto-paste without user control.

## Target Users

- People who reply/paste the same content many times with small variations
- Two main use cases: **quick replies** (email, chat, support) and **content generation** (social posts, emails, docs)

## Scope

Five improvements to the existing template system:

1. Variable types (text, multiline, select, date, currency, number, percent)
2. Built-in auto-fill variables (date/time, clipboard)
3. Recent values memory with autocomplete
4. Preview screen with Copy/Paste choice
5. Pin/favorites + use_count tracking fix

---

## 1. Variable Type System

### Syntax

Variables are defined inline in template content using `{{name:type:options}}` syntax.

| Syntax | Type | UI Control | Output Example |
|--------|------|-----------|----------------|
| `{{name}}` | text (default) | Text input + recent autocomplete | Raw text |
| `{{message:multiline}}` | multiline | Textarea | Raw text |
| `{{gender:select:Anh,Chi,Ban}}` | select | Dropdown | Selected value |
| `{{date:date}}` | date | Date picker | DD/MM/YYYY |
| `{{date:date:YYYY-MM-DD}}` | date + custom format | Date picker | 2026-04-12 |
| `{{price:currency:VND}}` | currency | Number input | 1.000.000 d |
| `{{amount:currency:USD}}` | currency | Number input | $1,500.00 |
| `{{quantity:number}}` | number | Number input | 1,500,000 |
| `{{rate:percent}}` | percent | Number input | 15.6% |

### Parsing Rules

- Variable regex: `\{\{([^}]+)\}\}`
- Split captured group by `:` to extract `[name, type?, options?]`
- If no type specified, default to `text`
- Type is case-insensitive
- For `select` type, options are comma-separated
- For `currency` type, option is currency code (VND, USD, EUR, JPY)
- For `date` type, option is date format string (default DD/MM/YYYY)

### Currency Formatting

| Currency | Format | Separator | Symbol |
|----------|--------|-----------|--------|
| VND | 1.000.000 d | Dot thousands | Trailing d |
| USD | $1,500.00 | Comma thousands, dot decimal | Leading $ |
| EUR | 1.200,00 EUR | Dot thousands, comma decimal | Trailing EUR |
| JPY | 50,000 JPY | Comma thousands, no decimal | Trailing JPY |

### Variable Metadata Storage

The `variables` field in the `templates` table changes from a simple JSON array of names to a structured JSON array:

```json
[
  { "name": "customer_name", "type": "text" },
  { "name": "message", "type": "multiline" },
  { "name": "gender", "type": "select", "options": ["Anh", "Chi", "Ban"] },
  { "name": "price", "type": "currency", "options": "VND" },
  { "name": "send_date", "type": "date", "options": "DD/MM/YYYY" }
]
```

Built-in variables (TODAY, NOW, etc.) are NOT stored in this array. They are resolved at paste-time by the frontend.

---

## 2. Built-in Auto-fill Variables

These variables are resolved automatically at paste-time. They do NOT appear in the VariableModal form.

| Variable | Output |
|----------|--------|
| `{{TODAY}}` | 12/04/2026 (DD/MM/YYYY) |
| `{{TODAY:YYYY-MM-DD}}` | 2026-04-12 |
| `{{TODAY:DD/MM/YYYY}}` | 12/04/2026 |
| `{{TODAY:DD MMM YYYY}}` | 12 Apr 2026 |
| `{{NOW}}` | 12/04/2026 14:30 |
| `{{NOW:HH:mm}}` | 14:30 |
| `{{WEEKDAY}}` | Sunday |
| `{{MONTH}}` | April |
| `{{YEAR}}` | 2026 |
| `{{CLIPBOARD}}` | Current clipboard content |

### Resolution Order

1. Replace all built-in variables first (pattern: all-uppercase name)
2. Collect remaining user-input variables
3. If user-input variables exist, show VariableModal
4. If no user-input variables, go directly to preview

### Date Format Tokens

| Token | Output | Example |
|-------|--------|---------|
| YYYY | 4-digit year | 2026 |
| YY | 2-digit year | 26 |
| MM | Month (zero-padded) | 04 |
| DD | Day (zero-padded) | 12 |
| MMM | Month short name | Apr |
| MMMM | Month full name | April |
| HH | Hour 24h (zero-padded) | 14 |
| mm | Minute (zero-padded) | 30 |
| ss | Second (zero-padded) | 05 |

---

## 3. Recent Values Memory

### Storage

New SQLite table `variable_history`:

```sql
CREATE TABLE IF NOT EXISTS variable_history (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id   TEXT NOT NULL,
    variable_name TEXT NOT NULL,
    value         TEXT NOT NULL,
    used_at       TEXT DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_var_history_lookup
    ON variable_history(template_id, variable_name, used_at DESC);
```

### Behavior

- On successful paste: save all user-entered variable values to `variable_history`
- Per variable per template: keep max 10 most recent entries
- Cleanup: after insert, delete entries beyond the 10th for that variable+template combo
- Deduplicate: if the same value already exists, update `used_at` instead of inserting

### UX in VariableModal

- Below each input field: show recent values as clickable chips
- Chips sorted by most recently used
- Click chip: fill the input immediately
- For `select` type: reorder dropdown with most-used option first
- For `currency`/`number`/`percent`: display chips in formatted form, store raw value

### Backend Commands

- `save_variable_values(template_id, values: Vec<{name, value}>)` — called after paste
- `get_recent_values(template_id, variable_name, limit=10)` — called when VariableModal opens

---

## 4. Preview + Copy/Paste Flow

### Current Flow (being replaced)

```
Select template -> Fill variables -> Auto-paste immediately
```

### New Flow

```
Select template
    |
    v
Resolve built-in variables (TODAY, NOW, etc.)
    |
    v
Has user-input variables? --NO--> Preview screen
    |YES
    v
VariableModal (fill values)
    |
    v
Preview screen
    |
    v
User chooses: [Copy] or [Paste]
```

### Preview Screen Design

Replaces the immediate paste action. Shown inside the QuickPaste popup window:

```
+-------------------------------------+
|  Template: Email chao hang          |
+-------------------------------------+
|                                     |
|  Chao Anh Minh,                     |
|                                     |
|  Bao gia cho san pham X:            |
|  Gia: 1.000.000 d                   |
|  Ngay: 12/04/2026                   |
|                                     |
|  Than men,                          |
|  PasteFlow Team                     |
|                                     |
+-------------------------------------+
|  [<- Back]    [Copy]    [Paste]     |
+-------------------------------------+
```

- **Back**: Return to VariableModal to edit values
- **Copy**: Copy final text to clipboard, close popup. User pastes manually when ready.
- **Paste**: Copy to clipboard + simulate Ctrl+V to active app (current behavior). Close popup.
- Keyboard shortcuts: `C` for Copy, `Enter` for Paste, `Escape` or `Backspace` for Back
- For templates with NO variables and NO built-in variables: skip preview, paste directly (preserve fast flow for simple templates)

---

## 5. Pin/Favorites + use_count Fix

### Pin

Add `is_pinned` column to `templates` table:

```sql
ALTER TABLE templates ADD COLUMN is_pinned INTEGER DEFAULT 0;
```

- MainWindow: pin icon on template card (toggle)
- Backend: `pin_template(id, pinned: bool)` command

### QuickPaste Behavior with Pins

When QuickPaste opens with empty query:

```
+-------------------------------------+
|  Search history & templates...      |
+-------------------------------------+
|  PINNED                             |
|    * Email chao hang          Cmd1  |
|    * Reply support            Cmd2  |
|    * Bao gia nhanh            Cmd3  |
|  ---------------------------------- |
|  RECENT                             |
|    clipboard item 1           Cmd4  |
|    clipboard item 2           Cmd5  |
+-------------------------------------+
```

- Pinned templates always appear first when query is empty
- When searching: pinned templates get a score boost (+0.5) to rank higher
- Pinned templates sorted by use_count DESC within the pinned section

### use_count Fix

Currently `use_count` in the `templates` table is never incremented.

- After successful paste (either Copy or Paste action): increment `use_count` for that template
- Backend command: `increment_template_use_count(id)` — called alongside `save_variable_values`
- Search results already sort by `use_count DESC`, so this will work automatically once incremented

---

## Data Migration

The `variables` field format changes from:
```json
["name", "message", "price"]
```
to:
```json
[{"name": "name", "type": "text"}, ...]
```

Migration strategy:
- On app startup, check if `variables` field contains old format (JSON array of strings)
- If old format detected, convert each string to `{"name": string, "type": "text"}`
- This is a one-time migration, backward compatible

---

## Files to Modify

### Backend (Rust)
- `src-tauri/src/db.rs` — new table `variable_history`, add `is_pinned` column, migration logic
- `src-tauri/src/templates/mod.rs` — new variable parsing logic, pin command, use_count increment, recent values commands
- `src-tauri/src/search/fuzzy.rs` — pinned template boost in search, pinned-first in empty query

### Frontend (TypeScript/React)
- `src/lib/tauri.ts` — new API functions
- `src/stores/templateStore.ts` — pin state, use_count
- `src/components/Templates/VariableModal.tsx` — rich variable types UI (dropdown, date picker, currency input, recent chips)
- `src/components/Templates/TemplatePreview.tsx` — new component: preview screen with Copy/Paste
- `src/components/Templates/TemplateManager.tsx` — pin toggle on cards, display use_count
- `src/windows/QuickPaste.tsx` — pinned section, preview flow integration
- `src/lib/variables.ts` — new: variable parsing, built-in resolution, currency/number formatting

---

## Out of Scope

- Visual template builder / WYSIWYG editor
- Conditional sections (if/else logic in templates)
- Template sharing / export / import
- Nested template groups
- Template versioning / undo
- Editable preview (user edits final text before paste)
