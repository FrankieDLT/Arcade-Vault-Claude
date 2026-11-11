-- SPEC 26 step 1: trademark renames, titles and text only (ids change in rename_games_trademark).
update public.games set title = 'SPACE VOYAGE'  where id = 'asteroids';
update public.games set title = 'BLOCK RAIN'    where id = 'tetris';
update public.games set title = 'WALL WRECKER'  where id = 'arkanoid';
update public.games set title = 'STREET JUMPER' where id = 'frogger';
update public.games set title = 'SUPER TENNIS'  where id = 'pong';
update public.games set title = 'ALIEN ATTACK',
  "long" = 'A fleet of aliens marches down the screen, faster with every ship you destroy. Move your cannon, shoot them one by one and dodge their bombs. Clear the wave to face a faster one. If they land, it is over.'
  where id = 'space-invaders';
