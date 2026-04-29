use std::sync::Arc;
use crate::db::DbPool;
use tauri::State;

#[tauri::command]
pub fn get_setting(db: State<'_, Arc<DbPool>>, key: String) -> Result<Option<String>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let value = conn
        .query_row("SELECT value FROM settings WHERE key = ?1", [&key], |row| row.get(0))
        .ok();
    Ok(value)
}

#[tauri::command]
pub fn set_setting(db: State<'_, Arc<DbPool>>, key: String, value: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        [&key, &value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
