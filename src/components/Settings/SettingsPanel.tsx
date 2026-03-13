import { useSettingsStore } from "../../stores/settingsStore";
import { emit } from "@tauri-apps/api/event";
import type { PetStyle } from "../../types";

const PET_STYLES: { value: PetStyle; label: string; icon: string }[] = [
  { value: "css", label: "极简风", icon: "✨" },
  { value: "pixel", label: "像素风", icon: "👾" },
  { value: "lottie", label: "矢量风", icon: "🎨" },
  { value: "live2d", label: "Live2D", icon: "🎭" },
  { value: "bedrock", label: "Minecraft 基岩", icon: "⛏️" },
  { value: "smd", label: "SMD 模型", icon: "🎮" },
];

export function SettingsPanel() {
  const { config, updatePet } = useSettingsStore();

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-6">设置</h1>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">宠物风格</h2>
        <div className="grid grid-cols-3 gap-3">
          {PET_STYLES.map((style) => (
            <button
              key={style.value}
              onClick={() => {
                updatePet({ style: style.value });
                emit("pet-style-changed", { style: style.value });
              }}
              className={`p-3 border rounded-lg text-center transition-colors ${
                config.pet.style === style.value
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-400"
              }`}
            >
              <span className="text-2xl">{style.icon}</span>
              <p className="text-sm mt-1">{style.label}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">通用</h2>
        <div className="space-y-3">
          <label className="flex items-center justify-between">
            <span className="text-sm">窗口置顶</span>
            <input
              type="checkbox"
              checked={config.pet.alwaysOnTop}
              onChange={(e) => updatePet({ alwaysOnTop: e.target.checked })}
              className="rounded"
            />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-sm">开机自启</span>
            <input
              type="checkbox"
              checked={config.pet.autoStart}
              onChange={(e) => updatePet({ autoStart: e.target.checked })}
              className="rounded"
            />
          </label>
          <div>
            <label className="block text-sm mb-1">全局快捷键</label>
            <input
              type="text"
              value={config.pet.globalShortcut}
              onChange={(e) => updatePet({ globalShortcut: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">AI Provider</h2>
        {Object.keys(config.models.providers).length === 0 ? (
          <p className="text-gray-400 text-sm">尚未配置任何 AI Provider</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(config.models.providers).map(([id, p]) => (
              <div
                key={id}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
              >
                <div>
                  <p className="text-sm font-medium">{p.displayName || id}</p>
                  <p className="text-xs text-gray-400">{p.baseUrl}</p>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    p.enabled
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {p.enabled ? "启用" : "禁用"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
