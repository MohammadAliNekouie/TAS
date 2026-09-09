import React from "react";
import CrudModule from "../components/CrudModule.jsx";

export default function Production() {
  return (
    <CrudModule
      title="مدیریت تولید"
      description="دستورهای تولید را ثبت و وضعیت پیشرفت آن‌ها را پیگیری کنید."
      resource="production"
      columns={[
        { key: "order_date", label: "تاریخ" },
        { key: "product_name", label: "محصول" },
        { key: "quantity", label: "تعداد", format: "faNumber" },
        { key: "status", label: "وضعیت" },
      ]}
      formFields={[
        { name: "order_date", label: "تاریخ", type: "date", required: true },
        { name: "product_name", label: "نام محصول", type: "text", required: true },
        { name: "quantity", label: "تعداد", type: "number", required: true },
        { name: "status", label: "وضعیت", type: "select", required: true, options: [
          { value: "در حال تولید", label: "در حال تولید" },
          { value: "تکمیل شده", label: "تکمیل شده" },
          { value: "متوقف شده", label: "متوقف شده" },
        ] },
        { name: "description", label: "شرح", type: "textarea" },
      ]}
      emptyValues={{ order_date: "", product_name: "", quantity: "", status: "در حال تولید", description: "" }}
    />
  );
}
