import React from "react";
import CrudModule from "../components/CrudModule.jsx";

const typeLabel = { customer: "مشتری", supplier: "تامین‌کننده", both: "مشتری و تامین‌کننده" };
const legalStatusLabel = { individual: "حقیقی", legal: "حقوقی" };

export default function Parties() {
  return (
    <CrudModule
      title="طرف‌های حساب"
      description="مشتریان و تامین‌کنندگان را یک‌بار تعریف کنید تا در فاکتورها، دریافت/پرداخت و چک‌ها قابل انتخاب باشند. تعیین نوع شخص (حقیقی/حقوقی) باعث می‌شود داشبورد در صورت لزوم برای بررسی سامانه مودیان یادآوری نشان دهد."
      resource="parties"
      columns={[
        { key: "code", label: "کد" },
        { key: "name", label: "نام" },
        { key: "type", label: "نوع همکاری", format: (v) => typeLabel[v] || v },
        { key: "legal_status", label: "نوع شخص", format: (v) => legalStatusLabel[v] || "نامشخص" },
        { key: "phone", label: "تلفن" },
        { key: "economic_code", label: "کد اقتصادی" },
      ]}
      formFields={[
        { name: "name", label: "نام طرف حساب", type: "text", required: true },
        { name: "type", label: "نوع همکاری", type: "select", required: true, options: [
          { value: "customer", label: "مشتری" },
          { value: "supplier", label: "تامین‌کننده" },
          { value: "both", label: "مشتری و تامین‌کننده" },
        ] },
        { name: "legal_status", label: "نوع شخص (برای یادآوری سامانه مودیان)", type: "select", placeholder: "نامشخص", options: [
          { value: "individual", label: "حقیقی" },
          { value: "legal", label: "حقوقی" },
        ] },
        { name: "phone", label: "تلفن", type: "text" },
        { name: "economic_code", label: "کد اقتصادی / شناسه ملی", type: "text" },
        { name: "address", label: "آدرس", type: "textarea" },
        { name: "description", label: "توضیحات", type: "textarea" },
      ]}
      emptyValues={{ name: "", type: "both", legal_status: "", phone: "", economic_code: "", address: "", description: "" }}
    />
  );
}
