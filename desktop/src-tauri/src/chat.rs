use crate::AppState;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{Emitter, State};

#[derive(Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Deserialize)]
pub struct ChatSendArgs {
    pub provider: String,
    pub model: String,
    pub session_id: Option<String>,
    pub messages: Vec<ChatMessage>,
}

#[derive(Serialize, Deserialize)]
struct ApiChatPayload {
    provider: String,
    model: String,
    #[serde(rename = "sessionId", skip_serializing_if = "Option::is_none")]
    session_id: Option<String>,
    messages: Vec<SerializedMessage>,
    #[serde(rename = "maxTokens")]
    max_tokens: u32,
}

#[derive(Serialize, Deserialize)]
struct SerializedMessage {
    role: String,
    content: String,
}

#[tauri::command]
pub async fn chat_send(
    args: ChatSendArgs,
    state: State<'_, Arc<AppState>>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let token = state.token.lock().await.clone()
        .ok_or_else(|| "Not logged in".to_string())?;

    let payload = ApiChatPayload {
        provider: args.provider,
        model: args.model,
        session_id: args.session_id,
        messages: args.messages.into_iter().map(|m| SerializedMessage { role: m.role, content: m.content }).collect(),
        max_tokens: 2048,
    };

    let client = reqwest::Client::new();
    let url = format!("{}/api/v1/chat", state.api_base);
    let resp = client.post(&url)
        .bearer_auth(&token)
        .json(&payload)
        .send().await.map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let err = format!("chat upstream error: HTTP {}", resp.status());
        let _ = app.emit("chat:error", serde_json::json!({ "message": err.clone() }));
        return Err(err);
    }

    let mut stream = resp.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk) = stream.next().await {
        let bytes = chunk.map_err(|e| e.to_string())?;
        buffer.push_str(&String::from_utf8_lossy(&bytes));

        while let Some(idx) = buffer.find("\n\n") {
            let event = buffer[..idx].to_string();
            buffer = buffer[idx + 2..].to_string();
            let mut event_name = "delta".to_string();
            let mut data = String::new();
            for line in event.lines() {
                if let Some(rest) = line.strip_prefix("event: ") { event_name = rest.to_string(); }
                else if let Some(rest) = line.strip_prefix("data: ") { data.push_str(rest); }
            }
            if data.is_empty() { continue; }
            let json: serde_json::Value = serde_json::from_str(&data).unwrap_or(serde_json::Value::Null);
            let _ = app.emit(&format!("chat:{}", event_name), json);
            if event_name == "done" { return Ok(()); }
        }
    }

    let _ = app.emit("chat:done", serde_json::json!({}));
    Ok(())
}
