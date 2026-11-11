import type { Metadata } from "next";
import { ConfirmProvider, ToastProvider } from "@/components/ui";

export const metadata: Metadata = { title: "Regia" };

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="qz-admin min-h-dvh text-white">
      <ToastProvider>
        <ConfirmProvider>{children}</ConfirmProvider>
      </ToastProvider>
    </div>
  );
}
