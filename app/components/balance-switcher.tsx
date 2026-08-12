"use client";

import { useState } from "react";

type BalanceSwitcherProps = {
  currentBalanceMinor: number;
  virtualBalanceMinor: number;
  currency: string;
};

export function BalanceSwitcher({ currentBalanceMinor, virtualBalanceMinor, currency }: BalanceSwitcherProps) {
  const [selected, setSelected] = useState<"current" | "virtual">("current");
  const amount = selected === "current" ? currentBalanceMinor : virtualBalanceMinor;
  return (
    <article className="dashboard-card dashboard-card-primary balance-switcher-card">
      <div className="balance-switcher-heading">
        <span className="dashboard-card-label">ACCOUNT BALANCE</span>
        <div className="balance-toggle" role="group" aria-label="Balance type">
          <button type="button" className={selected === "current" ? "active" : ""} onClick={() => setSelected("current")}>Current</button>
          <button type="button" className={selected === "virtual" ? "active" : ""} onClick={() => setSelected("virtual")}>Virtual</button>
        </div>
      </div>
      <h2>{new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount / 100)}</h2>
      <p>{selected === "current" ? "System account funds used by non-virtual trading environments. No external payment gateway is connected." : "Practice funds used only in the Virtual environment."}</p>
      <div className="dashboard-card-footer"><span>{selected === "current" ? "Current Balance" : "Virtual Balance"}</span><strong>{currency}</strong></div>
    </article>
  );
}
