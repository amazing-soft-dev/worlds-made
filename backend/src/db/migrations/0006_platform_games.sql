-- Daily challenge games belong to the platform, not to a player: a null owner means "Worlds Made".
-- Player-facing rules are unchanged: every player-created game still has an owner, and RLS only exposes
-- a game to its owner or, once published, to everyone.

alter table games alter column owner_id drop not null;
