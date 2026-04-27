-- The hardcoded `connection_key = 'default'` rows pre-date per-visitor identity.
-- Now that every visitor has their own connection_key (a signed cookie value),
-- the legacy 'default' rows are unreachable. Drop them so the developer can
-- reconnect under their new visitor id from a clean state.
DELETE FROM strava_activities WHERE connection_key = 'default';
DELETE FROM strava_tokens     WHERE connection_key = 'default';
