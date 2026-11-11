import { AuthShell } from "@/features/account/AuthShell";
import { NewPasswordForm } from "@/features/account/NewPasswordForm";

export const metadata = { title: "Nuova password" };

export default function NuovaPasswordPage() {
  return (
    <AuthShell>
      <NewPasswordForm />
    </AuthShell>
  );
}
