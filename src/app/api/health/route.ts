import { NextResponse } from "next/server";

import { ping } from "@/modules/tenancy/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ping();
    return NextResponse.json({ ok: true, db: true });
  } catch {
    return NextResponse.json({ ok: false, db: false }, { status: 503 });
  }
}
