use crate::AppState;
use std::sync::Arc;
use tauri::State;

/// Generic backend GET — frontend `invoke('api_get', { path: '/api/v1/...' })`.
/// Token state'ten okunur, kullanıcı login değilse Err döner.
/// Response body raw JSON string olarak döner; frontend kendi parse eder.
#[tauri::command]
pub async fn api_get(
    path: String,
    state: State<'_, Arc<AppState>>,
) -> Result<serde_json::Value, String> {
    let token = state.token.lock().await.clone()
        .ok_or_else(|| "Not logged in".to_string())?;

    let url = format!("{}{}", state.api_base, path);
    let client = reqwest::Client::new();
    let resp = client.get(&url)
        .bearer_auth(&token)
        .send().await.map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("HTTP {} → {}", status, body));
    }
    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}
