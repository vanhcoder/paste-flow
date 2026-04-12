import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./styles/globals.css";

import MainWindow from "./windows/MainWindow";
import QuickPaste from "./windows/QuickPaste";
import { QueueIndicator } from "./components/QuickPaste/QueueIndicator";

async function init() {
  const label = getCurrentWindow().label;

  if (label === "quick-paste") {
    ReactDOM.createRoot(document.getElementById("root")!).render(
      <React.StrictMode>
        <QuickPaste />
      </React.StrictMode>,
    );
  } else if (label === "queue-indicator") {
    const root = document.getElementById("root")!;
    root.style.backgroundColor = "transparent";
    document.body.style.backgroundColor = "transparent";
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <QueueIndicator />
      </React.StrictMode>,
    );
  } else {
    ReactDOM.createRoot(document.getElementById("root")!).render(
      <React.StrictMode>
        <MainWindow />
      </React.StrictMode>,
    );
  }
}

init();
