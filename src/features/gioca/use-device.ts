"use client";

import { useSyncExternalStore } from "react";
import { detectDevice, type DeviceKind } from "./device-mode";

const noop = () => () => {};

/** Telefono/tablet o computer (sul server e prima dell'idratazione: "desktop"). */
export function useDeviceKind(): DeviceKind {
  return useSyncExternalStore(noop, detectDevice, () => "desktop" as const);
}
