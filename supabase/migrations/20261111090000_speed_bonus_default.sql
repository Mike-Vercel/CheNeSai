-- CHE NE SAI?! – la velocità conta: bonus velocità attivo di default nei nuovi round
-- (chi risponde giusto prima prende più punti; 0 = disattivato, regolabile per round nell'editor).
alter table public.game_rounds alter column speed_bonus_max set default 500;
