// Fetches USD/EUR/CNY → IRR rates every 30 minutes and keeps the latest
// successful result in memory. IMPORTANT CAVEATS (read before relying on
// this in production):
//
//  1. This was written and packaged in a sandboxed environment with no
//     network access, so the actual live behavior of the endpoint below
//     has NOT been verified end-to-end. Test it once the app is running
//     on your real machine, and check the `error` field in the API
//     response if rates don't show up.
//  2. The source below (open.er-api.com) is a free, no-API-key exchange
//     rate service. Its IRR figure most likely reflects an official/
//     CBI-pegged rate, NOT Iran's free-market ("bazaar"/نیمایی) rate that
//     Iranian businesses usually price goods against — these can differ
//     substantially. If you need the free-market rate specifically, swap
//     SOURCE_URL below for a provider that tracks it (e.g. a bonbast-style
//     aggregator), adjusting the parser in fetchRates() to match its
//     response shape.
const SOURCE_URL = process.env.EXCHANGE_RATE_API_URL || "https://open.er-api.com/v6/latest/USD";
const REFRESH_MS = 30 * 60 * 1000; // 30 minutes

let state = {
  usd: null, eur: null, cny: null,
  updatedAt: null,
  error: "هنوز دریافت نشده است.",
};

async function fetchRates() {
  try {
    const res = await fetch(SOURCE_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const rates = data.rates || data.conversion_rates; // different providers name this differently
    if (!rates?.IRR || !rates?.EUR || !rates?.CNY) {
      throw new Error("پاسخ سرویس نرخ ارز فرمت مورد انتظار را ندارد.");
    }

    // Base currency of this response is USD, so rates.IRR is already
    // Rial-per-USD. Cross-derive Rial-per-EUR and Rial-per-CNY from the
    // USD-relative rates in the same response (see module comment above).
    state = {
      usd: rates.IRR,
      eur: rates.IRR / rates.EUR,
      cny: rates.IRR / rates.CNY,
      updatedAt: new Date().toISOString(),
      error: null,
    };
  } catch (err) {
    // Keep whatever the last successful rates were; just record why the
    // latest refresh failed, so the dashboard can show a "stale since X"
    // notice instead of silently going blank.
    state = { ...state, error: err.message };
    console.error("Exchange rate fetch failed:", err.message);
  }
}

function start() {
  fetchRates();
  setInterval(fetchRates, REFRESH_MS);
}

function getRates() {
  return state;
}

module.exports = { start, getRates };
