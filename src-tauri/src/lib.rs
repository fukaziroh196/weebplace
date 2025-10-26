#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  // Allow HLS/video autoplay without user gesture in Windows WebView2
  #[cfg(target_os = "windows")]
  {
    use std::env;
    let extra = "--autoplay-policy=no-user-gesture-required --disable-features=AutoplayIgnoreWebAudio";
    match env::var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS") {
      Ok(prev) => env::set_var(
        "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
        format!("{} {}", prev, extra),
      ),
      Err(_) => env::set_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", extra),
    }
  }

  tauri::Builder::default()
    .plugin(tauri_plugin_http::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
