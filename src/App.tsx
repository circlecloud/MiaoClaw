import { useEffect, useState } from "react";
import { PetWindow } from "./components/Pet/PetWindow";
import { ChatWindow } from "./components/Chat/ChatWindow";
import { SettingsPanel } from "./components/Settings/SettingsPanel";
import { AISetupWizard } from "./components/Settings/AISetupWizard";
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
  const { isFirstRun } = useSettingsStore();

  useEffect(() => {
    const onHashChange = () => setRoute(getRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  if (route === "pet") return <PetWindow />;
  if (route === "chat") return <ChatWindow />;
  if (route === "settings") return isFirstRun ? <AISetupWizard /> : <SettingsPanel />;
  return null;
}
