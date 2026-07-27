import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      {
        authenticated: false,
        user: null,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  return NextResponse.json(
    {
      authenticated: true,
      user: {
        displayName: user.displayName,
        email: user.email,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}