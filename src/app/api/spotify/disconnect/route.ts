import { NextResponse } from "next/server";
import { clearTokens } from "@/lib/spotify";

export const dynamic = "force-dynamic";

export async function POST() {
  clearTokens();
  return NextResponse.json({ ok: true });
}
