import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { LanguageProvider } from "./i18n/LanguageContext.jsx";
import { InstallPromptProvider } from "./context/InstallPromptContext.jsx";
import { ConfirmProvider } from "./context/ConfirmContext.jsx";
import "./index.css";

// import.meta.env.BASE_URL refleja el "base" de vite.config.js (ver
// BASE_PATH) -- así las rutas del cliente cuelgan del mismo subpath que la
// API y los estáticos cuando la app no vive en la raíz del dominio.
const basename = import.meta.env.BASE_URL.replace(/\/+$/, "") || "/";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <LanguageProvider>
        <ConfirmProvider>
          <AuthProvider>
            <InstallPromptProvider>
              <App />
            </InstallPromptProvider>
          </AuthProvider>
        </ConfirmProvider>
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// Necesario para que Android/Chrome trate el sitio como una PWA instalable
// (pantalla completa desde el ícono del home) en vez de un simple acceso
// directo con la barra del navegador visible.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
  });
}
