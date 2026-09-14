const jalaali = require("jalaali-js");

function pad(n) {
  return String(n).padStart(2, "0");
}

// Matches exactly what JalaliDatePicker.jsx stores (react-date-object's
// .format("YYYY/MM/DD")), so string equality/ordering against stored
// invoice_date/due_date/etc. values works correctly.
function toJalaliString(date) {
  const { jy, jm, jd } = jalaali.toJalaali(date);
  return `${jy}/${pad(jm)}/${pad(jd)}`;
}

function todayJalaliString() {
  return toJalaliString(new Date());
}

// Returns the last `n` Jalali date strings ending today, oldest first —
// used to build a zero-filled chart timeline even for days with no data.
function lastNJalaliDays(n) {
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(toJalaliString(d));
  }
  return days;
}

module.exports = { toJalaliString, todayJalaliString, lastNJalaliDays };
