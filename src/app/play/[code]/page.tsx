import { notFound } from "next/navigation";
import { PlayerClient } from "@/features/players/PlayerClient";

export const metadata = { title: "Gioca" };

export default async function PlayPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ slot?: string }> }) {
  const { code } = await params;
  const { slot } = await searchParams;
  if (!/^[A-Za-z0-9]{4,8}$/.test(code)) notFound();
  return <PlayerClient code={code.toUpperCase()} slot={slot && /^[a-z0-9]{1,8}$/.test(slot) ? slot : null} />;
}
