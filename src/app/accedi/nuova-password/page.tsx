import type { Viewport } from "next";
import { AuthShell } from "@/features/account/AuthShell";
import { NewPasswordForm } from "@/features/account/NewPasswordForm";

export const metadata = { title: "Nuova password" };
export const viewport: Viewport = { themeColor: "#000000" };

export default function NuovaPasswordPage() {
  return (
    <AuthShell>
      <NewPasswordForm />
    </AuthShell>
  );
}
