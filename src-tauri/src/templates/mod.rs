pub mod variables;

use serde::{Deserialize, Serialize};
use crate::db::DbPool;
use uuid::Uuid;
use tauri::State;
use std::sync::Arc;
use rusqlite::params;

#[derive(Debug, Serialize, Deserialize)]
pub struct TemplateGroup {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub color: String,
    pub sort_order: i32,
}

#[derive(Debug, Serialize, Deserialize)]
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

#[derive(Deserialize)]
pub struct ListTemplatesPayload {
    pub group_id: Option<String>,
}

#[derive(Deserialize)]
pub struct CreateTemplatePayload {
    pub title: String,
    pub content: String,
    pub group_id: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateTemplatePayload {
    pub id: String,
    pub title: Option<String>,
    pub content: Option<String>,
    pub group_id: Option<String>,
}

#[tauri::command]
pub fn list_template_groups(db: State<Arc<DbPool>>) -> Result<Vec<TemplateGroup>, String> {
    let conn = db.0.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, name, icon, color, sort_order FROM template_groups ORDER BY sort_order ASC")
        .map_err(|e: rusqlite::Error| e.to_string())?;

    let groups = stmt
        .query_map([], |row| {
            Ok(TemplateGroup {
                id: row.get(0)?,
                name: row.get(1)?,
                icon: row.get(2)?,
                color: row.get(3)?,
                sort_order: row.get(4)?,
            })
        })
        .map_err(|e: rusqlite::Error| e.to_string())?
        .collect::<Result<Vec<_>, rusqlite::Error>>()
        .map_err(|e: rusqlite::Error| e.to_string())?;

    Ok(groups)
}

#[tauri::command]
pub fn create_template_group(
    db: State<Arc<DbPool>>,
    name: String,
    icon: Option<String>,
    color: Option<String>,
) -> Result<TemplateGroup, String> {
    let id = Uuid::new_v4().to_string();
    let icon_str = icon.unwrap_or_else(|| "📁".to_string());
    let color_str = color.unwrap_or_else(|| "#3B82F6".to_string());
    
    let conn = db.0.lock().unwrap();
    conn.execute(
        "INSERT INTO template_groups (id, name, icon, color) VALUES (?1, ?2, ?3, ?4)",
        params![id, name, icon_str, color_str],
    ).map_err(|e| e.to_string())?;

    Ok(TemplateGroup {
        id,
        name,
        icon: icon_str,
        color: color_str,
        sort_order: 0,
    })
}

#[tauri::command]
pub fn list_templates(db: State<Arc<DbPool>>, payload: ListTemplatesPayload) -> Result<Vec<Template>, String> {
    let conn = db.0.lock().unwrap();
    let gid_val = payload.group_id.filter(|s| !s.is_empty() && s != "null" && s != "undefined");

    let templates = match gid_val {
        Some(ref gid) => {
            let mut stmt = conn.prepare("SELECT id, group_id, title, content, shortcut, tags, variables, use_count, is_pinned, created_at FROM templates WHERE group_id = ?1 ORDER BY created_at DESC")
                .map_err(|e: rusqlite::Error| e.to_string())?;
            let items = stmt.query_map(params![gid], |row| map_template(row))
                .map_err(|e: rusqlite::Error| e.to_string())?
                .collect::<Result<Vec<_>, rusqlite::Error>>()
                .map_err(|e: rusqlite::Error| e.to_string())?;
            items
        },
        None => {
            let mut stmt = conn.prepare("SELECT id, group_id, title, content, shortcut, tags, variables, use_count, is_pinned, created_at FROM templates ORDER BY created_at DESC")
                .map_err(|e: rusqlite::Error| e.to_string())?;
            let items = stmt.query_map([], |row| map_template(row))
                .map_err(|e: rusqlite::Error| e.to_string())?
                .collect::<Result<Vec<_>, rusqlite::Error>>()
                .map_err(|e: rusqlite::Error| e.to_string())?;
            items
        }
    };

    Ok(templates)
}

#[tauri::command]
pub fn create_template(
    db: State<Arc<DbPool>>,
    payload: CreateTemplatePayload,
) -> Result<Template, String> {
    let id = Uuid::new_v4().to_string();
    let gid = payload.group_id.filter(|s| !s.is_empty() && s != "null" && s != "undefined");
    
    let vars = variables::parse_variables(&payload.content);
    let variables_json = variables::variables_to_json(&vars);

    let conn = db.0.lock().unwrap();
    conn.execute(
        "INSERT INTO templates (id, group_id, title, content, variables) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, gid, payload.title, payload.content, variables_json],
    ).map_err(|e| e.to_string())?;

    Ok(Template {
        id,
        group_id: gid,
        title: payload.title,
        content: payload.content,
        shortcut: None,
        tags: "[]".to_string(),
        variables: variables_json,
        use_count: 0,
        is_pinned: false,
        created_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
    })
}

#[tauri::command]
pub fn update_template(
    db: State<Arc<DbPool>>,
    payload: UpdateTemplatePayload,
) -> Result<(), String> {
    let conn = db.0.lock().unwrap();
    let gid = payload.group_id.filter(|s| !s.is_empty() && s != "null" && s != "undefined");

    if let Some(t) = payload.title {
        conn.execute("UPDATE templates SET title = ?1 WHERE id = ?2", params![t, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(c) = payload.content {
        let vars = variables::parse_variables(&c);
        let variables_json = variables::variables_to_json(&vars);
        conn.execute("UPDATE templates SET content = ?1, variables = ?2 WHERE id = ?3", params![c, variables_json, payload.id]).map_err(|e| e.to_string())?;
    }
    
    let affected = conn.execute("UPDATE templates SET group_id = ?1 WHERE id = ?2", params![gid, payload.id]).map_err(|e| e.to_string())?;
    if affected == 0 {
        return Err(format!("No template found with ID: {}", payload.id));
    }

    conn.execute("UPDATE templates SET updated_at = datetime('now','localtime') WHERE id = ?1", params![payload.id]).map_err(|e| e.to_string())?;

    Ok(())
}

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

#[tauri::command]
pub fn delete_template(db: State<Arc<DbPool>>, id: String) -> Result<(), String> {
    let conn = db.0.lock().unwrap();
    conn.execute("DELETE FROM templates WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_template(db: State<Arc<DbPool>>, id: String) -> Result<Option<Template>, String> {
    let conn = db.0.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, group_id, title, content, shortcut, tags, variables, use_count, is_pinned, created_at FROM templates WHERE id = ?1")
        .map_err(|e| e.to_string())?;

    let tpl = stmt.query_row(params![id], |row| map_template(row)).ok();
    Ok(tpl)
}

// ══════════════════════════════════════════
// Smart Templates V2 Commands
// ══════════════════════════════════════════

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

#[derive(serde::Deserialize)]
pub struct SaveVariableValuesPayload {
    pub template_id: String,
    pub values: Vec<VariableValueEntry>,
}

#[derive(serde::Deserialize)]
pub struct VariableValueEntry {
    pub name: String,
    pub value: String,
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
