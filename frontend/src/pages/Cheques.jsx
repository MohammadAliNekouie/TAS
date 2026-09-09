import React from "react";
import CrudModule from "../components/CrudModule.jsx";

export default function Cheques() {
  return (
    <CrudModule
      title="مدیریت چک"
      description="چک‌های دریافتنی و پرداختنی را ثبت و وضعیت وصول آن‌ها را پیگیری کنید."
      resource="cheques"
      columns={[
        { key: "type", label: "نوع", format: (v) => (v === "received" ? "دریافتنی" : "پرداختنی") },
        { key: "party", label: "طرف حساب" },
        { key: "amount", label: "مبلغ", format: "rial" },
        { key: "due_date", label: "سررسید" },
        { key: "sayad_id", label: "شناسه صیاد" },
        { key: "status", label: "وضعیت" },
      ]}
      formFields={[
        { name: "type", label: "نوع چک", type: "select", required: true, options: [
          { value: "received", label: "دریافتنی" },
          { value: "issued", label: "پرداختنی" },
        ] },
        { name: "party", label: "طرف حساب", type: "party", required: true },
        { name: "amount", label: "مبلغ (ریال)", type: "money", required: true },
        { name: "due_date", label: "تاریخ سررسید", type: "date", required: true },
        { name: "sayad_id", label: "شناسه صیاد (اختیاری)", type: "text" },
        { name: "status", label: "وضعیت", type: "select", required: true, options: [
          { value: "در جریان وصول", label: "در جریان وصول" },
          { value: "وصول شده", label: "وصول شده" },
          { value: "برگشتی", label: "برگشتی" },
          { value: "نزد صندوق", label: "نزد صندوق" },
          { value: "خرج شده", label: "خرج شده" },
          { value: "واگذار شده (ظهرنویسی)", label: "واگذار شده (ظهرنویسی)" },
        ] },
        { name: "endorsed_to", label: "واگذار شده به (در صورت ظهرنویسی)", type: "text" },
      ]}
      emptyValues={{ type: "received", party: "", amount: "", due_date: "", sayad_id: "", status: "در جریان وصول", endorsed_to: "" }}
    />
  );
}
