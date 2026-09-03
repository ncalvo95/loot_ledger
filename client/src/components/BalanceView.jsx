import React, { useState } from "react";
import { api } from "../api.js";
import { useLanguage } from "../i18n/LanguageContext.jsx";

const CURRENCY_SYMBOL = { EUR: "€", USD: "$", ARS: "AR$" };

export default function BalanceView({ balances, projectId, currentUserId, canManage, onSettled }) {
  const { t, tError } = useLanguage();
  const [settlingKey, setSettlingKey] = useState(null);
  const [error, setError] = useState("");

  const settle = async (tx, currency) => {
    if (!confirm(t("quests.settleConfirm"))) return;
    const key = `${tx.from}-${tx.to}-${currency}`;
    setSettlingKey(key);
    setError("");
    try {
      await api.post("/quests/settle", {
        projectId,
        fromUserId: tx.from,
        toUserId: tx.to,
        currency,
      });
      onSettled && (await onSettled());
    } catch (err) {
      setError(tError(err));
    } finally {
      setSettlingKey(null);
    }
  };

  if (balances.length === 0) {
    return <p className="text-slate-500 text-sm py-8 text-center">{t("loot.empty")}</p>;
  }

  return (
    <div className="space-y-8">
      {error && <p className="text-neon-red text-sm">{error}</p>}
      {balances.map((group) => (
        <div key={group.currency} className="space-y-4">
          <h3 className="font-display uppercase tracking-widest text-neon-gold text-sm">
            {CURRENCY_SYMBOL[group.currency] || group.currency} {group.currency}
          </h3>

          <div className="grid sm:grid-cols-2 gap-3">
            {group.balances.map((b) => {
              const positive = b.netCents > 0;
              const zero = b.netCents === 0;
              return (
                <div
                  key={b.userId}
                  className={`panel p-4 flex items-center justify-between ${
                    zero ? "" : positive ? "border-neon-green/40" : "border-neon-red/40"
                  }`}
                >
                  <span className="text-slate-200">{b.username}</span>
                  <span
                    className={`font-mono font-bold ${
                      zero ? "text-slate-400" : positive ? "text-neon-green" : "text-neon-red"
                    }`}
                  >
                    {zero ? t("loot.evenSteven") : `${positive ? "+" : ""}${b.net.toFixed(2)}`}
                  </span>
                </div>
              );
            })}
          </div>

          {group.transactions.length > 0 && (
            <div className="panel p-4">
              <p className="text-xs font-display uppercase tracking-widest text-slate-400 mb-3">
                {t("loot.whoOwesWhom")}
              </p>
              <ul className="space-y-2">
                {group.transactions.map((tx, idx) => {
                  const statusOf = (userId) => {
                    const b = group.balances.find((x) => x.userId === userId);
                    return b ? b.accountStatus : "removed";
                  };
                  const canSettle =
                    statusOf(tx.from) === "member" &&
                    statusOf(tx.to) === "member" &&
                    (canManage || tx.from === currentUserId || tx.to === currentUserId);
                  const key = `${tx.from}-${tx.to}-${group.currency}`;
                  const busy = settlingKey === key;
                  return (
                    <li
                      key={idx}
                      className="flex items-center justify-between text-sm bg-ink-800/60 rounded-lg px-3 py-2 gap-2 flex-wrap"
                    >
                      <span>
                        <span className="text-neon-red">{tx.fromUsername}</span>
                        <span className="text-slate-500"> {t("loot.owes")} </span>
                        <span className="text-neon-green">{tx.toUsername}</span>
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-neon-gold">{tx.amount.toFixed(2)}</span>
                        {canSettle && (
                          <button
                            className="btn-primary !px-2 !py-1 text-[10px]"
                            disabled={busy}
                            onClick={() => settle(tx, group.currency)}
                          >
                            {busy ? t("quests.settling") : t("quests.questComplete")}
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
