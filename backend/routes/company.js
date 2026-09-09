const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/", (req, res) => {
  const row = db.prepare("SELECT * FROM company_info WHERE id = 1").get();
  res.json(row || { id: 1, name: "", legal_id: "", economic_code: "", address: "", phone: "", preferred_currency: null });
});

router.put("/", (req, res) => {
  const { name = "", legal_id = "", economic_code = "", address = "", phone = "", preferred_currency = null } = req.body;
  db.prepare(
    `INSERT INTO company_info (id, name, legal_id, economic_code, address, phone, preferred_currency)
     VALUES (1, @name, @legal_id, @economic_code, @address, @phone, @preferred_currency)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       legal_id = excluded.legal_id,
       economic_code = excluded.economic_code,
       address = excluded.address,
       phone = excluded.phone,
       preferred_currency = excluded.preferred_currency`
  ).run({ name, legal_id, economic_code, address, phone, preferred_currency });
  res.json(db.prepare("SELECT * FROM company_info WHERE id = 1").get());
});

module.exports = router;
