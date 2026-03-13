use std::path::PathBuf;
use tauri::Manager;
use tauri::tray::TrayIconBuilder;
use tauri::menu::{MenuBuilder, MenuItemBuilder};

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
        .on_window_event(|window, event| {
            // 点击关闭按钮时隐藏窗口而不是退出
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let label = window.label();
                if label == "pet" || label == "chat" || label == "settings" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .setup(|app| {
            tracing::info!("MiaoClaw 启动中...");

            // ─── 系统托盘 ───
            let show_pet = MenuItemBuilder::with_id("show_pet", "显示宠物").build(app)?;
            let show_chat = MenuItemBuilder::with_id("show_chat", "打开对话").build(app)?;
            let show_settings = MenuItemBuilder::with_id("show_settings", "设置").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "退出").build(app)?;

            let menu = MenuBuilder::new(app)
                .item(&show_pet)
                .item(&show_chat)
                .separator()
                .item(&show_settings)
                .separator()
                .item(&quit)
                .build()?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("MiaoClaw - 你的桌面宠物助理")
                .menu(&menu)
                .on_menu_event(|app, event| {
                    match event.id().as_ref() {
                        "show_pet" => {
                            if let Some(w) = app.get_webview_window("pet") {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                        "show_chat" => {
                            if let Some(w) = app.get_webview_window("chat") {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                        "show_settings" => {
                            if let Some(w) = app.get_webview_window("settings") {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click { button, .. } = event {
                        if button == tauri::tray::MouseButton::Left {
                            let app = tray.app_handle();
                            if let Some(w) = app.get_webview_window("pet") {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            // ─── 配置初始化 ───

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

            if let Some(primary) = &config.models.primary {
                if let Some(provider_id) = primary.split('/').next() {
                    ai_router.set_default(provider_id);
                }
            }

            // 4. 初始化 Channel Manager
            let channel_manager = ChannelManager::new();

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

            // ─── 平台特定：透明窗口 ───

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
                        let key = NSString::alloc(nil).init_str("drawsBackground");
                        let _: () = msg_send![ns_view, setValue: NO forKey: key];
                    }
                }
            }

            // Windows
            #[cfg(target_os = "windows")]
            {
                if let Some(window) = app.get_webview_window("pet") {
                    use tauri::window::Color;
                    let _ = window.set_background_color(Some(Color(0, 0, 0, 0)));
                    let _ = window.set_shadow(false);

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
