"use client";

import { useState } from "react";
import {
  LiveMarketTerminal,
  liveMarkets,
} from "./live-market-terminal";

export function MarketWorkspace() {
  const [selectedKey, setSelectedKey] =
    useState<(typeof liveMarkets)[number]["key"]>("BTCUSD");

  return (
    <LiveMarketTerminal
      onMarketChange={setSelectedKey}
      selectedKey={selectedKey}
    />
  );
}
