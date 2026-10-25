import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { AdminBottomNav, AdminSidebar } from "@/components/admin/AdminNav";

export const metadata: Metadata = { title: { default: "Admin", template: "%s | Admin" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="flex min-h-dvh text-[14px]">
      <AdminSidebar />
      <div className="min-w-0 flex-1 px-4 pb-20 pt-4 md:px-6 md:pb-8">{children}</div>
      <AdminBottomNav />
    </div>
  );
}
