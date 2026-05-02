mod api;
mod auth;
mod chat;
mod terminal;

use std::sync::Arc;
use tokio::sync::Mutex;

pub struct AppState {
    pub api_base: String,
    pub keycloak_issuer: String,
    pub cli_client_id: String,
    pub token: Mutex<Option<String>>,
    pub device_code: Mutex<Option<String>>,
    pub pkce_verifier: Mutex<Option<String>>,
    pub terminal: terminal::TerminalState,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let api_base = std::env::var("ALTARIS_API_BASE").unwrap_or_else(|_| "http://localhost:5000".into());
    let keycloak = std::env::var("ALTARIS_KEYCLOAK_ISSUER").unwrap_or_else(|_| "http://localhost:8081/realms/altaris".into());
    let client_id = std::env::var("ALTARIS_CLI_CLIENT_ID").unwrap_or_else(|_| "altaris-cli".into());

    let state = Arc::new(AppState {
        api_base,
        keycloak_issuer: keycloak,
        cli_client_id: client_id,
        token: Mutex::new(None),
        device_code: Mutex::new(None),
        pkce_verifier: Mutex::new(None),
        terminal: terminal::TerminalState::default(),
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        // Auto-updater: tauri.conf.json'daki endpoint'ten latest.json çeker
        // ve UI'a "Yeni sürüm var" dialog'u gösterir.
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            auth::whoami,
            auth::login_start,
            auth::login_finish,
            auth::logout,
            chat::chat_send,
            api::api_get,
            terminal::terminal_open,
            terminal::terminal_write,
            terminal::terminal_close,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Altaris desktop");
}
