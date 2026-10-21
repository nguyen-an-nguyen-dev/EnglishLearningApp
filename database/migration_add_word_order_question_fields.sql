ALTER TABLE questions
  ADD COLUMN audio_url VARCHAR(2048) NULL AFTER explanation,
  ADD COLUMN word_bank JSON NULL AFTER audio_url;
