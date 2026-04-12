use rusqlite::Connection;
use std::sync::Mutex;
use tauri::Manager;

pub struct DbPool(pub Mutex<Connection>);

pub fn init_db(app: &tauri::AppHandle) -> DbPool {
    // Lưu DB trong app data directory (persistent qua updates)
    let app_dir = app
        .path()
        .app_data_dir()
        .expect("Failed to get app data dir");
    std::fs::create_dir_all(&app_dir).ok();

    let db_path = app_dir.join("pasteflow.db");
    let conn = Connection::open(db_path).expect("Failed to open database");

    // Enable WAL mode cho performance
    conn.execute_batch("PRAGMA journal_mode=WAL;").ok();
    conn.execute_batch("PRAGMA foreign_keys=ON;").ok();

    // Run migrations
    run_migrations(&conn);

    DbPool(Mutex::new(conn))
}

fn run_migrations(conn: &Connection) {
    let _ = conn.execute_batch("
        ALTER TABLE templates ADD COLUMN group_id TEXT REFERENCES template_groups(id) ON DELETE SET NULL;
        ALTER TABLE templates ADD COLUMN updated_at TEXT DEFAULT (datetime('now','localtime'));
    ");
    
    conn.execute_batch(
        "
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
    ",
    )
    .expect("Failed to run migrations");
}
