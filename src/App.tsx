import { useEffect, useState } from "react";
import { PetRenderer } from "./components/Pet/PetRenderer";
import { ChatWindow } from "./components/Chat/ChatWindow";
import { SettingsPanel } from "./components/Settings/SettingsPanel";
import { AISetupWizard } from "./components/Settings/AISetupWizard";
import { usePetStore } from "./stores/petStore";
import { useSettingsStore } from "./stores/settingsStore";

type Route = "pet" | "chat" | "settings";

function getRoute(): Route {
  const hash = window.location.hash;
  if (hash === "#/chat") return "chat";
  if (hash === "#/settings") return "settings";
  return "pet";
}

export default function App() {
  const [route, setRoute] = useState<Route>(getRoute);
  const { currentStyle, currentAnimation } = usePetStore();
  const { isFirstRun } = useSettingsStore();

  useEffect(() => {
    const onHashChange = () => setRoute(getRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // 宠物窗口
  if (route === "pet") {
    return (
      <div
        className="w-full h-full cursor-grab active:cursor-grabbing"
        data-tauri-drag-region
      >
        <div className="pointer-events-none">
          <PetRenderer
            style={currentStyle}
            animation={currentAnimation}
            width={256}
            height={256}
          />
        </div>
      </div>
    );
  }

  // 对话窗口
  if (route === "chat") {
    return <ChatWindow />;
  }

  // 设置窗口
  if (route === "settings") {
    return isFirstRun ? <AISetupWizard /> : <SettingsPanel />;
  }

  return null;
}
