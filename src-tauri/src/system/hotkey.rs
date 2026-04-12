use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};
use crate::db::DbPool;

/// Shared map: normalized shortcut string → action name
pub struct HotkeyMap(pub Arc<Mutex<HashMap<String, String>>>);

/// All configurable hotkey actions with their settings keys
const HOTKEY_ACTIONS: &[(&str, &str)] = &[
    ("hotkey_quick_paste", "quick_paste"),
    ("hotkey_queue_toggle", "queue_toggle"),
    ("hotkey_queue_next", "queue_next"),
];

fn get_setting_value(db: &DbPool, key: &str) -> Option<String> {
    let conn = db.0.lock().unwrap();
    let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1").ok()?;
    stmt.query_row([key], |row| row.get(0)).ok()
}

fn set_setting_value(db: &DbPool, key: &str, value: &str) {
    let conn = db.0.lock().unwrap();
    let _ = conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        [key, value],
    );
}

/// Register all hotkeys from DB settings. Called at startup and after updates.
pub fn register_hotkeys_from_settings(app: &AppHandle, db: &DbPool) {
    let hotkey_map = app.state::<HotkeyMap>();
    let mut map = hotkey_map.0.lock().unwrap();
    map.clear();

    let gs = app.global_shortcut();
    let _ = gs.unregister_all();

    for &(setting_key, action) in HOTKEY_ACTIONS {
        if let Some(shortcut_str) = get_setting_value(db, setting_key) {
            if shortcut_str.is_empty() {
                continue;
            }
            if let Ok(shortcut) = shortcut_str.parse::<Shortcut>() {
                if gs.register(shortcut).is_ok() {
                    // Normalize for matching: lowercase, control→ctrl, command→cmd
                    let normalized = shortcut_str.to_lowercase()
                        .replace("control", "ctrl")
                        .replace("command", "cmd");
                    map.insert(normalized, action.to_string());
                }
            }
        }
    }
}

/// Look up which action a pressed shortcut maps to
pub fn resolve_action(app: &AppHandle, shortcut_normalized: &str) -> Option<String> {
    let hotkey_map = app.state::<HotkeyMap>();
    let map = hotkey_map.0.lock().unwrap();
    map.get(shortcut_normalized).cloned()
}

/// Tauri command: get all hotkey bindings as { setting_key: shortcut_string }
#[tauri::command]
pub fn get_hotkeys(db: State<Arc<DbPool>>) -> Result<HashMap<String, String>, String> {
    let mut result = HashMap::new();
    for &(setting_key, _) in HOTKEY_ACTIONS {
        let value = get_setting_value(&db, setting_key).unwrap_or_default();
        result.insert(setting_key.to_string(), value);
    }
    Ok(result)
}

/// Tauri command: update a specific hotkey binding
#[tauri::command]
pub fn update_hotkey(
    setting_key: String,
    shortcut: String,
    app: AppHandle,
    db: State<Arc<DbPool>>,
) -> Result<(), String> {
    // Validate: setting_key must be a known hotkey
    if !HOTKEY_ACTIONS.iter().any(|&(k, _)| k == setting_key) {
        return Err(format!("Unknown hotkey key: {}", setting_key));
    }

    // Validate: shortcut must be parseable (or empty to disable)
    if !shortcut.is_empty() {
        shortcut.parse::<Shortcut>()
            .map_err(|_| format!("Invalid shortcut format: {}", shortcut))?;
    }

    // Save to DB
    set_setting_value(&db, &setting_key, &shortcut);

    // Re-register all hotkeys
    register_hotkeys_from_settings(&app, &db);

    Ok(())
}
