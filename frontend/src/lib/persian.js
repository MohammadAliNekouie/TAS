const faDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export function toFa(n) {
  return String(n).replace(/\d/g, (d) => faDigits[d]);
}

// All monetary amounts in the app are Rial, grouped in 3s (e.g. ۱٬۲۵۰٬۰۰۰ ریال).
export function rial(n) {
  return toFa(Math.round(n || 0).toLocaleString("en-US")) + " ریال";
}
