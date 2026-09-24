const express = require("express");
const db = require("../db");
const { verifyPassword, signToken } = require("../lib/auth");
const { requireAuth } = require("../lib/authMiddleware");

const router = express.Router();

router.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "نام کاربری و رمز عبور الزامی است." });

  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: "نام کاربری یا رمز عبور اشتباه است." });
  }

  const token = signToken(user);
  res.setHeader("Set-Cookie", `tas_session=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=43200${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  res.json({ user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role } });
});

router.post("/logout", (req,res)=>{ res.setHeader("Set-Cookie", "tas_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0" + (process.env.NODE_ENV === "production" ? "; Secure" : "")); res.json({ok:true}); });

router.get("/me", requireAuth, (req, res) => {
  res.json(req.user);
});

module.exports = router;
