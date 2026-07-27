import { NextResponse } from "next/server";
import {
  AuthenticationError,
  registerUser,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
} from "../../../../db/auth";

export const runtime = "edge";

type RegisterBody = {
  displayName?: unknown;
  email?: unknown;
  password?: unknown;
  confirmPassword?: unknown;
};

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  }

  try {
    const body = (await request.json()) as RegisterBody;

    if (
      typeof body.displayName !== "string" ||
      typeof body.email !== "string" ||
      typeof body.password !== "string" ||
      typeof body.confirmPassword !== "string"
    ) {
      return NextResponse.json(
        { error: "Complete all required fields." },
        { status: 400 },
      );
    }

    if (body.password !== body.confirmPassword) {
      return NextResponse.json(
        { error: "The passwords do not match." },
        { status: 400 },
      );
    }

    const result = await registerUser({
      displayName: body.displayName,
      email: body.email,
      password: body.password,
    });

    const response = NextResponse.json(
      { user: result.user },
      { status: 201 },
    );

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
            error.code === "EMAIL_EXISTS" ? 409 : 400,
        },
      );
    }

    if (error instanceof TypeError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 },
      );
    }

    console.error("Registration failed", error);

    return NextResponse.json(
      { error: "Unable to create the account." },
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