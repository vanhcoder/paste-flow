use serde::{Deserialize, Serialize};
use crate::db::DbPool;
use std::sync::Arc;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ClipboardItem {
    pub id: String,
    pub content_type: String,
    pub content_text: Option<String>,
    pub content_preview: Option<String>,
    pub source_app: Option<String>,
    pub byte_size: i64,
    pub is_pinned: bool,
    pub is_favorite: bool,
    pub use_count: i32,
    pub created_at: String,
}

#[tauri::command]
pub fn get_recent_items(
    db: tauri::State<'_, Arc<DbPool>>,
    limit: Option<i32>,
) -> Result<Vec<ClipboardItem>, String> {
    let limit = limit.unwrap_or(50);
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, content_type, NULL as content_text, content_preview,
                source_app, byte_size, is_pinned, is_favorite,
                use_count, created_at
         FROM clipboard_items
         ORDER BY is_pinned DESC, created_at DESC
         LIMIT ?1",
        )
        .map_err(|e| e.to_string())?;

    let items = stmt
        .query_map([limit], |row| {
            Ok(ClipboardItem {
                id: row.get(0)?,
                content_type: row.get(1)?,
                content_text: row.get(2)?,
                content_preview: row.get(3)?,
                source_app: row.get(4)?,
                byte_size: row.get(5)?,
                is_pinned: row.get(6)?,
                is_favorite: row.get(7)?,
                use_count: row.get(8)?,
                created_at: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let result: Vec<ClipboardItem> = items.filter_map(|i| i.ok()).collect();
    Ok(result)
}

#[tauri::command]
pub fn get_clip_content(
    db: tauri::State<'_, Arc<DbPool>>,
    id: String,
) -> Result<String, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    // Tăng use_count
    conn.execute(
        "UPDATE clipboard_items SET use_count = use_count + 1 WHERE id = ?1",
        [&id],
    )
    .map_err(|e| e.to_string())?;

    let content: Option<String> = conn
        .query_row(
            "SELECT content_text FROM clipboard_items WHERE id = ?1",
            [&id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    content.ok_or_else(|| "Item has no text content".to_string())
}

#[tauri::command]
pub fn pin_item(
    db: tauri::State<'_, Arc<DbPool>>,
    id: String,
    pinned: bool,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE clipboard_items SET is_pinned = ?1 WHERE id = ?2",
        rusqlite::params![pinned as i32, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_item(
    db: tauri::State<'_, Arc<DbPool>>,
    id: String,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM clipboard_items WHERE id = ?1", [&id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn clear_history(
    db: tauri::State<'_, Arc<DbPool>>,
) -> Result<u64, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let deleted = conn
        .execute("DELETE FROM clipboard_items WHERE is_pinned = 0", [])
        .map_err(|e| e.to_string())?;
    Ok(deleted as u64)
}
