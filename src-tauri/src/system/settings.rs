use crate::db::DbPool;
use tauri::State;

#[tauri::command]
pub fn get_setting(db: State<DbPool>, key: String) -> Result<Option<String>, String> {
    let conn = db.0.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT value FROM settings WHERE key = ?1")
        .map_err(|e| e.to_string())?;
    
    let value = stmt.query_row([key], |row| row.get(0)).ok();
    Ok(value)
}

#[tauri::command]
pub fn set_setting(db: State<DbPool>, key: String, value: String) -> Result<(), String> {
    let conn = db.0.lock().unwrap();
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        [key, value],
    )
    .map_err(|e| e.to_string())?;
    
    Ok(())
}
