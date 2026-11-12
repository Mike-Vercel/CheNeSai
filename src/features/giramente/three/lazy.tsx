"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { GiramenteCharacterProps, JollyPortalProps } from "./types";
import type { GiramenteWheelFullProps } from "./GiramenteWheel";

/**
 * Componenti visivi caricati a richiesta e solo nel browser: three.js e i modelli non entrano nel bundle
 * delle pagine finché non servono (la ruota 2D e il ritratto 2D non scaricano three.js).
 */
export const GiramenteWheel: ComponentType<GiramenteWheelFullProps> = dynamic(() => import("./GiramenteWheel"), { ssr: false });
export const GiramenteCharacter: ComponentType<GiramenteCharacterProps> = dynamic(() => import("./GiramenteCharacter"), { ssr: false });
export const JollyPortal: ComponentType<JollyPortalProps> = dynamic(() => import("./JollyPortal"), { ssr: false });
