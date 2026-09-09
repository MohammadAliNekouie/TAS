const fs = require("fs");
const path = require("path");

// Purely a debugging aid — never surfaced in the UI. The dashboard's
// "recent errors" panel is a separate, small in-memory list (see
// errorLog.js) meant for end users; this is the full raw terminal history,
// capped at MAX_LINES and persisted to disk so it survives restarts, for
// whoever is troubleshooting the deployment directly.
const LOG_PATH = path.join(__dirname, "..", "data", "debug.log");
const MAX_LINES = 1000;

let lines = [];
try {
  lines = fs.readFileSync(LOG_PATH, "utf8").split("\n").filter(Boolean).slice(-MAX_LINES);
} catch (_) {
  lines = [];
}

function formatArg(a) {
  if (a instanceof Error) return a.stack || a.message;
  if (typeof a === "object" && a !== null) {
    try { return JSON.stringify(a); } catch (_) { return String(a); }
  }
  return String(a);
}

function write(level, args) {
  const line = `[${new Date().toISOString()}] [${level}] ${args.map(formatArg).join(" ")}`;
  lines.push(line);
  if (lines.length > MAX_LINES) lines = lines.slice(-MAX_LINES); // drop oldest — circular buffer
  try {
    fs.writeFileSync(LOG_PATH, lines.join("\n") + "\n", "utf8");
  } catch (_) {
    // logging must never be the thing that crashes the app
  }
}

module.exports = { write, LOG_PATH, MAX_LINES };
