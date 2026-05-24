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
      { error: (e as Error).message || "Failed to load COROS data" },
      { status: 500 },
    );
  }
}
