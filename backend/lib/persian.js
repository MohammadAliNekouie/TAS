// Normalizes Persian/Arabic look-alike characters so search matches
// regardless of which keyboard/character set the user typed with.
function normalizePersian(str) {
  if (!str) return "";
  return String(str)
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\u200c/g, " ") // zero-width non-joiner -> space
    .replace(/[\u064B-\u065F]/g, "") // strip diacritics
    .trim()
    .toLowerCase();
}

module.exports = { normalizePersian };
