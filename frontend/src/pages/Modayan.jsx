import React from "react";
import CrudModule from "../components/CrudModule.jsx";

export default function Modayan() {
  return (
    <CrudModule
      title="سامانه مودیان"
      description="وضعیت ارسال فاکتورها به سامانه مودیان را ثبت و پیگیری کنید."
      resource="modayan"
      columns={[
        { key: "invoice_ref", label: "شماره فاکتور" },
        { key: "submission_date", label: "تاریخ ارسال" },
        { key: "tax_id", label: "شناسه مالیاتی" },
        { key: "status", label: "وضعیت" },
      ]}
      formFields={[
        { name: "invoice_ref", label: "شماره فاکتور مرجع", type: "text", required: true },
        { name: "submission_date", label: "تاریخ ارسال", type: "date", required: true },
        { name: "tax_id", label: "شناسه مالیاتی / اقتصادی", type: "text" },
        { name: "status", label: "وضعیت", type: "select", required: true, options: [
          { value: "ارسال شده", label: "ارسال شده" },
          { value: "تایید شده", label: "تایید شده" },
          { value: "رد شده", label: "رد شده" },
          { value: "خطا", label: "خطا" },
        ] },
        { name: "description", label: "شرح / توضیح خطا", type: "textarea" },
      ]}
      emptyValues={{ invoice_ref: "", submission_date: "", tax_id: "", status: "ارسال شده", description: "" }}
    />
  );
}
