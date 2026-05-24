import { NextResponse } from "next/server";
import { getSummary } from "@/lib/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const force = new URL(req.url).searchParams.get("refresh") === "1";
  try {
    const summary = await getSummary(force);
    return NextResponse.json(summary);
  } catch (e) {
    return NextResponse.json(
      {
        error:
          "Couldn't load your COROS data. Double-check COROS_EMAIL, COROS_PASSWORD and COROS_REGION in your .env.local, then try again.",
        detail: (e as Error).message || "unknown error",
      },
      { status: 500 },
    );
  }
}
