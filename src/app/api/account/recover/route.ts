import { NextResponse } from "next/server";

import { fieldErrors, phoneSchema } from "@/lib/validation";
import { getBuyerSession } from "@/server/admin-session";
import { upsertPassWallet } from "@/server/pass-wallet";
import { hydrateStore, recoverPaidPass } from "@/server/store";
import { z } from "zod";

export const runtime = "nodejs";

const recoverSchema = z.object({
  phone: phoneSchema,
  passCode: z
    .string()
    .trim()
    .transform((value) => value.replace(/\D/g, ""))
    .pipe(z.string().regex(/^\d{6}$/, "That's the 6-digit door code from the pass email")),
  reference: z
    .string()
    .trim()
    .optional()
    .transform((value) => {
      const next = value?.toUpperCase();
      return next ? next : undefined;
    })
    .refine((value) => !value || /^UTP-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(value), {
      message: "That's the UTP-XXXX-XXXX reference",
    }),
  name: z.string().trim().max(80).optional(),
});

export async function POST(request: Request) {
  await hydrateStore();
  const session = await getBuyerSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const parsed = recoverSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check the door code and phone.", fields: fieldErrors(parsed.error) },
      { status: 422 },
    );
  }

  const result = recoverPaidPass({
    email: session.email,
    phone: parsed.data.phone,
    passCode: parsed.data.passCode,
    reference: parsed.data.reference,
    name: parsed.data.name,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: "That door code doesn't match this email and phone." },
      { status: 400 },
    );
  }

  await upsertPassWallet(session.email, result.order);
  return NextResponse.json({ ok: true, reference: result.order.reference });
}
