const express = require("express");
const db = require("../db");
const { normalizePersian } = require("../lib/persian");

const router = express.Router();

// GET /api/chart-of-accounts/tree?parentId= -> children of a node.
// No parentId (or "null") returns the level-1 groups (fixed, read-only).
router.get("/tree", (req, res) => {
  const { parentId } = req.query;
  const rows = !parentId || parentId === "null"
    ? db.prepare("SELECT * FROM chart_of_accounts WHERE parent_id IS NULL ORDER BY code").all()
    : db.prepare("SELECT * FROM chart_of_accounts WHERE parent_id = ? ORDER BY code").all(parentId);
  res.json(rows);
});

// GET /api/chart-of-accounts/search?q=...  -> level-3 (leaf/تفصیلی) accounts
// only, since those are what journal voucher lines post against. Matches by
// exact id, code prefix, or any substring of the name.
router.get("/search", (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q) return res.json([]);
  const normalized = normalizePersian(q);

  const rows = db
    .prepare(
      `SELECT * FROM chart_of_accounts
       WHERE level = 3 AND (
         CAST(id AS TEXT) = @q OR code LIKE @codePrefix OR name_normalized LIKE @nameSubstring
       )
       ORDER BY
         CASE WHEN CAST(id AS TEXT) = @q THEN 0
              WHEN code = @q THEN 1
              WHEN name_normalized LIKE @namePrefix THEN 2
              ELSE 3 END,
         code
       LIMIT 30`
    )
    .all({ q, codePrefix: `${q}%`, nameSubstring: `%${normalized}%`, namePrefix: `${normalized}%` });

  const withPath = rows.map((row) => {
    const path = [];
    let current = row;
    while (current.parent_id) {
      const parent = db.prepare("SELECT * FROM chart_of_accounts WHERE id = ?").get(current.parent_id);
      if (!parent) break;
      path.unshift(parent.name);
      current = parent;
    }
    return { ...row, breadcrumb: path };
  });

  res.json(withPath);
});

function nextChildCode(parentCode, parentId, digits) {
  const siblings = db.prepare("SELECT code FROM chart_of_accounts WHERE parent_id = ?").all(parentId);
  let maxSeq = 0;
  for (const s of siblings) {
    const suffix = s.code.slice(parentCode.length);
    const n = parseInt(suffix, 10);
    if (!Number.isNaN(n) && n > maxSeq) maxSeq = n;
  }
  const seq = String(maxSeq + 1).padStart(digits, "0");
  return `${parentCode}${seq}`;
}

// ---------- level 2 (گروه کل) ----------

router.post("/groups", (req, res) => {
  const { parent_id, name } = req.body;
  if (!parent_id || !name || !name.trim()) return res.status(400).json({ error: "گروه اصلی و نام گروه کل الزامی است." });
  const parent = db.prepare("SELECT * FROM chart_of_accounts WHERE id = ?").get(parent_id);
  if (!parent || parent.level !== 1) return res.status(400).json({ error: "parent_id باید یک گروه اصلی (سطح ۱) باشد." });
  const nextCode = nextChildCode(parent.code, parent_id, 1);
  const info = db
    .prepare(
      `INSERT INTO chart_of_accounts (code, level, parent_id, name, name_normalized)
       VALUES (@code, 2, @parent_id, @name, @name_normalized)`
    )
    .run({ code: nextCode, parent_id, name: name.trim(), name_normalized: normalizePersian(name) });
  res.status(201).json(db.prepare("SELECT * FROM chart_of_accounts WHERE id = ?").get(info.lastInsertRowid));
});

router.put("/groups/:id", (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "نام گروه کل الزامی است." });
  const node = db.prepare("SELECT * FROM chart_of_accounts WHERE id = ? AND level = 2").get(req.params.id);
  if (!node) return res.status(404).json({ error: "not found" });
  db.prepare("UPDATE chart_of_accounts SET name = ?, name_normalized = ? WHERE id = ?")
    .run(name.trim(), normalizePersian(name), req.params.id);
  res.json(db.prepare("SELECT * FROM chart_of_accounts WHERE id = ?").get(req.params.id));
});

router.delete("/groups/:id", (req, res) => {
  const childCount = db.prepare("SELECT COUNT(*) AS c FROM chart_of_accounts WHERE parent_id = ?").get(req.params.id).c;
  if (childCount > 0) return res.status(400).json({ error: "ابتدا حساب‌های معین این گروه را حذف کنید." });
  try {
    db.prepare("DELETE FROM chart_of_accounts WHERE id = ? AND level = 2").run(req.params.id);
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: "این گروه در اسنادی استفاده شده و قابل حذف نیست." });
  }
});

// ---------- level 3 (حساب معین/تفصیلی) ----------

router.post("/accounts", (req, res) => {
  const { parent_id, name } = req.body;
  if (!parent_id || !name || !name.trim()) return res.status(400).json({ error: "گروه کل و نام حساب معین الزامی است." });
  const parent = db.prepare("SELECT * FROM chart_of_accounts WHERE id = ?").get(parent_id);
  if (!parent || parent.level !== 2) return res.status(400).json({ error: "parent_id باید یک گروه کل (سطح ۲) باشد." });
  const nextCode = nextChildCode(parent.code, parent_id, 2);
  const info = db
    .prepare(
      `INSERT INTO chart_of_accounts (code, level, parent_id, name, name_normalized)
       VALUES (@code, 3, @parent_id, @name, @name_normalized)`
    )
    .run({ code: nextCode, parent_id, name: name.trim(), name_normalized: normalizePersian(name) });
  res.status(201).json(db.prepare("SELECT * FROM chart_of_accounts WHERE id = ?").get(info.lastInsertRowid));
});

router.put("/accounts/:id", (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "نام حساب معین الزامی است." });
  const node = db.prepare("SELECT * FROM chart_of_accounts WHERE id = ? AND level = 3").get(req.params.id);
  if (!node) return res.status(404).json({ error: "not found" });
  db.prepare("UPDATE chart_of_accounts SET name = ?, name_normalized = ? WHERE id = ?")
    .run(name.trim(), normalizePersian(name), req.params.id);
  res.json(db.prepare("SELECT * FROM chart_of_accounts WHERE id = ?").get(req.params.id));
});

router.delete("/accounts/:id", (req, res) => {
  try {
    db.prepare("DELETE FROM chart_of_accounts WHERE id = ? AND level = 3").run(req.params.id);
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: "این حساب در اسنادی استفاده شده و قابل حذف نیست." });
  }
});

module.exports = router;
