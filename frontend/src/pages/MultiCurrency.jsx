import React from "react";
import CrudModule from "../components/CrudModule.jsx";

export default function MultiCurrency() {
  return (
    <CrudModule
      title="حسابداری چند ارزی"
      description="تراکنش‌های ارزی را همراه با نرخ روز و معادل ریالی ثبت کنید."
      resource="multi-currency"
      columns={[
        { key: "entry_date", label: "تاریخ" },
        { key: "currency", label: "ارز" },
        { key: "rate", label: "نرخ", format: "faNumber" },
        { key: "amount_fc", label: "مبلغ ارزی", format: "faNumber" },
        { key: "amount_rial", label: "معادل ریال", format: "rial" },
      ]}
      formFields={[
        { name: "entry_date", label: "تاریخ", type: "date", required: true },
        { name: "currency", label: "نوع ارز", type: "select", required: true, options: [
          { value: "USD", label: "دلار آمریکا (USD)" },
          { value: "EUR", label: "یورو (EUR)" },
          { value: "AED", label: "درهم امارات (AED)" },
        ] },
        { name: "rate", label: "نرخ تبدیل (ریال)", type: "money", required: true },
        { name: "amount_fc", label: "مبلغ به ارز", type: "number", required: true },
        { name: "amount_rial", label: "معادل ریال (اختیاری)", type: "money" },
        { name: "description", label: "شرح", type: "textarea" },
      ]}
      emptyValues={{ entry_date: "", currency: "USD", rate: "", amount_fc: "", amount_rial: "", description: "" }}
    />
  );
}
