import { useEffect, useState, useRef } from "react";
import { PetRenderer } from "./components/Pet/PetRenderer";
import { ChatWindow } from "./components/Chat/ChatWindow";
import { SettingsPanel } from "./components/Settings/SettingsPanel";
import { AISetupWizard } from "./components/Settings/AISetupWizard";
import { usePetStore } from "./stores/petStore";
import { useSettingsStore } from "./stores/settingsStore";
import { useClickThrough } from "./hooks/useClickThrough";

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
  const petContainerRef = useRef<HTMLDivElement>(null);

  useClickThrough(petContainerRef);

  useEffect(() => {
    const onHashChange = () => setRoute(getRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // 宠物窗口
  if (route === "pet") {
    return (
      <div
        ref={petContainerRef}
        className="w-full h-full"
        data-tauri-drag-region
        style={{
          // @ts-expect-error webkit vendor prefix
          WebkitAppRegion: "drag",
          cursor: "grab",
          backgroundColor: "transparent",
        }}
      >
        <PetRenderer
          style={currentStyle}
          animation={currentAnimation}
          width={256}
          height={256}
        />
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
