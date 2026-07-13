import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";
import { AppProviders } from "./app/providers";
import "./ui/theme/styles.css";
import { registerServiceWorker } from "./infrastructure/pwa/registerServiceWorker";
import { createDebugSnapshot, exportDebugSnapshotJson } from "./features/debug/debugSnapshot";

if (import.meta.env.DEV) {
  const debugWindow = window as typeof window & {
    __AGURI_DEBUG__?: {
      snapshot: typeof createDebugSnapshot;
      exportJson: typeof exportDebugSnapshotJson;
    };
  };
  debugWindow.__AGURI_DEBUG__ = {
    snapshot: createDebugSnapshot,
    exportJson: exportDebugSnapshotJson
  };
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </React.StrictMode>
);

registerServiceWorker();
