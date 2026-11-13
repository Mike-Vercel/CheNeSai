/** Partita aperta dell'account per «Riprendi» (dati già pronti dal server; nessun codice solo-client qui). */
export interface ShellRoom {
  roomId: string;
  code: string;
  devices: "shared" | "personal";
  players: number;
  roundNo: number;
  phase: string;
  isHost: boolean;
}

export function toShellRoom(r: ShellRoom): ShellRoom {
  return { roomId: r.roomId, code: r.code, devices: r.devices, players: r.players, roundNo: r.roundNo, phase: r.phase, isHost: r.isHost };
}

export const roomHref = (r: Pick<ShellRoom, "roomId" | "devices">) => (r.devices === "shared" ? `/giramente/un-dispositivo/${r.roomId}` : `/giramente/stanza/${r.roomId}`);
