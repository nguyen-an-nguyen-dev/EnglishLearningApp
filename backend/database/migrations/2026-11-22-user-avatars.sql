-- Apply once to an existing database; fresh installs already have these fields in init.sql.
ALTER TABLE users
  ADD COLUMN avatar_url varchar(500) DEFAULT NULL AFTER display_name,
  ADD COLUMN avatar_public_id varchar(255) DEFAULT NULL AFTER avatar_url;
