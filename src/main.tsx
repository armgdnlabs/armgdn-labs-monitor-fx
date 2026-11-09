import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./engine/diagnostics";
import { useEditor } from "./state/editor";

// Console access for debugging and scripting: monitor.editor.getState().addLayer("bloom")
(window as unknown as { monitor: unknown }).monitor = { editor: useEditor };

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
