const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// The JWT secret is generated once and persisted to disk (rather than
// regenerated randomly on every restart), so logging in doesn't get
// invalidated every time the server restarts. Set JWT_SECRET yourself in
// production if you prefer to manage it explicitly.
const SECRET_PATH = path.join(__dirname, "..", "data", "jwt-secret.txt");

function getSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  try {
    return fs.readFileSync(SECRET_PATH, "utf8").trim();
  } catch (_) {
    const secret = crypto.randomBytes(48).toString("hex");
    fs.writeFileSync(SECRET_PATH, secret, "utf8");
    return secret;
  }
}

const SECRET = getSecret();
const TOKEN_TTL = "12h";

function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10);
}

function verifyPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username, role: user.role, full_name: user.full_name }, SECRET, {
    expiresIn: TOKEN_TTL,
  });
}

function verifyToken(token) {
  return jwt.verify(token, SECRET);
}

module.exports = { hashPassword, verifyPassword, signToken, verifyToken };
