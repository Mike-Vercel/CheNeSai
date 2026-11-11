"use client";

import dynamic from "next/dynamic";
import type { ProfessorePreviewProps } from "./ProfessorePreviewCanvas";

const ProfessorePreviewCanvas = dynamic(() => import("./ProfessorePreviewCanvas"), {
  ssr: false,
  loading: () => <div style={{ position: "fixed", inset: 0, background: "#170824" }} />,
});

export function ProfessorePreview(props: ProfessorePreviewProps) {
  return <ProfessorePreviewCanvas {...props} />;
}
