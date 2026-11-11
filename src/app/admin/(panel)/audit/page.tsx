import { AuditLog } from "@/features/admin/cms/audit/AuditLog";

export const metadata = { title: "Registro attività" };

export default function AuditPage() {
  return <AuditLog />;
}
