import React from "react";
import CrudModule from "../components/CrudModule.jsx";

export default function ReceiptsPayments() {
  return (
    <CrudModule
      title="دریافت و پرداخت"
      description="دریافت‌ها و پرداخت‌های نقدی، بانکی و کارتخوان را مدیریت کنید."
      resource="receipts-payments"
      columns={[
        { key: "type", label: "نوع", format: (v) => (v === "receipt" ? "دریافت" : "پرداخت") },
        { key: "party", label: "طرف حساب" },
        { key: "method", label: "روش" },
        { key: "payment_date", label: "تاریخ" },
        { key: "amount", label: "مبلغ", format: "rial" },
      ]}
      formFields={[
        { name: "type", label: "نوع سند", type: "select", required: true, options: [
          { value: "receipt", label: "دریافت" },
          { value: "payment", label: "پرداخت" },
        ] },
        { name: "party", label: "طرف حساب", type: "party", required: true },
        { name: "method", label: "روش پرداخت", type: "select", required: true, options: [
          { value: "نقدی", label: "نقدی" },
          { value: "بانکی", label: "بانکی" },
          { value: "کارتخوان", label: "کارتخوان" },
          { value: "چک", label: "چک" },
        ] },
        { name: "payment_date", label: "تاریخ", type: "date", required: true },
        { name: "amount", label: "مبلغ (ریال)", type: "money", required: true },
        { name: "description", label: "شرح", type: "textarea" },
      ]}
      emptyValues={{ type: "receipt", party: "", method: "", payment_date: "", amount: "", description: "" }}
    />
  );
}
