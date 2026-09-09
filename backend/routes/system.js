const express = require("express");
const os = require("os");
const errorLog = require("../lib/errorLog");

const router = express.Router();

// CPU load is measured as a delta between two samples of process.cpus()
// ticks, since a single instantaneous reading of os.cpus() is meaningless
// (it's a cumulative counter since boot). We keep the previous sample here
// and diff against it on every request.
let lastCpuSample = os.cpus();

function cpuPercent() {
  const current = os.cpus();
  let idleDelta = 0;
  let totalDelta = 0;

  for (let i = 0; i < current.length; i++) {
    const prev = lastCpuSample[i]?.times;
    const curr = current[i].times;
    if (!prev) continue;
    const prevTotal = prev.user + prev.nice + prev.sys + prev.idle + prev.irq;
    const currTotal = curr.user + curr.nice + curr.sys + curr.idle + curr.irq;
    totalDelta += currTotal - prevTotal;
    idleDelta += curr.idle - prev.idle;
  }

  lastCpuSample = current;
  if (totalDelta <= 0) return 0;
  return Math.round(((totalDelta - idleDelta) / totalDelta) * 100);
}

// GET /api/system/stats -> host machine's RAM/CPU usage (the server the app
// itself is running on), meant to be polled every few seconds by the
// dashboard. Memory is exact (os.totalmem/os.freemem); CPU is an
// instant-ish delta sample rather than a long-running average.
router.get("/stats", (req, res) => {
  const totalMemMB = Math.round(os.totalmem() / 1024 / 1024);
  const freeMemMB = Math.round(os.freemem() / 1024 / 1024);
  const usedMemMB = totalMemMB - freeMemMB;

  res.json({
    cpuPercent: cpuPercent(),
    memUsedMB: usedMemMB,
    memTotalMB: totalMemMB,
    memPercent: Math.round((usedMemMB / totalMemMB) * 100),
    uptimeSeconds: Math.round(os.uptime()),
  });
});

// GET /api/system/errors -> last 3 (configurable) server-side errors, as
// captured by lib/errorLog (which server.js wires up to intercept every
// console.error call app-wide).
router.get("/errors", (req, res) => {
  res.json(errorLog.recent(3));
});

module.exports = router;
