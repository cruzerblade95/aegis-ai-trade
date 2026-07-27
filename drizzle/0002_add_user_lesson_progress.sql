CREATE TABLE IF NOT EXISTS user_lesson_progress (
  user_id TEXT NOT NULL,
  lesson_slug TEXT NOT NULL,
  completed_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, lesson_slug),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_lesson_progress_user
ON user_lesson_progress(user_id);