import React from "react";
import CrudModule from "../components/CrudModule.jsx";

const roleLabel = { admin: "مدیر سیستم", accountant: "حسابدار", viewer: "مشاهده‌گر" };

export default function Users() {
  return (
    <CrudModule
      title="کاربران و سطوح دسترسی"
      description="مدیر سیستم دسترسی کامل دارد، حسابدار می‌تواند ثبت/ویرایش کند، و مشاهده‌گر فقط اجازه دیدن اطلاعات را دارد (حتی از طریق API نیز نمی‌تواند تغییری ثبت کند)."
      resource="users"
      columns={[
        { key: "username", label: "نام کاربری" },
        { key: "full_name", label: "نام کامل" },
        { key: "role", label: "سطح دسترسی", format: (v) => roleLabel[v] || v },
        { key: "created_at", label: "تاریخ ایجاد" },
      ]}
      formFields={[
        { name: "username", label: "نام کاربری", type: "text", required: true },
        { name: "full_name", label: "نام کامل", type: "text", required: true },
        { name: "role", label: "سطح دسترسی", type: "select", required: true, options: [
          { value: "admin", label: "مدیر سیستم" },
          { value: "accountant", label: "حسابدار" },
          { value: "viewer", label: "مشاهده‌گر" },
        ] },
        { name: "password", label: "رمز عبور (برای کاربر جدید الزامی — برای ویرایش خالی بگذارید تا تغییر نکند)", type: "password" },
      ]}
      emptyValues={{ username: "", full_name: "", role: "accountant", password: "" }}
    />
  );
}
