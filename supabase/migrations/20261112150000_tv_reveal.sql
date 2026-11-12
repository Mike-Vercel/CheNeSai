-- ---------------------------------------------------------------------
-- CHE NE SAI?! – TV e telefoni in sincronia.
-- Il TV mostra la domanda dopo il cartello "DOMANDA N. X" e illumina la risposta giusta dopo
-- "La risposta giusta è…": in quei due istanti avvisa il server e i telefoni dei giocatori
-- mostrano domanda e giusto/sbagliato insieme al TV (con un tetto di sicurezza lato telefono se il
-- segnale non arriva). Idempotente.
-- ---------------------------------------------------------------------
alter table public.tv_presence add column if not exists question_shown_id uuid;
alter table public.tv_presence add column if not exists revealed_question_id uuid;
comment on column public.tv_presence.question_shown_id is 'Ultima domanda già comparsa sul TV (dopo il cartello): i telefoni la mostrano insieme';
comment on column public.tv_presence.revealed_question_id is 'Ultima domanda di cui il TV ha già illuminato la risposta giusta (telefoni in sincronia)';
