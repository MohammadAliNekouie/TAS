import React from "react";
import DatePicker from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";

const inputStyle = {
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "9px 12px",
  fontSize: 13.5,
  fontFamily: "inherit",
  background: "var(--bg)",
  color: "var(--ink)",
  width: "100%",
};

/**
 * Calendar-only Jalali date field (editable={false}): the user must pick a
 * date from the popup calendar — typing digits/text directly into the field
 * is disabled — this removes an entire class of malformed-date bugs that a
 * free-text "۱۴۰۵/۰۶/۱۴"-style input allowed.
 */
export default function JalaliDatePicker({ value, onChange, placeholder }) {
  return (
    <DatePicker
      value={value || ""}
      onChange={(dateObject) => onChange(dateObject ? dateObject.format("YYYY/MM/DD") : "")}
      calendar={persian}
      locale={persian_fa}
      calendarPosition="bottom-right"
      editable={false}
      inputClass="tas-date-input"
      placeholder={placeholder || "انتخاب تاریخ"}
      style={inputStyle}
      containerStyle={{ width: "100%" }}
    />
  );
}
