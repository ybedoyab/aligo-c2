import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { I18nProvider } from "./i18n";
import { C2Provider } from "./store";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <I18nProvider>
        <C2Provider>
          <App />
        </C2Provider>
      </I18nProvider>
    </BrowserRouter>
  </StrictMode>
);
