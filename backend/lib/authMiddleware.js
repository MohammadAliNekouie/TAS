const { verifyToken } = require("./auth");

// Attaches req.user from a valid "Authorization: Bearer <token>" header.
// Rejects with 401 if missing/invalid/expired.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const cookies = Object.fromEntries(String(req.headers.cookie || "").split(";").filter(Boolean).map(v=>{const i=v.indexOf("="); return i<0?[v.trim(),""]:[v.slice(0,i).trim(),decodeURIComponent(v.slice(i+1).trim())];}));
  const token = header.startsWith("Bearer ") ? header.slice(7) : (cookies.tas_session || null);
  if (!token) return res.status(401).json({ error: "ورود به سیستم الزامی است." });
  try {
    req.user = verifyToken(token);
    next();
  } catch (err) {
    res.status(401).json({ error: "نشست شما منقضی شده است، دوباره وارد شوید." });
  }
}

// Blocks mutating requests (POST/PUT/DELETE) for the 'viewer' role — applied
// after requireAuth on every /api route so read-only accounts genuinely
// can't write, not just "the UI doesn't show the button".
function blockViewerWrites(req, res, next) {
  const isMutating = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
  if (isMutating && req.user?.role === "viewer") {
    return res.status(403).json({ error: "این حساب کاربری فقط دسترسی مشاهده دارد." });
  }
  next();
}

// Restricts a route to admin only (used for user management, backup/restore,
// and the destructive financial-data wipe).
function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "این عملیات فقط برای مدیر سیستم مجاز است." });
  }
  next();
}

module.exports = { requireAuth, blockViewerWrites, requireAdmin };
