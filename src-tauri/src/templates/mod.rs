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
    println!(">>> LIST_TEMPLATES: payload.gid={:?}", payload.group_id);
    let conn = db.0.lock().unwrap();
    let gid_val = payload.group_id.filter(|s| !s.is_empty() && s != "null" && s != "undefined");

    let templates = match gid_val {
        Some(ref gid) => {
            println!("Filtering SQL by group_id: {}", gid);
            let mut stmt = conn.prepare("SELECT id, group_id, title, content, shortcut, tags, variables, use_count, created_at FROM templates WHERE group_id = ?1 ORDER BY created_at DESC")
                .map_err(|e: rusqlite::Error| e.to_string())?;
            let items = stmt.query_map(params![gid], |row| map_template(row))
                .map_err(|e: rusqlite::Error| e.to_string())?
                .collect::<Result<Vec<_>, rusqlite::Error>>()
                .map_err(|e: rusqlite::Error| e.to_string())?;
            items
        },
        None => {
            println!("Listing ALL templates (no filter)");
            let mut stmt = conn.prepare("SELECT id, group_id, title, content, shortcut, tags, variables, use_count, created_at FROM templates ORDER BY created_at DESC")
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
    println!(">>> CREATE_TEMPLATE: title={}, gid={:?}", payload.title, payload.group_id);
    let id = Uuid::new_v4().to_string();
    let gid = payload.group_id.filter(|s| !s.is_empty() && s != "null" && s != "undefined");
    
    let re = regex::Regex::new(r"\{\{([^}]+)\}\}").unwrap();
    let vars: Vec<String> = re.captures_iter(&payload.content).map(|cap| cap[1].to_string()).collect();
    let variables_json = serde_json::to_string(&vars).unwrap_or("[]".to_string());

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
        created_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
    })
}

#[tauri::command]
pub fn update_template(
    db: State<Arc<DbPool>>,
    payload: UpdateTemplatePayload,
) -> Result<(), String> {
    println!(">>> UPDATE_TEMPLATE: id={}, new_gid={:?}", payload.id, payload.group_id);
    let conn = db.0.lock().unwrap();
    let gid = payload.group_id.filter(|s| !s.is_empty() && s != "null" && s != "undefined");

    if let Some(t) = payload.title {
        conn.execute("UPDATE templates SET title = ?1 WHERE id = ?2", params![t, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(c) = payload.content {
        let re = regex::Regex::new(r"\{\{([^}]+)\}\}").unwrap();
        let vars: Vec<String> = re.captures_iter(&c).map(|cap| cap[1].to_string()).collect();
        let variables_json = serde_json::to_string(&vars).unwrap_or("[]".to_string());
        conn.execute("UPDATE templates SET content = ?1, variables = ?2 WHERE id = ?3", params![c, variables_json, payload.id]).map_err(|e| e.to_string())?;
    }
    
    let affected = conn.execute("UPDATE templates SET group_id = ?1 WHERE id = ?2", params![gid, payload.id]).map_err(|e| e.to_string())?;
    println!("Update affected {} rows. Final GID: {:?}", affected, gid);
    
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
        created_at: row.get(8)?,
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
        .prepare("SELECT id, group_id, title, content, shortcut, tags, variables, use_count, created_at FROM templates WHERE id = ?1")
        .map_err(|e| e.to_string())?;

    let tpl = stmt.query_row(params![id], |row| map_template(row)).ok();
    Ok(tpl)
}
