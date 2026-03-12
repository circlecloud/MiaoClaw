import type { ChatMessage } from "../../types";

interface Props {
  message: ChatMessage;
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
          isUser
            ? "bg-blue-500 text-white rounded-br-none"
            : "bg-white text-gray-800 border border-gray-200 rounded-bl-none shadow-sm"
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        <p
          className={`text-xs mt-1 ${
            isUser ? "text-blue-100" : "text-gray-400"
          }`}
        >
          {new Date(message.timestamp).toLocaleTimeString("zh-CN", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}
