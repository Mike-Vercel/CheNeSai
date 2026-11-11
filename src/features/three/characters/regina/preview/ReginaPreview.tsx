"use client";

import dynamic from "next/dynamic";
import type { ReginaPreviewProps } from "./ReginaPreviewCanvas";

const ReginaPreviewCanvas = dynamic(() => import("./ReginaPreviewCanvas"), {
  ssr: false,
  loading: () => (
    <div style={{ position: "fixed", inset: 0, background: "#170824", color: "#f6d27a", display: "grid", placeItems: "center", fontFamily: "sans-serif" }}>
      Caricamento della Regina…
    </div>
  ),
});

export function ReginaPreview(props: ReginaPreviewProps) {
  return <ReginaPreviewCanvas {...props} />;
}
