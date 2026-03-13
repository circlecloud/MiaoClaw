use std::path::PathBuf;
use tauri::Manager;

use miaoclaw_lib::ai::AIRouter;
use miaoclaw_lib::ai::ollama::OllamaProvider;
use miaoclaw_lib::ai::openai_compat::OpenAICompatProvider;
use miaoclaw_lib::channel::ChannelManager;
use miaoclaw_lib::commands::*;
use miaoclaw_lib::config::ConfigManager;
use miaoclaw_lib::plugin::PluginEngine;

fn main() {
    tracing_subscriber::fmt::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_sql::Builder::new()
                .add_migrations("sqlite:miaoclaw.db", vec![])
                .build(),
        )
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            config_get,
            config_update,
            config_patch,
            config_is_first_run,
            config_validate_provider,
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

            // 1. 确定数据目录
            let data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| PathBuf::from(".miaoclaw"));

            // 2. 初始化配置管理器
            let config_manager = ConfigManager::new(&data_dir);
            let config = config_manager
                .load()
                .unwrap_or_else(|e| {
                    tracing::warn!("配置加载失败，使用默认配置: {}", e);
                    Default::default()
                });

            tracing::info!(
                "配置加载完成: {} 个 Provider, channels: telegram={}, discord={}, slack={}",
                config.models.providers.len(),
                config.channels.telegram.is_some(),
                config.channels.discord.is_some(),
                config.channels.slack.is_some(),
            );

            // 3. 初始化 AI Router
            let ai_router = AIRouter::new();
            for (id, entry) in &config.models.providers {
                if !entry.enabled {
                    continue;
                }
                let provider: Box<dyn miaoclaw_lib::ai::AIProvider> = if id == "ollama" {
                    Box::new(OllamaProvider::new(&entry.base_url))
                } else {
                    Box::new(OpenAICompatProvider::new(
                        &entry.base_url,
                        entry.api_key.as_deref().unwrap_or(""),
                        entry.display_name.as_deref().unwrap_or(id),
                    ))
                };
                tracing::info!("注册 AI Provider: {}", id);
                ai_router.register(provider);
            }

            // 设置默认 provider
            if let Some(primary) = &config.models.primary {
                if let Some(provider_id) = primary.split('/').next() {
                    ai_router.set_default(provider_id);
                }
            }

            // 4. 初始化 Channel Manager
            let channel_manager = ChannelManager::new();
            // TODO: 根据 config.channels 注册各 channel adapter

            // 5. 初始化插件引擎
            let mut plugin_dirs: Vec<PathBuf> = vec![data_dir.join("plugins")];
            for dir in &config.plugins.dirs {
                plugin_dirs.push(PathBuf::from(dir));
            }
            let plugin_engine = PluginEngine::new(plugin_dirs);

            // 6. 注册到 Tauri state
            app.manage(config_manager);
            app.manage(ai_router);
            app.manage(channel_manager);
            app.manage(plugin_engine);

            // 7. 平台特定：设置窗口 + WebView 背景透明

            // macOS
            #[cfg(target_os = "macos")]
            {
                if let Some(window) = app.get_webview_window("pet") {
                    use cocoa::appkit::{NSColor, NSWindow};
                    use cocoa::base::{id, nil, NO};
                    use cocoa::foundation::NSString;
                    use objc::{msg_send, sel, sel_impl};

                    let ns_window = window.ns_window().unwrap() as id;

                    unsafe {
                        let clear = NSColor::clearColor(nil);
                        ns_window.setBackgroundColor_(clear);
                        ns_window.setOpaque_(NO);
                        ns_window.setHasShadow_(NO);

                        let ns_view = window.ns_view().unwrap() as id;
                        let key = NSString::alloc(nil)
                            .init_str("drawsBackground");
                        let _: () = msg_send![ns_view, setValue: NO forKey: key];
                    }
                }
            }

            // Windows: 去掉残留边框 + 触发 resize 刷新透明
            #[cfg(target_os = "windows")]
            {
                if let Some(window) = app.get_webview_window("pet") {
                    use tauri::window::Color;
                    let _ = window.set_background_color(Some(Color(0, 0, 0, 0)));
                    let _ = window.set_shadow(false);

                    // 触发 resize 刷新，解决 Windows 透明窗口初始白背景问题
                    let size = window.outer_size().unwrap();
                    let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
                        width: size.width + 1,
                        height: size.height + 1,
                    }));
                    let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
                        width: size.width,
                        height: size.height,
                    }));
                }
            }

            tracing::info!("MiaoClaw 启动完成");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("MiaoClaw 启动失败");
}
