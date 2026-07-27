import type { LessonSlug } from "../../db/learning-progress";
import { updateLessonProgress } from "../progress/actions";

type LessonCompletionFormProps = {
  lessonSlug: LessonSlug;
  completed: boolean;
};

export function LessonCompletionForm({
  lessonSlug,
  completed,
}: LessonCompletionFormProps) {
  return (
    <form action={updateLessonProgress}>
      <input
        name="lessonSlug"
        type="hidden"
        value={lessonSlug}
      />

      <input
        name="completed"
        type="hidden"
        value={completed ? "false" : "true"}
      />

      <button
        className={
          completed
            ? "lesson-inline-button lesson-inline-button-completed"
            : "lesson-inline-button"
        }
        type="submit"
      >
        {completed ? "Mark incomplete" : "Mark lesson complete"}
      </button>
    </form>
  );
}