import { NextResponse } from "next/server";
import { getDataset, resolveDemoPersonas } from "@/lib/data";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

/** The three demo personas (citizen@demo.com / inspector@demo.com / officer@demo.com). */
export async function GET() {
  const data = await getDataset();

  const toPersona = (p: Profile) => ({ id: p.id, name: p.name, role: p.role, email: p.email });
  // Resolution order (see resolveDemoPersonas): @demo.com emails (demo
  // snapshot) → canonical names (live; public.profiles has no email column,
  // and reputation moves with audits so it cannot be the stable anchor) →
  // highest reputation per role (last resort).
  const personas = resolveDemoPersonas(data.profiles).map(toPersona);

  return NextResponse.json({ personas });
}
