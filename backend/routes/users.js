const express = require("express");
const db = require("../db");
const { hashPassword } = require("../lib/auth");
const { requireAdmin } = require("../lib/authMiddleware");

const router = express.Router();

router.use(requireAdmin);

router.get("/", (req, res) => {
  const rows = db.prepare("SELECT id, username, full_name, role, created_at FROM users ORDER BY id").all();
  res.json(rows);
});

router.post("/", (req, res) => {
  const { username, password, full_name, role = "accountant" } = req.body;
  if (!username || !password || !full_name) return res.status(400).json({ error: "نام کاربری، رمز عبور و نام کامل الزامی است." });
  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (existing) return res.status(409).json({ error: "این نام کاربری قبلاً استفاده شده است." });

  const info = db
    .prepare("INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)")
    .run(username, hashPassword(password), full_name, role);
  const row = db.prepare("SELECT id, username, full_name, role, created_at FROM users WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(row);
});

router.put("/:id", (req, res) => {
  const { full_name, role, password } = req.body;
  const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "not found" });

  if (existing.role === "admin" && role && role !== "admin") {
    const otherAdmins = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND id != ?").get(req.params.id).c;
    if (otherAdmins === 0) return res.status(400).json({ error: "حداقل یک مدیر سیستم باید باقی بماند." });
  }

  db.prepare("UPDATE users SET full_name = COALESCE(?, full_name), role = COALESCE(?, role) WHERE id = ?")
    .run(full_name || null, role || null, req.params.id);
  if (password) {
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(password), req.params.id);
  }
  const row = db.prepare("SELECT id, username, full_name, role, created_at FROM users WHERE id = ?").get(req.params.id);
  res.json(row);
});

router.delete("/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "not found" });
  if (existing.role === "admin") {
    const otherAdmins = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND id != ?").get(req.params.id).c;
    if (otherAdmins === 0) return res.status(400).json({ error: "حداقل یک مدیر سیستم باید باقی بماند." });
  }
  db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

module.exports = router;
