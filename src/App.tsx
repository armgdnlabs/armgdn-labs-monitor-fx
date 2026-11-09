import { useEffect } from "react";
import { TopBar } from "./components/TopBar";
import { StatusBar } from "./components/Timeline";
import { ModalHost, Toasts } from "./components/modals/Modals";
import { EditorPage } from "./pages/EditorPage";
import { usePrefs } from "./state/ui";

export default function App() {
  const theme = usePrefs((s) => s.theme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    // Screen palette follows the theme: dark = mono, light = analog.
    document.documentElement.dataset.screen = theme === "dark" ? "mono" : "analog";
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#0A0A0A" : "#F7F2EC");
  }, [theme]);
  return (
    <div className="h-full flex flex-col">
      <TopBar />
      <EditorPage />
      <StatusBar />
      <ModalHost />
      <Toasts />
    </div>
  );
}
