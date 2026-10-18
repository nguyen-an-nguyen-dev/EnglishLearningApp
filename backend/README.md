# Backend

## Talk with AI

Run `database/migration_add_ai_talk.sql` once against an existing `english_learning` database before deploying the updated backend. Fresh installations can use `database/schema.sql`.

Configure the provider only in the backend environment:

```dotenv
AI_API_KEY=your-provider-key
AI_API_URL=https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
AI_MODEL=gemini-3.8-flash
AI_TIMEOUT_MS=30000
```

`AI_API_URL`, `AI_MODEL`, and `AI_TIMEOUT_MS` are optional. Gemini is the default provider. The API key is never read by or sent to the mobile app. The backend sends short conversation history and learner progress/mistake summaries to the configured OpenAI-compatible chat-completions endpoint.
