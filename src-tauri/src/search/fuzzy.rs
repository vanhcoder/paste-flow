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
    let max = limit.unwrap_or(15) as usize;
    let conn = db.0.lock().map_err(|e| e.to_string())?;
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

        let pinned: Vec<SearchResult> = stmt.query_map(
            rusqlite::params![max as i64],
            |row| {
                let content: String = row.get(2)?;
                Ok(SearchResult {
                    id: row.get(0)?,
                    result_type: "template".into(),
                    title: row.get(1)?,
                    preview: content.chars().take(100).collect(),
                    score: 2.0,
                    group_name: row.get(3)?,
                })
            },
        ).map_err(|e| e.to_string())?
         .filter_map(|r| r.ok()).collect();

        let pinned_count = pinned.len();
        results.extend(pinned);

        let remaining = max.saturating_sub(pinned_count);
        if remaining > 0 {
            let mut stmt2 = conn.prepare(
                "SELECT id, content_preview, source_app
                 FROM clipboard_items
                 ORDER BY created_at DESC
                 LIMIT ?1"
            ).map_err(|e| e.to_string())?;

            let history: Vec<SearchResult> = stmt2.query_map(
                rusqlite::params![remaining as i64],
                |row| {
                    Ok(SearchResult {
                        id: row.get(0)?,
                        result_type: "history".into(),
                        title: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
                        preview: row.get::<_, Option<String>>(1)?.unwrap_or_default(),
                        score: 0.5,
                        group_name: None,
                    })
                },
            ).map_err(|e| e.to_string())?
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

        let templates: Vec<SearchResult> = stmt.query_map(
            rusqlite::params![like, max as i64],
            |row| {
                let content: String = row.get(2)?;
                let is_pinned: i32 = row.get(4)?;
                Ok(SearchResult {
                    id: row.get(0)?,
                    result_type: "template".into(),
                    title: row.get(1)?,
                    preview: content.chars().take(100).collect(),
                    score: if is_pinned != 0 { 1.5 } else { 1.0 },
                    group_name: row.get(3)?,
                })
            },
        ).map_err(|e| e.to_string())?
         .filter_map(|r| r.ok()).collect();

        let tpl_count = templates.len();
        results.extend(templates);

        let remaining = max.saturating_sub(tpl_count);
        if remaining > 0 {
            let mut stmt2 = conn.prepare(
                "SELECT id, content_preview, source_app
                 FROM clipboard_items
                 WHERE content_preview LIKE ?1 OR source_app LIKE ?1
                 ORDER BY use_count DESC, created_at DESC
                 LIMIT ?2"
            ).map_err(|e| e.to_string())?;

            let history: Vec<SearchResult> = stmt2.query_map(
                rusqlite::params![like, remaining as i64],
                |row| {
                    Ok(SearchResult {
                        id: row.get(0)?,
                        result_type: "history".into(),
                        title: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
                        preview: row.get::<_, Option<String>>(1)?.unwrap_or_default(),
                        score: 0.5,
                        group_name: None,
                    })
                },
            ).map_err(|e| e.to_string())?
             .filter_map(|r| r.ok()).collect();

            results.extend(history);
        }
    }

    Ok(results)
}
