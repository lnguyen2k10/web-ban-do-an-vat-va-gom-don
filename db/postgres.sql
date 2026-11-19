CREATE SCHEMA IF NOT EXISTS lees_shop;

REVOKE ALL ON SCHEMA lees_shop FROM PUBLIC;

CREATE TABLE IF NOT EXISTS lees_shop.shop (
  id integer PRIMARY KEY CHECK (id = 1),
  payload text NOT NULL
);

CREATE TABLE IF NOT EXISTS lees_shop.sessions (
  token text PRIMARY KEY,
  user_id text NOT NULL,
  expiry bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS lees_shop.checkout (
  key text PRIMARY KEY,
  fingerprint text NOT NULL,
  order_ids text NOT NULL
);

CREATE TABLE IF NOT EXISTS lees_shop.notifications (
  id text PRIMARY KEY,
  order_ids text NOT NULL,
  next_try bigint NOT NULL,
  attempts integer NOT NULL
);

CREATE INDEX IF NOT EXISTS notifications_next_try
  ON lees_shop.notifications (next_try);

CREATE INDEX IF NOT EXISTS sessions_expiry
  ON lees_shop.sessions (expiry);

ALTER TABLE lees_shop.shop ENABLE ROW LEVEL SECURITY;
ALTER TABLE lees_shop.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lees_shop.checkout ENABLE ROW LEVEL SECURITY;
ALTER TABLE lees_shop.notifications ENABLE ROW LEVEL SECURITY;
