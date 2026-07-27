"use client";

import { useState } from "react";
import {
  LiveMarketTerminal,
  liveMarkets,
} from "./live-market-terminal";

export function MarketWorkspace({
  initialSelectedKey = "BTCUSD",
}: {
  initialSelectedKey?: (typeof liveMarkets)[number]["key"];
}) {
  const [selectedKey, setSelectedKey] =
    useState<(typeof liveMarkets)[number]["key"]>(
      initialSelectedKey,
    );

  return (
    <LiveMarketTerminal
      onMarketChange={setSelectedKey}
      selectedKey={selectedKey}
    />
  );
}
