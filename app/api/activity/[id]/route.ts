import { NextResponse } from "next/server";
import { fetchActivityDetail } from "@/lib/coros";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const sportType = Number(new URL(req.url).searchParams.get("sportType") || "0");
  try {
    const detail = await fetchActivityDetail(params.id, sportType);
    return NextResponse.json(detail);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
