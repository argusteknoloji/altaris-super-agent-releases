use crate::AppState;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;

const KEYRING_SERVICE: &str = "com.argusteknoloji.altaris.desktop";
const KEYRING_USER: &str = "default";

#[derive(Serialize)]
pub struct DeviceFlow {
    pub user_code: String,
    pub verification_uri: String,
    pub verification_uri_complete: Option<String>,
    pub expires_in: u64,
    pub interval: u64,
}

#[derive(Deserialize)]
struct DeviceCodeResp {
    device_code: String,
    user_code: String,
    verification_uri: String,
    verification_uri_complete: Option<String>,
    expires_in: u64,
    interval: u64,
}

#[derive(Deserialize)]
struct TokenResp {
    access_token: String,
    expires_in: u64,
    #[serde(default)]
    refresh_token: Option<String>,
}

#[derive(Serialize)]
pub struct Identity {
    pub email: Option<String>,
    pub tenant_slug: Option<String>,
    pub expires_at: Option<u64>,
}

fn keyring_entry() -> anyhow::Result<keyring::Entry> {
    Ok(keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER)?)
}

#[tauri::command]
pub async fn whoami(state: State<'_, Arc<AppState>>) -> Result<Option<Identity>, String> {
    let token = match keyring_entry().and_then(|e| Ok(e.get_password()?)) {
        Ok(t) => t,
        Err(_) => return Ok(None),
    };
    *state.token.lock().await = Some(token.clone());

    // Decode JWT payload (no signature verify — informational)
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() < 2 { return Ok(None); }
    let pad = (4 - parts[1].len() % 4) % 4;
    let mut padded = parts[1].to_string();
    padded.push_str(&"=".repeat(pad));
    use base64::{engine::general_purpose::URL_SAFE, Engine};
    let payload_bytes = URL_SAFE.decode(padded.replace('-', "+").replace('_', "/")).map_err(|e| e.to_string())?;
    let payload: serde_json::Value = serde_json::from_slice(&payload_bytes).map_err(|e| e.to_string())?;

    Ok(Some(Identity {
        email: payload.get("email").and_then(|v| v.as_str()).map(String::from),
        tenant_slug: payload.get("tid").and_then(|v| v.as_str()).map(String::from),
        expires_at: payload.get("exp").and_then(|v| v.as_u64()),
    }))
}

#[tauri::command]
pub async fn login_start(state: State<'_, Arc<AppState>>) -> Result<DeviceFlow, String> {
    let url = format!("{}/protocol/openid-connect/auth/device", state.keycloak_issuer);
    let client = reqwest::Client::new();
    let resp = client.post(&url)
        .form(&[("client_id", state.cli_client_id.as_str()), ("scope", "openid email profile tenant")])
        .send().await.map_err(|e| e.to_string())?;
    let dc: DeviceCodeResp = resp.json().await.map_err(|e| e.to_string())?;
    *state.device_code.lock().await = Some(dc.device_code.clone());

    Ok(DeviceFlow {
        user_code: dc.user_code,
        verification_uri: dc.verification_uri,
        verification_uri_complete: dc.verification_uri_complete,
        expires_in: dc.expires_in,
        interval: dc.interval,
    })
}

#[tauri::command]
pub async fn login_finish(state: State<'_, Arc<AppState>>) -> Result<(), String> {
    let device_code = state.device_code.lock().await.clone()
        .ok_or_else(|| "login_start önce çağrılmalı".to_string())?;

    let url = format!("{}/protocol/openid-connect/token", state.keycloak_issuer);
    let client = reqwest::Client::new();
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(600);

    while std::time::Instant::now() < deadline {
        let resp = client.post(&url)
            .form(&[
                ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
                ("device_code", &device_code),
                ("client_id", &state.cli_client_id),
            ])
            .send().await.map_err(|e| e.to_string())?;

        if resp.status().is_success() {
            let token: TokenResp = resp.json().await.map_err(|e| e.to_string())?;
            keyring_entry().map_err(|e| e.to_string())?
                .set_password(&token.access_token).map_err(|e| e.to_string())?;
            *state.token.lock().await = Some(token.access_token);
            return Ok(());
        }

        let err: serde_json::Value = resp.json().await.unwrap_or_default();
        match err.get("error").and_then(|v| v.as_str()) {
            Some("authorization_pending") | Some("slow_down") => {
                tokio::time::sleep(std::time::Duration::from_secs(5)).await;
            }
            Some(other) => return Err(format!("auth error: {}", other)),
            None => return Err("unknown auth error".into()),
        }
    }

    Err("device flow expired".into())
}

#[tauri::command]
pub async fn logout(state: State<'_, Arc<AppState>>) -> Result<(), String> {
    let _ = keyring_entry().map(|e| e.delete_credential());
    *state.token.lock().await = None;
    *state.device_code.lock().await = None;
    Ok(())
}
