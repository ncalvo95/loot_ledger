import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { useConfirm } from "../context/ConfirmContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { Loading } from "../components/ProtectedRoute.jsx";

const CURRENCY_SYMBOL = { EUR: "€", USD: "$", ARS: "AR$" };

export default function QuestsPage() {
  const { user } = useAuth();
  const { t, tError } = useLanguage();
  const confirmAction = useConfirm();
  const showError = useToast();
  const [quests, setQuests] = useState(null);
  const [settlingKey, setSettlingKey] = useState(null);

  const load = async () => {
    const data = await api.get("/quests");
    setQuests(data.quests);
  };

  useEffect(() => {
    load().catch((err) => showError(tError(err)));
  }, []);

  const settle = async (projectId, counterpartId, currency, direction) => {
    if (!(await confirmAction(t("quests.settleConfirm"), { danger: false, confirmLabel: t("quests.questComplete") }))) return;
    const key = `${projectId}-${counterpartId}-${currency}`;
    setSettlingKey(key);
    const fromUserId = direction === "youOwe" ? user.id : counterpartId;
    const toUserId = direction === "youOwe" ? counterpartId : user.id;
    try {
      await api.post("/quests/settle", { projectId, fromUserId, toUserId, currency });
      await load();
    } catch (err) {
      showError(tError(err));
    } finally {
      setSettlingKey(null);
    }
  };

  if (!quests) return <Loading />;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      <div>
        <h1 className="title-glow text-3xl">{t("quests.title")}</h1>
        <p className="text-slate-400 mt-1">{t("quests.subtitle")}</p>
      </div>

      {quests.length === 0 ? (
        <p className="text-slate-500 text-sm py-8 text-center">{t("quests.empty")}</p>
      ) : (
        <div className="space-y-6">
          {quests.map((cp) => (
            <div key={cp.counterpartId} className="panel p-5 space-y-4">
              <h2 className="font-display font-bold text-lg text-slate-100">{cp.username}</h2>

              {cp.currencies.map((c) => {
                const positive = c.netCents > 0;
                const zero = c.netCents === 0;
                const symbol = CURRENCY_SYMBOL[c.currency] || c.currency;
                return (
                  <div key={c.currency} className="space-y-2">
                    <div
                      className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                        zero ? "bg-ink-800/60" : positive ? "bg-neon-green/10" : "bg-neon-red/10"
                      }`}
                    >
                      <span className="font-display uppercase tracking-widest text-xs text-slate-400">
                        {symbol} {c.currency} — {zero ? t("quests.even") : positive ? t("quests.owesYouPrefix") : t("quests.youOwePrefix")}
                      </span>
                      <span
                        className={`font-mono font-bold ${
                          zero ? "text-slate-400" : positive ? "text-neon-green" : "text-neon-red"
                        }`}
                      >
                        {zero ? t("loot.evenSteven") : `${positive ? "+" : ""}${c.net.toFixed(2)}`}
                      </span>
                    </div>

                    <ul className="space-y-1.5 pl-1">
                      {c.lines.map((line, idx) => {
                        const lineOwesYou = line.direction === "owesYou";
                        const key = `${line.projectId}-${cp.counterpartId}-${c.currency}`;
                        const busy = settlingKey === key;
                        return (
                          <li
                            key={idx}
                            className="flex items-center justify-between text-sm bg-ink-800/40 rounded-lg px-3 py-2 gap-2 flex-wrap"
                          >
                            <span className="text-slate-300">
                              {line.projectName}:{" "}
                              <span className={lineOwesYou ? "text-neon-green" : "text-neon-red"}>
                                {lineOwesYou ? t("quests.owesYouPrefix") : t("quests.youOwePrefix")} {symbol}
                                {line.amount.toFixed(2)}
                              </span>
                            </span>
                            {line.canSettle ? (
                              <button
                                className="btn-primary !px-2 !py-1 text-[10px]"
                                disabled={busy}
                                onClick={() => settle(line.projectId, cp.counterpartId, c.currency, line.direction)}
                              >
                                {busy ? t("quests.settling") : t("quests.questComplete")}
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-500 italic">{t("quests.cantSettle")}</span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
