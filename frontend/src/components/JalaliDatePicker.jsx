import React, { useMemo, useRef } from "react";
import DatePicker from "react-multi-date-picker";
import DateObject from "react-date-object";
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
  minWidth: 0,
};

/**
 * Calendar-only Jalali date field (editable={false}): the user must pick a
 * date from the popup calendar — typing digits/text directly into the field
 * is disabled — this removes an entire class of malformed-date bugs that a
 * free-text "۱۴۰۵/۰۶/۱۴"-style input allowed.
 */
export default function JalaliDatePicker({ value, onChange, placeholder }) {
  const pickerRef = useRef(null);

  // Memoized so a fresh DateObject isn't constructed on every render (which
  // would give the library a new reference each time even when the actual
  // date hasn't changed) — recreated only when the underlying string value
  // actually changes.
  const dateValue = useMemo(
    () => (value ? new DateObject({ date: value, format: "YYYY/MM/DD", calendar: persian, locale: persian_fa }) : ""),
    [value]
  );

  function handleChange(dateObject) {
    onChange(dateObject ? dateObject.format("YYYY/MM/DD") : "");
    // Don't rely on the library's own auto-close-on-select behavior — force
    // it closed explicitly via its imperative ref API. A tiny timeout lets
    // its internal state update (the value we just set above) settle first.
    setTimeout(() => {
      pickerRef.current?.closeCalendar();
    }, 0);
  }

  return (
    <DatePicker
      ref={pickerRef}
      value={dateValue}
      onChange={handleChange}
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
