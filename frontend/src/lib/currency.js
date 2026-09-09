import { useEffect, useState } from "react";
import { api, exchangeRatesApi } from "./api.js";
import { toFa } from "./persian.js";

export const CURRENCY_LABELS = { usd: "دلار آمریکا", eur: "یورو", cny: "یوان چین" };
export const CURRENCY_SYMBOLS = { usd: "$", eur: "€", cny: "¥" };

/**
 * Fetches the company's preferred currency + latest exchange rates once,
 * and returns a `format(amountRial)` helper that renders e.g. "$ 12.40"
 * next to a Rial amount — or null if no preferred currency is set, or the
 * rate for it isn't available yet.
 */
export function usePreferredCurrencyDisplay() {
  const [preferred, setPreferred] = useState(null);
  const [rates, setRates] = useState(null);

  useEffect(() => {
    api.company.get().then((c) => setPreferred(c.preferred_currency || null));
    exchangeRatesApi.get().then(setRates);
  }, []);

  function format(amountRial) {
    if (!preferred || !rates || !rates[preferred]) return null;
    const rate = rates[preferred];
    const converted = amountRial / rate;
    return `${CURRENCY_SYMBOLS[preferred]} ${toFa(converted.toLocaleString("en-US", { maximumFractionDigits: 2 }))}`;
  }

  return { preferred, rates, format };
}
