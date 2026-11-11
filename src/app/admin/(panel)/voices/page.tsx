import { redirect } from "next/navigation";
import { getAdmin, hasRole } from "@/lib/auth/admin";
import { VoicesPage } from "@/features/admin/cms/voices/VoicesPage";

export const metadata = { title: "Voci" };

export default async function AdminVoicesPage() {
  const admin = await getAdmin();
  if (!admin || !hasRole(admin.role, "admin")) redirect("/admin");
  return <VoicesPage />;
}
