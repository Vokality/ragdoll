import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { createRendererServices } from "./application/renderer-services";
import "./styles/global.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Failed to find root element");
}

const services = createRendererServices(window.electronAPI);

createRoot(rootElement).render(
  <StrictMode>
    <App services={services} />
  </StrictMode>,
);
