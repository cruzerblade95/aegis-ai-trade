import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  findUserBySession,
  SESSION_COOKIE_NAME,
} from "../../db/auth";

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionToken =
    cookieStore.get(SESSION_COOKIE_NAME)?.value ?? "";

  return findUserBySession(sessionToken);
}

export async function requireUser(
  returnPath = "/dashboard",
) {
  const user = await getCurrentUser();

  if (!user) {
    redirect(
      `/sign-in?next=${encodeURIComponent(returnPath)}`,
    );
  }

  return user;
}