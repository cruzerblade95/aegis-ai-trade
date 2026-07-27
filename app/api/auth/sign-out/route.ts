import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  deleteSession,
  SESSION_COOKIE_NAME,
} from "../../../../db/auth";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  }

  const token =
    request.cookies.get(SESSION_COOKIE_NAME)?.value ?? "";

  await deleteSession(token);

  const response = NextResponse.json({
    success: true,
  });

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");

  if (!origin) {
    return true;
  }

  return origin === new URL(request.url).origin;
}