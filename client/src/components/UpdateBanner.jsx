import React, { useEffect, useRef, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext.jsx";

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

export default function UpdateBanner() {
  const { t } = useLanguage();
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const knownVersion = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}api/version`);
        const data = await res.json();
        if (cancelled) return;
        if (knownVersion.current === null) {
          knownVersion.current = data.version;
        } else if (data.version !== knownVersion.current) {
          setUpdateAvailable(true);
        }
      } catch {
        // sin conexión momentánea: no hacemos nada, se reintenta solo
      }
    };

    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 bg-neon-purple/15 border-t border-neon-purple/60 backdrop-blur px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
      <span className="text-sm text-slate-200">{t("update.available")}</span>
      <button className="btn-primary !px-3 !py-1.5" onClick={() => window.location.reload()}>
        {t("update.reload")}
      </button>
    </div>
  );
}
