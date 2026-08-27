import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { LanguageProvider } from "./i18n/LanguageContext.jsx";
import { InstallPromptProvider } from "./context/InstallPromptContext.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <InstallPromptProvider>
            <App />
          </InstallPromptProvider>
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// Necesario para que Android/Chrome trate el sitio como una PWA instalable
// (pantalla completa desde el ícono del home) en vez de un simple acceso
// directo con la barra del navegador visible.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js");
  });
}
