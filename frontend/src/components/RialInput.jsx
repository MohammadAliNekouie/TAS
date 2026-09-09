import React, { useEffect, useState } from "react";

const inputStyle = {
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "9px 12px",
  fontSize: 13.5,
  fontFamily: "inherit",
  background: "var(--bg)",
  color: "var(--ink)",
};

/**
 * A text input that always displays its value grouped in 3s while typing
 * (e.g. "1,250,000") and reports back a plain number via onChange — used
 * everywhere the app asks for a Rial amount, so it's much harder to
 * mistype a magnitude (e.g. missing/extra zero) than a bare number input.
 */
export default function RialInput({ value, onChange, required, disabled, placeholder, style }) {
  const [display, setDisplay] = useState("");

  useEffect(() => {
    if (value === "" || value === null || value === undefined) {
      setDisplay("");
    } else {
      setDisplay(Number(value).toLocaleString("en-US"));
    }
  }, [value]);

  function handleChange(e) {
    const digitsOnly = e.target.value.replace(/[^\d]/g, "");
    if (digitsOnly === "") {
      setDisplay("");
      onChange("");
      return;
    }
    const num = Number(digitsOnly);
    setDisplay(num.toLocaleString("en-US"));
    onChange(num);
  }

  return (
    <div style={{ position: "relative" }}>
      <input
        type="text"
        inputMode="numeric"
        required={required}
        disabled={disabled}
        value={display}
        onChange={handleChange}
        placeholder={placeholder || "0"}
        style={{ ...inputStyle, paddingLeft: 46, textAlign: "left", direction: "ltr", opacity: disabled ? 0.6 : 1, ...style }}
      />
      <span
        style={{
          position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
          fontSize: 11, color: "var(--ink-soft)", pointerEvents: "none",
        }}
      >
        ریال
      </span>
    </div>
  );
}
