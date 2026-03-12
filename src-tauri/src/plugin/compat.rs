/// OpenClaw 兼容层
/// 将 OpenClaw 插件格式转换为 MiaoClaw 内部格式
///
/// OpenClaw 插件特征:
/// - manifest: openclaw.plugin.json
/// - 入口: TypeScript 模块，通过 jiti 加载
/// - API: registerTool / registerHook / registerService / registerRPC
/// - 配置: configSchema (JSON Schema)
///
/// MiaoClaw 在此基础上扩展:
/// - manifest: miaoclaw.plugin.json (同时识别 openclaw.plugin.json)
/// - 额外 API: registerPetReaction (宠物交互)
/// - 额外字段: miaoclaw.pet_reactions / miaoclaw.channel_support

use super::manifest::{PluginManifest, MiaoClawExtension};

/// 将 OpenClaw manifest 转换为 MiaoClaw 格式
/// OpenClaw 的 manifest 是 MiaoClaw 的子集，直接兼容
pub fn normalize_manifest(mut manifest: PluginManifest, is_openclaw: bool) -> PluginManifest {
    if is_openclaw && manifest.miaoclaw.is_none() {
        // OpenClaw 插件没有 miaoclaw 扩展字段，填充默认值
        manifest.miaoclaw = Some(MiaoClawExtension::default());
    }
    manifest
}

/// 检查 OpenClaw 插件是否与当前 MiaoClaw 版本兼容
pub fn check_compatibility(manifest: &PluginManifest) -> CompatResult {
    // 基础检查：必须有 name、version、entry
    if manifest.name.is_empty() {
        return CompatResult::Incompatible("缺少 name 字段".into());
    }
    if manifest.version.is_empty() {
        return CompatResult::Incompatible("缺少 version 字段".into());
    }
    if manifest.entry.is_empty() {
        return CompatResult::Incompatible("缺少 entry 字段".into());
    }

    // 检查权限是否都被支持
    let supported_permissions = [
        "fs.read",
        "fs.write",
        "net.fetch",
        "exec.run",
        "system.info",
    ];

    for perm in &manifest.permissions {
        if !supported_permissions.contains(&perm.as_str()) {
            return CompatResult::Partial(format!("权限 '{}' 暂不支持", perm));
        }
    }

    CompatResult::Full
}

#[derive(Debug)]
pub enum CompatResult {
    /// 完全兼容
    Full,
    /// 部分兼容（某些功能可能不可用）
    Partial(String),
    /// 不兼容
    Incompatible(String),
}
