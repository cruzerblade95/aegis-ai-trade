"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "../auth/session";
import {
  isLessonSlug,
  setLessonCompletion,
} from "../../db/learning-progress";

export async function updateLessonProgress(
  formData: FormData,
): Promise<void> {
  const user = await requireUser("/progress");

  const lessonSlug = formData.get("lessonSlug");
  const completedValue = formData.get("completed");

  if (
    typeof lessonSlug !== "string" ||
    !isLessonSlug(lessonSlug)
  ) {
    throw new Error("Invalid lesson.");
  }

  const completed = completedValue === "true";

  await setLessonCompletion(
    user.id,
    lessonSlug,
    completed,
  );

  revalidatePath("/progress");
    revalidatePath("/dashboard");
    revalidatePath("/market");
    revalidatePath("/risk");
}