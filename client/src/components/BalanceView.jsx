import React from "react";
import { useLanguage } from "../i18n/LanguageContext.jsx";

const CURRENCY_SYMBOL = { EUR: "€", USD: "$", ARS: "AR$" };

export default function BalanceView({ balances }) {
  const { t } = useLanguage();

  if (balances.length === 0) {
    return <p className="text-slate-500 text-sm py-8 text-center">{t("loot.empty")}</p>;
  }

  return (
    <div className="space-y-8">
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
                {group.transactions.map((tx, idx) => (
                  <li
                    key={idx}
                    className="flex items-center justify-between text-sm bg-ink-800/60 rounded-lg px-3 py-2"
                  >
                    <span>
                      <span className="text-neon-red">{tx.fromUsername}</span>
                      <span className="text-slate-500"> {t("loot.owes")} </span>
                      <span className="text-neon-green">{tx.toUsername}</span>
                    </span>
                    <span className="font-mono text-neon-gold">{tx.amount.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
