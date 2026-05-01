use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::Deserialize;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex as StdMutex};
use tauri::{Emitter, State};

#[derive(Default)]
pub struct TerminalState {
    pub writer: Arc<StdMutex<Option<Box<dyn Write + Send>>>>,
    pub master: Arc<StdMutex<Option<Box<dyn portable_pty::MasterPty + Send>>>>,
}

#[derive(Deserialize)]
pub struct TerminalWriteArgs { pub data: String }

#[tauri::command]
pub async fn terminal_open(
    state: State<'_, Arc<crate::AppState>>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let pty_system = native_pty_system();
    let pair = pty_system.openpty(PtySize { rows: 24, cols: 80, pixel_width: 0, pixel_height: 0 })
        .map_err(|e| e.to_string())?;

    let shell = if cfg!(windows) { "cmd.exe" } else { "/bin/bash" };
    let mut cmd = CommandBuilder::new(shell);
    if !cfg!(windows) { cmd.arg("--login"); }
    cmd.env("TERM", "xterm-256color");
    cmd.env("ALTARIS_DESKTOP", "1");
    if let Some(home) = dirs_home() { cmd.cwd(home); }

    let mut child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    drop(pair.slave);

    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    *state.terminal.writer.lock().unwrap() = Some(writer);

    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    *state.terminal.master.lock().unwrap() = Some(pair.master);

    let app_clone = app.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let text = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_clone.emit("term:out", serde_json::json!({ "data": text }));
                }
                Err(_) => break,
            }
        }
        let _ = child.wait();
        let _ = app_clone.emit("term:exit", serde_json::json!({}));
    });

    Ok(())
}

#[tauri::command]
pub async fn terminal_write(
    args: TerminalWriteArgs,
    state: State<'_, Arc<crate::AppState>>,
) -> Result<(), String> {
    if let Some(w) = state.terminal.writer.lock().unwrap().as_mut() {
        w.write_all(args.data.as_bytes()).map_err(|e| e.to_string())?;
        w.flush().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn terminal_close(state: State<'_, Arc<crate::AppState>>) -> Result<(), String> {
    *state.terminal.writer.lock().unwrap() = None;
    *state.terminal.master.lock().unwrap() = None;
    Ok(())
}

fn dirs_home() -> Option<String> {
    std::env::var("HOME").ok().or_else(|| std::env::var("USERPROFILE").ok())
}
