import { NextResponse } from "next/server";
import { getTeslaConfig, isTeslaConfigured } from "../../../../lib/tesla/config";

export const dynamic = "force-dynamic";
export async function GET() {
  const config = getTeslaConfig();
  return NextResponse.json({ configured: isTeslaConfigured(), region: config.region, authentication: "not_connected" }, { headers: { "Cache-Control": "no-store" } });
}
