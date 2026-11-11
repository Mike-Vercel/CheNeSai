import { redirect } from "next/navigation";
import { getAdmin, hasRole } from "@/lib/auth/admin";
import { PresentersPage } from "@/features/admin/cms/presenters/PresentersPage";

export const metadata = { title: "Presentatori" };

export default async function AdminPresentersPage() {
  const admin = await getAdmin();
  if (!admin || !hasRole(admin.role, "admin")) redirect("/admin");
  return <PresentersPage />;
}
