import type { ComponentType } from "react";
import { ProvaRapidaPlayer, ProvaRapidaTv } from "./_fixture-prova-rapida";
import type { MechanicUi, PlayerGameProps, TvGameProps } from "./ui-contract";

/**
 * ⚠️ FIXTURE DI SVILUPPO DEL RAMO CORE — il registro vero delle schermate dei minigiochi è del ramo GIOCHI e
 * sostituisce questo file al merge. Qui solo la meccanica di prova «prova-rapida».
 */
export const MECHANIC_UIS: Record<string, MechanicUi> = {
  "prova-rapida": { Player: ProvaRapidaPlayer as ComponentType<PlayerGameProps>, Tv: ProvaRapidaTv as ComponentType<TvGameProps> },
};
