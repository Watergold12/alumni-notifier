-- alumni-notifier/migrations/001_init.sql
CREATE TABLE IF NOT EXISTS alumni (
  id TEXT PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  birthdate TEXT,  -- YYYY-MM-DD
  consent INTEGER
);

CREATE TABLE IF NOT EXISTS deliveries (
  id TEXT PRIMARY KEY,
  alumni_id TEXT,
  channel TEXT,
  provider_response TEXT,
  status TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (alumni_id) REFERENCES alumni(id)
);
