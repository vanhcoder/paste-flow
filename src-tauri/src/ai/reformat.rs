use std::sync::Arc;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::State;
use crate::db::DbPool;

// ── Style prompts ─────────────────────────────────────────────────────────────

fn style_system_prompt(style: &str) -> &'static str {
    match style {
        "email" => "\
You are an expert business email writer. Transform the input into a polished professional email. \
Follow this structure: a clear subject line (prefix with \"Subject: \"), a courteous greeting, \
a concise body that leads with the main point, any necessary context or action items as short \
paragraphs, and a professional sign-off (\"Best regards,\" or \"Sincerely,\"). \
Preserve all factual details from the input. Trim filler words and passive voice. \
Output only the final email — no commentary, no explanation.",

        "slack" => "\
You are a clear, direct communicator writing for Slack. Transform the input into a Slack message \
that gets straight to the point. Use plain conversational language, active voice, and short \
sentences. Break up complex information using line breaks or minimal bullet points (- item). \
Use bold (*text*) sparingly for the single most important word or phrase. \
Add at most one relevant emoji at the start if it genuinely aids clarity — never force it. \
Do not exceed 3 short paragraphs. Output only the Slack message text — no explanation.",

        "tweet" => "\
You are a social media copywriter. Rewrite the input as a single tweet under 280 characters. \
Lead with the most compelling insight or hook — no fluff, no intro phrases like \"Here's why\" \
or \"Thread:\". Write for maximum shareability: clear, opinionated, and memorable. \
If adding 1–2 hashtags improves reach without feeling spammy, include them. \
Count characters carefully and stay under the limit. Output only the tweet text.",

        "formal" => "\
You are a professional editor specializing in formal written communication. Rewrite the input \
using precise vocabulary, complete sentences, and an objective, authoritative tone appropriate \
for executive memos, academic writing, or official correspondence. Eliminate slang, \
contractions, and colloquialisms. Maintain a logical flow with clear paragraph breaks. \
Do not add content not present in the original — only elevate the language and structure. \
Output only the rewritten text.",

        "casual" => "\
You are a friendly communicator. Rewrite the input in a warm, natural, conversational tone — \
the way a knowledgeable friend would explain it over coffee. Use contractions, simple vocabulary, \
and short punchy sentences. It is okay to start sentences with \"And\" or \"But\". \
Keep all the original information but make it feel light and approachable. \
Output only the rewritten text — no meta-commentary.",

        "bullets" => "\
You are an information architect. Convert the input into a clean, scannable bullet-point list. \
Group related ideas under bold category headers if there are more than 5 points. \
Each bullet must be one concise line: start with an action verb or a key noun, \
cut articles and filler words, preserve all facts. Use \"- \" for bullets and \"  - \" for \
sub-bullets if hierarchy exists. Do not add bullets for information not in the original. \
Output only the bullet list.",

        "summary" => "\
You are a concise summarizer. Distill the input into 3–5 sentences that capture the \
essential who, what, why, and so-what. Lead with the single most important takeaway. \
Eliminate examples, repetition, and background context that does not affect the core message. \
Use plain, direct language. Do not include your own opinions or analysis. \
Output only the summary — no preamble like \"This text is about...\".",

        "fix" => "\
You are a meticulous copy editor. Correct all spelling mistakes, grammatical errors, \
punctuation issues, and inconsistent capitalization in the input. Fix run-on sentences \
and sentence fragments. Standardize quotation marks and apostrophes. \
Do NOT change the author's voice, vocabulary choices, tone, or structure — \
only fix clear errors. If the input is already correct, return it unchanged. \
Output only the corrected text.",

        _ => "Improve and reformat the following text. Output only the result.",
    }
}

// ── OpenAI ───────────────────────────────────────────────────────────────────

#[derive(Serialize)]
struct OAIMsg { role: String, content: String }

#[derive(Serialize)]
struct OAIReq { model: String, messages: Vec<OAIMsg>, max_tokens: u32 }

#[derive(Deserialize)]
struct OAIChoice { message: OAIMsgOut }

#[derive(Deserialize)]
struct OAIMsgOut { content: String }

#[derive(Deserialize)]
struct OAIResp { choices: Vec<OAIChoice> }

async fn call_openai(client: &Client, api_key: &str, model: &str, system: &str, text: &str) -> Result<String, String> {
    let body = OAIReq {
        model: model.into(),
        messages: vec![
            OAIMsg { role: "system".into(), content: system.into() },
            OAIMsg { role: "user".into(),   content: text.into()   },
        ],
        max_tokens: 2048,
    };
    let resp = client
        .post("https://api.openai.com/v1/chat/completions")
        .bearer_auth(api_key)
        .json(&body)
        .send().await
        .map_err(|e| format!("Network error: {e}"))?;

    if !resp.status().is_success() {
        let code = resp.status().as_u16();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("OpenAI {code}: {body}"));
    }
    let data: OAIResp = resp.json().await.map_err(|e| format!("Parse error: {e}"))?;
    data.choices.into_iter().next()
        .map(|c| c.message.content.trim().to_string())
        .ok_or_else(|| "Empty response from OpenAI".into())
}

// ── Anthropic ────────────────────────────────────────────────────────────────

#[derive(Serialize)]
struct AntMsg { role: String, content: String }

#[derive(Serialize)]
struct AntReq { model: String, max_tokens: u32, system: String, messages: Vec<AntMsg> }

#[derive(Deserialize)]
struct AntContent { text: String }

#[derive(Deserialize)]
struct AntResp { content: Vec<AntContent> }

async fn call_anthropic(client: &Client, api_key: &str, model: &str, system: &str, text: &str) -> Result<String, String> {
    let body = AntReq {
        model: model.into(),
        max_tokens: 2048,
        system: system.into(),
        messages: vec![AntMsg { role: "user".into(), content: text.into() }],
    };
    let resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&body)
        .send().await
        .map_err(|e| format!("Network error: {e}"))?;

    if !resp.status().is_success() {
        let code = resp.status().as_u16();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Anthropic {code}: {body}"));
    }
    let data: AntResp = resp.json().await.map_err(|e| format!("Parse error: {e}"))?;
    data.content.into_iter().next()
        .map(|c| c.text.trim().to_string())
        .ok_or_else(|| "Empty response from Anthropic".into())
}

async fn call_ai(client: &Client, provider: &str, api_key: &str, model: &str, system: &str, text: &str) -> Result<String, String> {
    match provider {
        "anthropic" => call_anthropic(client, api_key, model, system, text).await,
        _           => call_openai(client, api_key, model, system, text).await,
    }
}

// ── Reformat text ─────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn reformat_text(
    text: String,
    style: String,
    provider: String,
    api_key: String,
    model: String,
    db: State<'_, Arc<DbPool>>,
) -> Result<String, String> {
    if api_key.trim().is_empty() {
        return Err("API key not configured. Add your key in Preferences → AI Integration.".into());
    }
    let client = Client::new();

    // Check if it's a custom skill id (UUID-shaped)
    let system: String = if style.len() > 10 && style.contains('-') {
        // Look up custom skill prompt from DB
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        let prompt: Result<String, _> = conn.query_row(
            "SELECT prompt FROM ai_skills WHERE id = ?1",
            [&style], |r| r.get(0),
        );
        drop(conn);
        prompt.unwrap_or_else(|_| style_system_prompt("fix").to_string())
    } else {
        style_system_prompt(&style).to_string()
    };

    let result = call_ai(&client, &provider, &api_key, &model, &system, &text).await?;

    // Save to history
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let _ = conn.execute(
        "INSERT INTO reformat_history (id, original_text, style, reformatted, model_used) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![id, text, style, result, model],
    );

    Ok(result)
}

// ── Custom AI skills ──────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize)]
pub struct AiSkill {
    pub id:         String,
    pub name:       String,
    pub emoji:      String,
    pub prompt:     String,
    pub use_count:  i64,
    pub created_at: String,
}

#[tauri::command]
pub fn list_ai_skills(db: State<'_, Arc<DbPool>>) -> Result<Vec<AiSkill>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, emoji, prompt, use_count, created_at FROM ai_skills ORDER BY created_at ASC")
        .map_err(|e| e.to_string())?;
    let items = stmt
        .query_map([], |r| Ok(AiSkill {
            id:         r.get(0)?,
            name:       r.get(1)?,
            emoji:      r.get(2)?,
            prompt:     r.get(3)?,
            use_count:  r.get(4)?,
            created_at: r.get(5)?,
        }))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(items)
}

#[tauri::command]
pub fn create_ai_skill(
    name: String,
    emoji: String,
    prompt: String,
    db: State<'_, Arc<DbPool>>,
) -> Result<AiSkill, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO ai_skills (id, name, emoji, prompt) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![id, name, emoji, prompt],
    ).map_err(|e| e.to_string())?;
    let skill: AiSkill = conn.query_row(
        "SELECT id, name, emoji, prompt, use_count, created_at FROM ai_skills WHERE id = ?1",
        [&id], |r| Ok(AiSkill {
            id:         r.get(0)?,
            name:       r.get(1)?,
            emoji:      r.get(2)?,
            prompt:     r.get(3)?,
            use_count:  r.get(4)?,
            created_at: r.get(5)?,
        }),
    ).map_err(|e| e.to_string())?;
    Ok(skill)
}

#[tauri::command]
pub fn delete_ai_skill(id: String, db: State<'_, Arc<DbPool>>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM ai_skills WHERE id = ?1", [&id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ── Reformat history ──────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct ReformatRecord {
    pub id:            String,
    pub original_text: String,
    pub style:         String,
    pub reformatted:   String,
    pub model_used:    String,
    pub created_at:    String,
}

#[tauri::command]
pub fn get_reformat_history(
    limit: Option<u32>,
    db: State<'_, Arc<DbPool>>,
) -> Result<Vec<ReformatRecord>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let n = limit.unwrap_or(20);
    let mut stmt = conn
        .prepare("SELECT id, original_text, style, reformatted, model_used, created_at FROM reformat_history ORDER BY created_at DESC LIMIT ?1")
        .map_err(|e| e.to_string())?;
    let items = stmt
        .query_map([n], |r| Ok(ReformatRecord {
            id:            r.get(0)?,
            original_text: r.get(1)?,
            style:         r.get(2)?,
            reformatted:   r.get(3)?,
            model_used:    r.get(4)?,
            created_at:    r.get(5)?,
        }))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(items)
}

// ── Generate template from description ───────────────────────────────────────

#[derive(Serialize, Deserialize)]
pub struct GeneratedTemplate {
    pub title:   String,
    pub content: String,
}

#[tauri::command]
pub async fn generate_template(
    description: String,
    provider: String,
    api_key: String,
    model: String,
) -> Result<GeneratedTemplate, String> {
    if api_key.trim().is_empty() {
        return Err("API key not configured. Add your key in Preferences → AI Integration.".into());
    }
    let system = r#"You are a smart template generator for a clipboard manager app.

Given a description, create a reusable text template. Rules:
- Use {{variable_name}} for user-fillable dynamic fields (lowercase, underscores)
- Use {{TODAY}} for today's date, {{NOW}} for date+time, {{CLIPBOARD}} for clipboard content
- Prefer specific variable names like {{client_name}}, {{project}}, {{amount}}
- Make the template practical and copy-paste ready
- Output ONLY raw JSON with exactly two keys: "title" (short, max 60 chars) and "content"
- No markdown, no code blocks, no explanation — just the JSON object"#;

    let client = Client::new();
    let raw = call_ai(&client, &provider, &api_key, &model, system, &description).await?;

    // Strip possible markdown fences
    let cleaned = raw
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    serde_json::from_str::<GeneratedTemplate>(cleaned)
        .map_err(|e| format!("AI returned invalid JSON: {e}\n\nRaw: {cleaned}"))
}
