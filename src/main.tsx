import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";
import { AppProviders } from "./app/providers";
import "./ui/theme/styles.css";
import { registerServiceWorker } from "./infrastructure/pwa/registerServiceWorker";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </React.StrictMode>
);

registerServiceWorker();
