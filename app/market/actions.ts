"use server";

import { revalidatePath } from "next/cache";
import {
  createEducationalPriceAlert,
  deleteEducationalAlert,
  isLearningMarketSymbol,
  setEducationalAlertEnabled,
  setWatchlistMembership,
} from "../../db/market-watchlist";
import { requireUser } from "../auth/session";

const MAX_THRESHOLD = 1_000_000_000;

export async function updateWatchlist(
  formData: FormData,
): Promise<void> {
  const user = await requireUser("/market");
  const marketSymbol = formData.get("marketSymbol");
  const shouldWatch = formData.get("shouldWatch") === "true";

  if (
    typeof marketSymbol !== "string" ||
    !isLearningMarketSymbol(marketSymbol)
  ) {
    throw new Error("Invalid learning market.");
  }

  await setWatchlistMembership(
    user.id,
    marketSymbol,
    shouldWatch,
  );
  revalidatePath("/market");
}

export async function addEducationalAlert(
  formData: FormData,
): Promise<void> {
  const user = await requireUser("/market");
  const marketSymbol = formData.get("marketSymbol");
  const direction = formData.get("direction");
  const rawThreshold = formData.get("threshold");
  const threshold =
    typeof rawThreshold === "string"
      ? Number(rawThreshold)
      : Number.NaN;

  if (
    typeof marketSymbol !== "string" ||
    !isLearningMarketSymbol(marketSymbol)
  ) {
    throw new Error("Invalid learning market.");
  }

  if (direction !== "above" && direction !== "below") {
    throw new Error("Invalid alert direction.");
  }

  if (
    !Number.isFinite(threshold) ||
    threshold <= 0 ||
    threshold > MAX_THRESHOLD
  ) {
    throw new Error("Enter a valid positive reference value.");
  }

  await createEducationalPriceAlert(
    user.id,
    marketSymbol,
    direction,
    threshold,
  );
  revalidatePath("/market");
}

export async function updateEducationalAlert(
  formData: FormData,
): Promise<void> {
  const user = await requireUser("/market");
  const alertId = formData.get("alertId");
  const enabled = formData.get("enabled") === "true";

  if (
    typeof alertId !== "string" ||
    alertId.length < 1 ||
    alertId.length > 100
  ) {
    throw new Error("Invalid educational alert.");
  }

  await setEducationalAlertEnabled(user.id, alertId, enabled);
  revalidatePath("/market");
}

export async function removeEducationalAlert(
  formData: FormData,
): Promise<void> {
  const user = await requireUser("/market");
  const alertId = formData.get("alertId");

  if (
    typeof alertId !== "string" ||
    alertId.length < 1 ||
    alertId.length > 100
  ) {
    throw new Error("Invalid educational alert.");
  }

  await deleteEducationalAlert(user.id, alertId);
  revalidatePath("/market");
}
