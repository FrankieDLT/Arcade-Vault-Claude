-- SPEC 26 follow-up: two pins become generic (Spring Pad and Rain Cloud). Number, game and rarity stay.
alter table public.user_pins drop constraint user_pins_pin_id_fkey;
update public.user_pins set pin_id = 'robo-vault-four-leaf-clover' where pin_id = 'robo-vault-spring-pad';
update public.user_pins set pin_id = 'block-rain-rainbow' where pin_id = 'block-rain-rain-cloud';
update public.pins set id = 'robo-vault-four-leaf-clover', name = 'Four-Leaf Clover' where id = 'robo-vault-spring-pad';
update public.pins set id = 'block-rain-rainbow', name = 'Rainbow' where id = 'block-rain-rain-cloud';
alter table public.user_pins add constraint user_pins_pin_id_fkey foreign key (pin_id) references public.pins(id);
