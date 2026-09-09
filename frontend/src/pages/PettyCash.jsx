import React from "react";
import CrudModule from "../components/CrudModule.jsx";

export default function PettyCash() {
  return (
    <CrudModule
      title="تنخواه‌گردان"
      description="واریز و برداشت از وجوه تنخواه را ثبت و تسویه کنید."
      resource="petty-cash"
      columns={[
        { key: "fund_name", label: "صندوق" },
        { key: "entry_date", label: "تاریخ" },
        { key: "type", label: "نوع", format: (v) => (v === "topup" ? "واریز به تنخواه" : "هزینه از تنخواه") },
        { key: "category", label: "دسته" },
        { key: "amount", label: "مبلغ", format: "rial" },
      ]}
      formFields={[
        { name: "fund_name", label: "نام صندوق / تنخواه‌دار", type: "text", required: true },
        { name: "entry_date", label: "تاریخ", type: "date", required: true },
        { name: "type", label: "نوع تراکنش", type: "select", required: true, options: [
          { value: "topup", label: "واریز به تنخواه" },
          { value: "expense", label: "هزینه از تنخواه" },
        ] },
        { name: "category", label: "دسته هزینه", type: "text" },
        { name: "amount", label: "مبلغ (ریال)", type: "money", required: true },
        { name: "description", label: "شرح", type: "textarea" },
      ]}
      emptyValues={{ fund_name: "", entry_date: "", type: "expense", category: "", amount: "", description: "" }}
    />
  );
}
