-- Apply to existing databases before creating speaking questions.
ALTER TABLE `questions`
  ADD CONSTRAINT `chk_questions_type` CHECK (`question_type` IN ('multiple_choice', 'fill_choice', 'listen_choice', 'word_order', 'listening', 'fill_blank', 'translate', 'speaking'));
