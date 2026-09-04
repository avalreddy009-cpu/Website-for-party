import { z } from "zod";

import { cartCount, cartFromUnknown } from "./cart";
import { MAX_QUANTITY, PASSES, type PassId } from "./passes";

const passIds = PASSES.map((pass) => pass.id) as [PassId, ...PassId[]];

export const nameSchema = z
  .string()
  .trim()
  .min(2, "Put in the name you'll show at the gate")
  .max(80, "That's longer than a name needs to be");

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(160, "That email is too long")
  .pipe(z.email("That email doesn't look real — your pass goes there"));

export const phoneSchema = z
  .string()
  .trim()
  .max(24, "That's too many digits")
  .refine((value) => value.replace(/\D/g, "").length >= 10, {
    message: "We need 10 digits, in case we have to find you",
  });

export const buyerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
});

const qtyField = z.coerce.number().int().min(0).max(MAX_QUANTITY);

export const orderIntentSchema = buyerSchema
  .extend({
    passId: z.enum(passIds).optional(),
    quantity: qtyField.optional(),
    early: qtyField.optional(),
    vip: qtyField.optional(),
  })
  .superRefine((data, ctx) => {
    const total = cartCount(cartFromUnknown(data));
    if (total < 1) {
      ctx.addIssue({
        code: "custom",
        message: "You need at least one pass",
        path: ["quantity"],
      });
    }
    if (total > MAX_QUANTITY) {
      ctx.addIssue({
        code: "custom",
        message: `Max ${MAX_QUANTITY} passes per order`,
        path: ["quantity"],
      });
    }
  });

/**
 * Signed tokens are bounded by what we mint, so cap the field. Without a max,
 * a megabyte of junk still gets base64-decoded and HMAC'd before it's rejected.
 */
export const verificationTokenSchema = z
  .string()
  .min(10, "Verify your email first")
  .max(512, "That token isn't valid");

/** Claim tokens carry the whole pass payload, so they run longer than the rest. */
export const passClaimTokenSchema = z.string().min(10).max(8192);

export const confirmCodeSchema = z.object({
  email: emailSchema,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "The code is 6 digits"),
});

export const emailLoginSchema = z.object({
  email: emailSchema,
});

export const reserveSchema = orderIntentSchema.extend({
  verificationToken: verificationTokenSchema,
});

export const phraseLoginSchema = z.object({
  phrase: z
    .string()
    .trim()
    .min(20, "That's 12 words, spaced")
    .max(400, "That's not a 12-word phrase"),
});

export const payProofSchema = z.object({
  email: emailSchema,
  reference: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^UTP-[A-Z0-9]{4}-[A-Z0-9]{4}$/, "That doesn't look like a reservation reference"),
  verificationToken: verificationTokenSchema,
  utr: z
    .string()
    .trim()
    .transform((value) => value.replace(/\D/g, ""))
    .pipe(z.string().regex(/^\d{12}$/, "UTR is the 12-digit number from your UPI app")),
  proofName: z.string().trim().min(1, "Upload the payment screenshot").max(180),
  proofMime: z.literal("image/jpeg"),
  proofData: z
    .string()
    .regex(/^data:image\/jpeg;base64,/, "Upload a screenshot of the payment")
    .max(400_000, "That screenshot is too large. Crop it and try again."),
});

export const scanPayloadSchema = z.object({
  payload: z.string().trim().min(4, "Scan or type the pass").max(800),
});

export const rejectOrderSchema = z.object({
  reason: z.string().trim().max(300).optional(),
});

export const orderIdSchema = z
  .string()
  .trim()
  .min(8, "That order id is too short")
  .max(64, "That order id is too long")
  .regex(/^[A-Za-z0-9_-]+$/, "That order id isn't valid");

export const transferOrderSchema = buyerSchema;

export const refreshHoldSchema = z.object({
  email: emailSchema,
  reference: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^UTP-[A-Z0-9]{4}-[A-Z0-9]{4}$/, "That doesn't look like a reservation reference"),
  verificationToken: verificationTokenSchema,
});

export const passPricesSchema = z.object({
  early: z.coerce
    .number()
    .int("Whole rupees only.")
    .min(1, "Price has to be at least ₹1.")
    .max(99_999, "That price is too high."),
  vip: z.coerce
    .number()
    .int("Whole rupees only.")
    .min(1, "Price has to be at least ₹1.")
    .max(99_999, "That price is too high."),
});

export type BuyerInput = z.infer<typeof buyerSchema>;
export type OrderIntentInput = z.infer<typeof orderIntentSchema>;
export type ReserveInput = z.infer<typeof reserveSchema>;

/** Flattens a Zod error into `{ field: message }` for inline form display. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
