-- SPEC 19: remove the 8 mock (fake simulation) games and their test scores.
delete from public.scores
 where game_id in ('brick-buster','drop','serpentine','chomper','invaders','rocks','hopper','pixel-duel');
delete from public.games
 where id in ('brick-buster','drop','serpentine','chomper','invaders','rocks','hopper','pixel-duel');
