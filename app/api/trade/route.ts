import { NextResponse } from "next/server";
import {
  createLearningJournalEntry,
  deleteLearningJournalEntry,
  isLearningJournalTimeframe,
} from "../../../db/learning-journal";
import {
  cancelVirtualOrder,
  closeVirtualPosition,
  getVirtualTradingState,
  placeVirtualOrder,
  syncVirtualLimitOrders,
  VirtualTradingError,
} from "../../../db/virtual-trading";
import { isMarketSymbol } from "../../../lib/market-data";
import { getCurrentUser } from "../../auth/session";

export const dynamic = "force-dynamic";

type TradeRequest = {
  action?: unknown;
  marketSymbol?: unknown;
  side?: unknown;
  orderType?: unknown;
  quantity?: unknown;
  limitPrice?: unknown;
  orderId?: unknown;
  timeframe?: unknown;
  title?: unknown;
  observation?: unknown;
  riskNotes?: unknown;
};

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Sign in to use virtual trading." },
      { status: 401 },
    );
  }

  return NextResponse.json(await getVirtualTradingState(user.id), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  }

  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Sign in to use virtual trading." },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json()) as TradeRequest;

    switch (body.action) {
      case "place":
        await placeVirtualOrder(user.id, {
          marketSymbol: readString(body.marketSymbol),
          side: readString(body.side),
          orderType: readString(body.orderType),
          quantity: Number(body.quantity),
          limitPrice:
            body.limitPrice === null ||
            body.limitPrice === undefined ||
            body.limitPrice === ""
              ? null
              : Number(body.limitPrice),
        });
        break;

      case "cancel":
        await cancelVirtualOrder(
          user.id,
          readString(body.orderId),
        );
        break;

      case "close":
        await closeVirtualPosition(
          user.id,
          readString(body.marketSymbol),
        );
        break;

      case "sync":
        await syncVirtualLimitOrders(user.id);
        break;

      case "journal-create":
        await createJournal(user.id, body);
        break;

      case "journal-delete":
        await deleteLearningJournalEntry(
          user.id,
          readString(body.orderId),
        );
        break;

      default:
        throw new VirtualTradingError(
          "Unsupported virtual trading action.",
        );
    }

    return NextResponse.json(
      await getVirtualTradingState(user.id),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof VirtualTradingError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    if (error instanceof TypeError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 },
      );
    }

    console.error("Virtual trading request failed", error);

    return NextResponse.json(
      { error: "Unable to complete the virtual trading request." },
      { status: 500 },
    );
  }
}

async function createJournal(
  userId: string,
  body: TradeRequest,
) {
  const marketSymbol = readString(body.marketSymbol);
  const timeframe = readString(body.timeframe);

  if (!isMarketSymbol(marketSymbol)) {
    throw new VirtualTradingError("Invalid journal market.");
  }

  if (!isLearningJournalTimeframe(timeframe)) {
    throw new VirtualTradingError("Invalid journal timeframe.");
  }

  await createLearningJournalEntry(userId, {
    marketSymbol,
    timeframe,
    title: readBoundedText(body.title, "journal title", 100),
    observation: readBoundedText(
      body.observation,
      "journal observation",
      2_000,
    ),
    riskNotes: readBoundedText(
      body.riskNotes,
      "risk notes",
      2_000,
    ),
    reflection: null,
  });
}

function readString(value: unknown): string {
  if (typeof value !== "string") {
    throw new VirtualTradingError("Invalid request value.");
  }

  return value;
}

function readBoundedText(
  value: unknown,
  field: string,
  maximum: number,
): string {
  const text = readString(value).trim();

  if (!text || text.length > maximum) {
    throw new VirtualTradingError(`Enter valid ${field}.`);
  }

  return text;
}

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");

  return !origin || origin === new URL(request.url).origin;
}
