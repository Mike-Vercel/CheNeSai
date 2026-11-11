import { Suspense } from "react";
import { LoginForm } from "@/features/admin/LoginForm";

export const metadata = { title: "Accesso regia" };

export default function LoginPage() {
  return (
    <main className="qz-stage relative grid min-h-dvh place-items-center p-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
