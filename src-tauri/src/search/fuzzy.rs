use serde::Serialize;
use crate::db::DbPool;
use std::sync::Arc;

#[derive(Serialize, Clone)]
pub struct SearchResult {
    pub id: String,
    pub result_type: String, // "history" | "template"
    pub title: String,
    pub preview: String,
    pub score: f64,
    pub group_name: Option<String>,
}

#[tauri::command]
pub fn search_all(
    db: tauri::State<'_, Arc<DbPool>>,
    query: String,
    limit: Option<i32>,
) -> Result<Vec<SearchResult>, String> {
    let limit = limit.unwrap_or(15);
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut results: Vec<SearchResult> = Vec::new();

    // 1. Search templates trước (ưu tiên cao hơn)
    {
        let mut stmt = conn
            .prepare(
                "SELECT t.id, t.title, t.content, g.name
             FROM templates t
             LEFT JOIN template_groups g ON t.group_id = g.id
             WHERE t.title LIKE '%' || ?1 || '%'
                OR t.content LIKE '%' || ?1 || '%'
                OR t.tags LIKE '%' || ?1 || '%'
             ORDER BY t.use_count DESC
             LIMIT ?2",
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map(rusqlite::params![query, limit], |row| {
                let content: String = row.get(2)?;
                Ok(SearchResult {
                    id: row.get(0)?,
                    result_type: "template".into(),
                    title: row.get(1)?,
                    preview: content.chars().take(200).collect(),
                    score: 1.0,
                    group_name: row.get(3)?,
                })
            })
            .map_err(|e| e.to_string())?;

        for row in rows.flatten() {
            results.push(row);
        }
    }

    // 2. Search clipboard history
    {
        let remaining = limit - results.len() as i32;
        if remaining > 0 {
            let mut stmt = conn
                .prepare(
                    "SELECT id, content_preview, source_app
                 FROM clipboard_items
                 WHERE content_preview LIKE '%' || ?1 || '%'
                    OR source_app LIKE '%' || ?1 || '%'
                 ORDER BY use_count DESC, created_at DESC
                 LIMIT ?2",
                )
                .map_err(|e| e.to_string())?;

            let rows = stmt
                .query_map(rusqlite::params![query, remaining], |row| {
                    let preview: String = row.get(1)?;
                    let source: Option<String> = row.get(2)?;
                    Ok(SearchResult {
                        id: row.get(0)?,
                        result_type: "history".into(),
                        title: source.unwrap_or_else(|| "Clipboard".to_string()),
                        preview,
                        score: 0.5,
                        group_name: None,
                    })
                })
                .map_err(|e| e.to_string())?;

            for row in rows.flatten() {
                results.push(row);
            }
        }
    }

    Ok(results)
}
