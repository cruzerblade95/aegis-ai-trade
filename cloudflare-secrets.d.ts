declare namespace Cloudflare {
  interface Env {
    MARKET_DATA_PROVIDER?: "kraken" | "twelve_data";
    TWELVE_DATA_API_KEY?: string;
  }
}

interface CloudflareEnv {
  MARKET_DATA_PROVIDER?: "kraken" | "twelve_data";
  TWELVE_DATA_API_KEY?: string;
}
