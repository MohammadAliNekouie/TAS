const express = require("express");
const db = require("../db");
const { normalizePersian } = require("../lib/persian");

const router = express.Router();

// A stable, human-readable code derived directly from the AUTOINCREMENT id.
// Because SQLite's AUTOINCREMENT guarantees an id is never reused even after
// its row is deleted, this code is guaranteed unique for the life of the
// database, including across deletions.
function withCode(row) {
  if (!row) return row;
  return { ...row, code: `P-${String(row.id).padStart(4, "0")}` };
}

router.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM parties ORDER BY id DESC").all();
  res.json(rows.map(withCode));
});

router.post("/", (req, res) => {
  const { name, type = "both", phone = "", economic_code = "", address = "", description = "" } = req.body;
  const legal_status = req.body.legal_status || null; // CrudModule sends "" for "unset", not undefined
  if (!name || !name.trim()) return res.status(400).json({ error: "نام طرف حساب الزامی است." });

  const normalized = normalizePersian(name);
  const existing = db.prepare("SELECT id FROM parties WHERE name_normalized = ?").get(normalized);
  if (existing) {
    return res.status(409).json({ error: `طرف حسابی با نام «${name}» قبلاً تعریف شده است (کد P-${String(existing.id).padStart(4, "0")}).` });
  }

  const info = db
    .prepare(
      `INSERT INTO parties (name, name_normalized, type, legal_status, phone, economic_code, address, description)
       VALUES (@name, @name_normalized, @type, @legal_status, @phone, @economic_code, @address, @description)`
    )
    .run({ name, name_normalized: normalized, type, legal_status, phone, economic_code, address, description });

  res.status(201).json(withCode(db.prepare("SELECT * FROM parties WHERE id = ?").get(info.lastInsertRowid)));
});

router.put("/:id", (req, res) => {
  const { name, type = "both", phone = "", economic_code = "", address = "", description = "" } = req.body;
  const legal_status = req.body.legal_status || null;
  if (!name || !name.trim()) return res.status(400).json({ error: "نام طرف حساب الزامی است." });

  const normalized = normalizePersian(name);
  const dup = db.prepare("SELECT id FROM parties WHERE name_normalized = ? AND id != ?").get(normalized, req.params.id);
  if (dup) {
    return res.status(409).json({ error: `طرف حساب دیگری با همین نام وجود دارد (کد P-${String(dup.id).padStart(4, "0")}).` });
  }

  db.prepare(
    `UPDATE parties SET name = @name, name_normalized = @name_normalized, type = @type, legal_status = @legal_status,
       phone = @phone, economic_code = @economic_code, address = @address, description = @description
     WHERE id = @id`
  ).run({ name, name_normalized: normalized, type, legal_status, phone, economic_code, address, description, id: req.params.id });

  const row = db.prepare("SELECT * FROM parties WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(withCode(row));
});

router.delete("/:id", (req, res) => {
  try {
    db.prepare("DELETE FROM parties WHERE id = ?").run(req.params.id);
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: "این طرف حساب در اسناد دیگر استفاده شده و ممکن است قابل حذف نباشد." });
  }
});

module.exports = router;
