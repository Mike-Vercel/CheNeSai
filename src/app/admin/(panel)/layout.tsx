import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth/admin";
import { AdminShell } from "@/features/admin/AdminShell";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return (
    <AdminShell me={{ userId: admin.userId, email: admin.email, displayName: admin.displayName, role: admin.role }}>{children}</AdminShell>
  );
}
