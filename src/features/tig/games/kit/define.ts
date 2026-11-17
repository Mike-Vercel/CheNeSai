import type { ComponentType } from "react";
import type { MechanicUi, PlayerGameProps, TvGameProps } from "../ui-contract";

/**
 * Registra le due schermate di una meccanica con i loro tipi precisi (vista, vista privata, invio, reveal).
 * Il core passa le viste prodotte dalla stessa meccanica, quindi il restringimento dei tipi è sicuro.
 */
export function defineUi<V, M, S, R>(Player: ComponentType<PlayerGameProps<V, M, S, R>>, Tv: ComponentType<TvGameProps<V, R>>): MechanicUi {
  return { Player: Player as ComponentType<PlayerGameProps>, Tv: Tv as ComponentType<TvGameProps> };
}
