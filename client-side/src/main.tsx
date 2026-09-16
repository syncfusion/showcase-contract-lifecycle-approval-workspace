import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles/syncfusion-theme.css";
import "./styles/global.css";
import "./styles/pages.css";
import { registerLicense } from "@syncfusion/ej2-base";

const key = import.meta.env.VITE_SYNCFUSION_LICENSE_KEY;
if (key) {
  registerLicense(key);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
