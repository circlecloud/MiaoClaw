import { useState } from "react";
import { useSettingsStore } from "../../stores/settingsStore";
import type { ProviderEntry } from "../../types";

const PROVIDER_PRESETS = [
  {
    id: "ollama",
    name: "Ollama (本地)",
    description: "在本地运行 AI 模型，隐私优先，无需 API Key",
    defaultUrl: "http://localhost:11434",
    needsKey: false,
    guide: "1. 安装 Ollama: https://ollama.ai\n2. 运行: ollama pull llama3.2\n3. 确保 Ollama 服务已启动",
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "使用 OpenAI GPT 系列模型",
    defaultUrl: "https://api.openai.com",
    needsKey: true,
    guide: "1. 访问 https://platform.openai.com/api-keys\n2. 创建 API Key\n3. 推荐模型: gpt-4o-mini",
  },
  {
    id: "anthropic",
    name: "Claude (Anthropic)",
    description: "使用 Anthropic Claude 系列模型",
    defaultUrl: "https://api.anthropic.com",
    needsKey: true,
    guide: "1. 访问 https://console.anthropic.com\n2. 创建 API Key\n3. 推荐模型: claude-sonnet-4-20250514",
  },
  {
    id: "custom",
    name: "自定义 (OpenAI 兼容)",
    description: "LM Studio / vLLM / text-generation-webui 等",
    defaultUrl: "http://localhost:1234",
    needsKey: false,
    guide: "填入你的 OpenAI 兼容 API 地址即可",
  },
];

export function AISetupWizard() {
  const { addProvider, setFirstRun } = useSettingsStore();
  const [step, setStep] = useState(0);
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [formData, setFormData] = useState({ baseUrl: "", apiKey: "", model: "" });

  const handleSelectPreset = (index: number) => {
    setSelectedPreset(index);
    setFormData({ baseUrl: PROVIDER_PRESETS[index].defaultUrl, apiKey: "", model: "" });
    setStep(1);
  };

  const handleSave = () => {
    if (selectedPreset === null) return;
    const preset = PROVIDER_PRESETS[selectedPreset];

    const entry: ProviderEntry = {
      baseUrl: formData.baseUrl,
      apiKey: formData.apiKey || undefined,
      enabled: true,
      displayName: preset.name,
    };

    addProvider(preset.id, entry);
    setFirstRun(false);
  };

  if (step === 0) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <h2 className="text-xl font-bold mb-2">欢迎使用 MiaoClaw 🐱</h2>
        <p className="text-gray-500 text-sm mb-6">
          选择一个 AI 模型提供商开始使用，之后可以随时在设置中修改
        </p>
        <div className="space-y-3">
          {PROVIDER_PRESETS.map((preset, i) => (
            <button
              key={i}
              onClick={() => handleSelectPreset(i)}
              className="w-full text-left p-4 border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors"
            >
              <p className="font-medium">{preset.name}</p>
              <p className="text-sm text-gray-500">{preset.description}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const preset = selectedPreset !== null ? PROVIDER_PRESETS[selectedPreset] : null;

  return (
    <div className="p-6 max-w-lg mx-auto">
      <button onClick={() => setStep(0)} className="text-sm text-gray-500 hover:text-gray-700 mb-4">
        ← 返回选择
      </button>
      <h2 className="text-xl font-bold mb-2">配置 {preset?.name}</h2>
      <pre className="text-xs bg-gray-100 p-3 rounded mb-4 whitespace-pre-wrap text-gray-600">
        {preset?.guide}
      </pre>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">API 地址</label>
          <input
            type="text"
            value={formData.baseUrl}
            onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        {preset?.needsKey && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
            <input
              type="password"
              value={formData.apiKey}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">模型名称（可选）</label>
          <input
            type="text"
            value={formData.model}
            onChange={(e) => setFormData({ ...formData, model: e.target.value })}
            placeholder="留空使用默认模型"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <button
          onClick={handleSave}
          className="w-full py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          保存并开始使用
        </button>
      </div>
    </div>
  );
}
