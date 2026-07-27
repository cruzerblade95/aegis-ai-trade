import { NextResponse } from "next/server";
import {
  AuthenticationError,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
  signInUser,
} from "../../../../db/auth";

export const runtime = "edge";

type SignInBody = {
  email?: unknown;
  password?: unknown;
};

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  }

  try {
    const body = (await request.json()) as SignInBody;

    if (
      typeof body.email !== "string" ||
      typeof body.password !== "string"
    ) {
      return NextResponse.json(
        { error: "Enter your email and password." },
        { status: 400 },
      );
    }

    const result = await signInUser({
      email: body.email,
      password: body.password,
    });

    const response = NextResponse.json({
      user: result.user,
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: result.sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_SECONDS,
    });

    return response;
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { error: error.message },
        {
          status:
            error.code === "ACCOUNT_DISABLED" ? 403 : 401,
        },
      );
    }

    console.error("Sign-in failed", error);

    return NextResponse.json(
      { error: "Unable to sign in." },
      { status: 500 },
    );
  }
}

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");

  if (!origin) {
    return true;
  }

  return origin === new URL(request.url).origin;
}