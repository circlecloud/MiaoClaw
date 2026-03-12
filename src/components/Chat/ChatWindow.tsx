import { useState, useRef, useEffect } from "react";
import { useChatStore } from "../../stores/chatStore";
import { MessageBubble } from "./MessageBubble";

export function ChatWindow() {
  const { messages, isLoading, addMessage, setLoading } = useChatStore();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || isLoading) return;

    setInput("");
    addMessage({
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: Date.now(),
    });

    setLoading(true);
    try {
      // TODO: 调用 Tauri command ai_send_message
      // const response = await invoke("ai_send_message", { ... });
      addMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content: "（AI 响应占位 - 请先配置 AI Provider）",
        timestamp: Date.now(),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="px-4 py-3 bg-white border-b border-gray-200 shadow-sm">
        <h1 className="text-lg font-semibold text-gray-800">MiaoClaw</h1>
        <p className="text-xs text-gray-400">你的桌面宠物助理</p>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-20">
            <p className="text-4xl mb-2">🐱</p>
            <p>和我聊聊吧~</p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <span className="animate-pulse">●</span> 思考中...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="px-4 py-3 bg-white border-t border-gray-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="输入消息..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}
