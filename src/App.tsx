import { useEffect, useState } from "react";
import { PetWindow } from "./components/Pet/PetWindow";
import { ChatWindow } from "./components/Chat/ChatWindow";
import { SettingsPanel } from "./components/Settings/SettingsPanel";
import { AISetupWizard } from "./components/Settings/AISetupWizard";
import { useSettingsStore } from "./stores/settingsStore";
import { configAPI } from "./hooks/useAPI";

type Route = "pet" | "chat" | "settings";

function getRoute(): Route {
  const hash = window.location.hash;
  if (hash === "#/chat") return "chat";
  if (hash === "#/settings") return "settings";
  return "pet";
}

export default function App() {
  const [route, setRoute] = useState<Route>(getRoute);
  const { isFirstRun, setFirstRun } = useSettingsStore();
  const [loaded, setLoaded] = useState(route !== "settings");

  // 设置窗口：从后端同步 isFirstRun 状态
  useEffect(() => {
    if (route === "settings") {
      configAPI.isFirstRun().then((val) => {
        setFirstRun(val);
        setLoaded(true);
      }).catch(() => setLoaded(true));
    }
  }, [route, setFirstRun]);

  useEffect(() => {
    const onHashChange = () => setRoute(getRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  if (route === "pet") return <PetWindow />;
  if (route === "chat") return <ChatWindow />;
  if (route === "settings") {
    if (!loaded) return null;
    return isFirstRun ? <AISetupWizard /> : <SettingsPanel />;
  }
  return null;
}
