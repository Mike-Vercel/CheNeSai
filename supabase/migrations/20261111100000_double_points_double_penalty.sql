-- CHE NE SAI?! – PUNTI DOPPI vale per tutti e due i versi: risposta giusta ×2 e risposta sbagliata ×2.
update public.special_event_definitions
set params = params || '{"wrongMultiplier": 2}'::jsonb,
    description = 'Risposta giusta e risposta sbagliata valgono il doppio.',
    tagline = 'Questa domanda vale il doppio… anche gli errori! Doppio gusto, doppio rischio!'
where key = 'double-points';
