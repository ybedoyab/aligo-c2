import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { C2Provider } from "./store";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <C2Provider>
        <App />
      </C2Provider>
    </BrowserRouter>
  </StrictMode>
);
