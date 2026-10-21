USE english_learning;

SET @translation_schema = DATABASE();

SET @translation_sql = IF(
  NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @translation_schema AND TABLE_NAME = 'translations' AND COLUMN_NAME = 'original_text'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @translation_schema AND TABLE_NAME = 'translations' AND COLUMN_NAME = 'source_text'
  ),
  'ALTER TABLE translations CHANGE COLUMN source_text original_text TEXT NOT NULL',
  'SELECT 1'
);
PREPARE translation_statement FROM @translation_sql;
EXECUTE translation_statement;
DEALLOCATE PREPARE translation_statement;

SET @translation_sql = IF(
  NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @translation_schema AND TABLE_NAME = 'translations' AND COLUMN_NAME = 'file_name'
  ),
  'ALTER TABLE translations ADD COLUMN file_name VARCHAR(255) NULL AFTER user_id',
  'SELECT 1'
);
PREPARE translation_statement FROM @translation_sql;
EXECUTE translation_statement;
DEALLOCATE PREPARE translation_statement;
