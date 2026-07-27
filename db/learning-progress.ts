import { env } from "cloudflare:workers";

export const lessonCatalog = [
  {
    slug: "market-basics",
    title: "Fictional market basics",
    description:
      "Learn how reference values, percentage changes, and fictional market categories are displayed.",
    href: "/market",
  },
  {
    slug: "diversification",
    title: "Diversification",
    description:
      "Compare concentrated and diversified fictional allocations.",
    href: "/risk",
  },
  {
    slug: "volatility",
    title: "Volatility and limits",
    description:
      "Understand fictional price movement and predefined simulation boundaries.",
    href: "/risk",
  },
] as const;

export type LessonSlug =
  (typeof lessonCatalog)[number]["slug"];

export type LessonProgress = {
  slug: LessonSlug;
  title: string;
  description: string;
  href: string;
  completed: boolean;
  completedAt: number | null;
};

type ProgressRow = {
  lesson_slug: string;
  completed_at: number;
};

export function isLessonSlug(
  value: string,
): value is LessonSlug {
  return lessonCatalog.some(
    (lesson) => lesson.slug === value,
  );
}

export async function getLearningProgress(
  userId: string,
): Promise<LessonProgress[]> {
  const database = getDatabase();

  const result = await database
    .prepare(
      `
        SELECT lesson_slug, completed_at
        FROM user_lesson_progress
        WHERE user_id = ?
        ORDER BY completed_at DESC
      `,
    )
    .bind(userId)
    .all<ProgressRow>();

  const completedLessons = new Map(
    result.results.map((row) => [
      row.lesson_slug,
      row.completed_at,
    ]),
  );

  return lessonCatalog.map((lesson) => ({
    ...lesson,
    completed: completedLessons.has(lesson.slug),
    completedAt:
      completedLessons.get(lesson.slug) ?? null,
  }));
}

export async function setLessonCompletion(
  userId: string,
  lessonSlug: LessonSlug,
  completed: boolean,
): Promise<void> {
  const database = getDatabase();

  if (completed) {
    await database
      .prepare(
        `
          INSERT INTO user_lesson_progress (
            user_id,
            lesson_slug,
            completed_at
          )
          VALUES (?, ?, ?)
          ON CONFLICT(user_id, lesson_slug)
          DO UPDATE SET completed_at = excluded.completed_at
        `,
      )
      .bind(userId, lessonSlug, Date.now())
      .run();

    return;
  }

  await database
    .prepare(
      `
        DELETE FROM user_lesson_progress
        WHERE user_id = ? AND lesson_slug = ?
      `,
    )
    .bind(userId, lessonSlug)
    .run();
}

function getDatabase(): D1Database {
  return env.DB;
}