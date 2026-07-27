"use client";

import { useState } from "react";
import { LiveMarketTerminal, liveMarkets } from "./live-market-terminal";

export function MarketExplorerWorkspace() {
  const [selectedKey, setSelectedKey] = useState<
    (typeof liveMarkets)[number]["key"]
  >("BTCUSD");

  return (
    <LiveMarketTerminal
      onMarketChange={setSelectedKey}
      selectedKey={selectedKey}
      showLearningBalance={false}
    />
  );
}
