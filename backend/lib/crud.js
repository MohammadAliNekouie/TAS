const express = require("express");
const db = require("../db");

// Builds a full CRUD router (list, create, update, delete) for a simple table.
// `fields` lists the columns a client is allowed to write via POST/PUT.
// `table` is always a hardcoded constant supplied by the route file that
// calls this (never derived from request input), so string interpolation
// here is safe.
function createCrudRouter(table, fields) {
  const router = express.Router();

  router.get("/", (req, res) => {
    const rows = db.prepare(`SELECT * FROM ${table} ORDER BY id DESC`).all();
    res.json(rows);
  });

  router.post("/", (req, res) => {
    const cols = fields.filter((f) => req.body[f] !== undefined);
    if (cols.length === 0) return res.status(400).json({ error: "no valid fields provided" });
    const colList = cols.join(", ");
    const placeholders = cols.map((c) => `@${c}`).join(", ");
    const info = db.prepare(`INSERT INTO ${table} (${colList}) VALUES (${placeholders})`).run(req.body);
    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(info.lastInsertRowid);
    res.status(201).json(row);
  });

  router.put("/:id", (req, res) => {
    const cols = fields.filter((f) => req.body[f] !== undefined);
    if (cols.length === 0) return res.status(400).json({ error: "no valid fields provided" });
    const setClause = cols.map((c) => `${c} = @${c}`).join(", ");
    db.prepare(`UPDATE ${table} SET ${setClause} WHERE id = @id`).run({ ...req.body, id: req.params.id });
    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
    if (!row) return res.status(404).json({ error: "not found" });
    res.json(row);
  });

  router.delete("/:id", (req, res) => {
    db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(req.params.id);
    res.status(204).end();
  });

  return router;
}

module.exports = { createCrudRouter };
