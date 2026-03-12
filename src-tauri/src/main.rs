use miaoclaw_lib::ai::AIRouter;
use miaoclaw_lib::channel::ChannelManager;
use miaoclaw_lib::commands::*;
use miaoclaw_lib::plugin::PluginEngine;

fn main() {
    tracing_subscriber::fmt::init();

    let ai_router = AIRouter::new();
    let channel_manager = ChannelManager::new();
    let plugin_engine = PluginEngine::new(vec![]);

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_sql::Builder::new()
            .add_migrations("sqlite:miaoclaw.db", vec![])
            .build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(ai_router)
        .manage(channel_manager)
        .manage(plugin_engine)
        .invoke_handler(tauri::generate_handler![
            ai_send_message,
            ai_list_providers,
            channel_list,
            channel_send,
            plugin_list,
            plugin_call_tool,
            pet_get_state,
        ])
        .setup(|app| {
            tracing::info!("MiaoClaw 启动中...");

            // macOS: 设置窗口背景透明
            #[cfg(target_os = "macos")]
            {
                use tauri::Manager;
                if let Some(window) = app.get_webview_window("pet") {
                    use objc2_app_kit::{NSColor, NSWindow};
                    use objc2_foundation::MainThreadMarker;
                    let ns_window = window.ns_window().unwrap() as *mut NSWindow;
                    unsafe {
                        let mtm = MainThreadMarker::new().unwrap();
                        let color = NSColor::clearColor();
                        (*ns_window).setBackgroundColor(Some(&color));
                        (*ns_window).setOpaque(false);
                        (*ns_window).setHasShadow(false);
                    }
                }
            }

            #[cfg(not(target_os = "macos"))]
            let _ = app;

            // TODO: 加载配置、初始化 AI Provider、启动 Channel、加载插件
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("MiaoClaw 启动失败");
}
