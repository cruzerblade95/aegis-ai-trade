"use server";

import { revalidatePath } from "next/cache";
import {
  createEducationalPriceAlert,
  deleteEducationalAlert,
  isLearningMarketSymbol,
  setEducationalAlertEnabled,
  setWatchlistMembership,
} from "../../db/market-watchlist";
import {
  createLearningJournalEntry,
  deleteLearningJournalEntry,
  isLearningJournalTimeframe,
  updateLearningJournalEntry,
} from "../../db/learning-journal";
import { requireUser } from "../auth/session";

const MAX_THRESHOLD = 1_000_000_000;
const MAX_TITLE_LENGTH = 100;
const MAX_NOTE_LENGTH = 2_000;

function readRequiredText(
  formData: FormData,
  field: string,
  maxLength: number,
): string {
  const value = formData.get(field);

  if (typeof value !== "string") {
    throw new Error(`Invalid ${field}.`);
  }

  const normalized = value.trim();

  if (normalized.length < 1 || normalized.length > maxLength) {
    throw new Error(`Invalid ${field}.`);
  }

  return normalized;
}

function readOptionalText(
  formData: FormData,
  field: string,
  maxLength: number,
): string | null {
  const value = formData.get(field);

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  if (normalized.length > maxLength) {
    throw new Error(`Invalid ${field}.`);
  }

  return normalized || null;
}

function readJournalEntry(formData: FormData) {
  const marketSymbol = formData.get("marketSymbol");
  const timeframe = formData.get("timeframe");

  if (
    typeof marketSymbol !== "string" ||
    !isLearningMarketSymbol(marketSymbol)
  ) {
    throw new Error("Invalid learning market.");
  }

  if (
    typeof timeframe !== "string" ||
    !isLearningJournalTimeframe(timeframe)
  ) {
    throw new Error("Invalid learning timeframe.");
  }

  return {
    marketSymbol,
    timeframe,
    title: readRequiredText(
      formData,
      "title",
      MAX_TITLE_LENGTH,
    ),
    observation: readRequiredText(
      formData,
      "observation",
      MAX_NOTE_LENGTH,
    ),
    riskNotes: readRequiredText(
      formData,
      "riskNotes",
      MAX_NOTE_LENGTH,
    ),
    reflection: readOptionalText(
      formData,
      "reflection",
      MAX_NOTE_LENGTH,
    ),
  };
}

function readEntryId(formData: FormData): string {
  const entryId = formData.get("entryId");

  if (
    typeof entryId !== "string" ||
    entryId.length < 1 ||
    entryId.length > 100
  ) {
    throw new Error("Invalid learning-journal entry.");
  }

  return entryId;
}

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

export async function addLearningJournalEntry(
  formData: FormData,
): Promise<void> {
  const user = await requireUser("/market");
  await createLearningJournalEntry(
    user.id,
    readJournalEntry(formData),
  );
  revalidatePath("/market");
}

export async function editLearningJournalEntry(
  formData: FormData,
): Promise<void> {
  const user = await requireUser("/market");
  const entryId = readEntryId(formData);

  await updateLearningJournalEntry(
    user.id,
    entryId,
    readJournalEntry(formData),
  );
  revalidatePath("/market");
}

export async function removeLearningJournalEntry(
  formData: FormData,
): Promise<void> {
  const user = await requireUser("/market");
  await deleteLearningJournalEntry(
    user.id,
    readEntryId(formData),
  );
  revalidatePath("/market");
}
