# Backend

## Talk with AI

Run `database/migration_add_ai_talk.sql` once against an existing `english_learning` database before deploying the updated backend. Fresh installations can use `database/schema.sql`.

For text and `.txt` translation history on an existing database, also run `database/migration_add_translation_file_name.sql` once. Fresh installations already have the required column in `database/schema.sql`.

Configure the provider only in the backend environment:

```dotenv
AI_API_KEY=your-provider-key
AI_API_URL=https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
AI_MODEL=gemini-3.8-flash
AI_TIMEOUT_MS=30000
```

`AI_API_URL`, `AI_MODEL`, and `AI_TIMEOUT_MS` are optional. Gemini is the default provider. The API key is never read by or sent to the mobile app. The backend sends short conversation history and learner progress/mistake summaries to the configured OpenAI-compatible chat-completions endpoint.

## Listening questions

Listening questions use the existing `questions.audio_url` and `answers` columns; no database migration is required. Upload the audio file (MP3 or M4A) to the `english-media` Supabase Storage bucket and make the bucket public so the mobile audio player can download it. Keep the Supabase secret key on the backend only; this feature does not send or require it in the mobile app.

Configure the backend environment with the project URL and bucket name. A project URL ending in `/rest/v1/` is accepted and normalized automatically:

```dotenv
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_BUCKET=english-media
SUPABASE_SECRET_KEY=your-supabase-secret-key
```

`SUPABASE_SECRET_KEY` stays on the backend only. The mobile app plays public Storage URLs returned by the API.

Create a question with `question_type = 'listening'`. Put the storage object path (for example, `listening/hello-how-are-you.wav`) in `audio_url`; the API returns its public Storage URL. A complete public URL can also be stored there. Add the correct transcript to `answers` with `is_correct = TRUE` and optional Vietnamese meaning to `questions.explanation`.

`database/seed.sql` inserts three listening questions in Greetings, Introductions, and Food. Re-run the seed after uploading matching files to `english-media/listening/`.

For example, after replacing the lesson ID, audio path, and sort order with values for your lesson (the sort order must be unused):

```sql
INSERT INTO questions
  (lesson_id, question_text, question_type, explanation, audio_url, difficulty, sort_order)
VALUES
  (1, 'Nghe đoạn âm thanh và nhập lại nội dung bạn nghe được.', 'listening',
   'Xin chào, bạn khỏe không?', 'listening/greetings-01.mp3', 'beginner', 99);

SET @listening_question_id = LAST_INSERT_ID();

INSERT INTO answers (question_id, answer_text, is_correct, sort_order)
VALUES (@listening_question_id, 'Hello, how are you?', TRUE, 1);
```
