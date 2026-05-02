use crate::AppState;
use std::sync::Arc;
use tauri::State;

// Generic backend HTTP wrapper'ları — frontend Tauri command olarak çağırır,
// Token state'ten okunur, response body JSON olarak döner. Hata 4xx/5xx ise
// Err(string) → frontend toast'a dönüştürür (App.tsx).

async fn authed_call(
    method: reqwest::Method,
    path: String,
    body: Option<serde_json::Value>,
    state: State<'_, Arc<AppState>>,
) -> Result<serde_json::Value, String> {
    let token = state.token.lock().await.clone()
        .ok_or_else(|| "Not logged in".to_string())?;
    let url = format!("{}{}", state.api_base, path);
    let client = reqwest::Client::new();
    let mut req = client.request(method, &url).bearer_auth(&token);
    if let Some(b) = body { req = req.json(&b); }
    let resp = req.send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("HTTP {} → {}", status, text));
    }
    if resp.status() == reqwest::StatusCode::NO_CONTENT {
        return Ok(serde_json::Value::Null);
    }
    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
    if bytes.is_empty() { return Ok(serde_json::Value::Null); }
    serde_json::from_slice(&bytes).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn api_get(path: String, state: State<'_, Arc<AppState>>) -> Result<serde_json::Value, String> {
    authed_call(reqwest::Method::GET, path, None, state).await
}
#[tauri::command]
pub async fn api_post(path: String, body: Option<serde_json::Value>, state: State<'_, Arc<AppState>>) -> Result<serde_json::Value, String> {
    authed_call(reqwest::Method::POST, path, body, state).await
}
#[tauri::command]
pub async fn api_put(path: String, body: Option<serde_json::Value>, state: State<'_, Arc<AppState>>) -> Result<serde_json::Value, String> {
    authed_call(reqwest::Method::PUT, path, body, state).await
}
#[tauri::command]
pub async fn api_patch(path: String, body: Option<serde_json::Value>, state: State<'_, Arc<AppState>>) -> Result<serde_json::Value, String> {
    authed_call(reqwest::Method::PATCH, path, body, state).await
}
#[tauri::command]
pub async fn api_delete(path: String, state: State<'_, Arc<AppState>>) -> Result<serde_json::Value, String> {
    authed_call(reqwest::Method::DELETE, path, None, state).await
}
