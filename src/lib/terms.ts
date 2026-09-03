import { EVENT } from "./event";

export type TermsSection = {
  title: string;
  body: string;
};

export const TERMS_SECTIONS: TermsSection[] = [
  {
    title: "Zero Tolerance Policy",
    body: "UTOPIA has a zero-substance policy: no alcohol, no vaping, and no drugs. Pocket and bag checks are performed at entry. Any guest found in violation will be immediately removed.",
  },
  {
    title: "Teen-Only Entry",
    body: "Strict age boundaries apply and valid identification may be checked at entry.",
  },
  {
    title: "Code of Conduct",
    body: "Respect everyone's boundaries. Harassment of any kind will not be tolerated.",
  },
  {
    title: "Security & Safety",
    body: "Follow security staff instructions immediately. Non-compliance means ejection.",
  },
  {
    title: "Entry & Exit",
    body: "No re-entry after leaving. Once your pass is scanned, you cannot return.",
  },
  {
    title: "Policy Violations",
    body: "Violations result in immediate removal and pass revocation without refund.",
  },
  {
    title: "Non-Refundable Passes",
    body: "Passes are not refundable once reserved. If you cannot make it, AVION staff can transfer a pass to someone else — unofficial resale is not recognised at the door.",
  },
  {
    title: "One Pass, One Person",
    body: "Each QR and door code is for one guest. If you buy two or more passes, each person gets their own code. Sharing one QR so two people enter will fail at the door.",
  },
  {
    title: "Bag Search",
    body: "Pocket and bag checks are performed at entry. Alcohol, vapes, drugs, or anything that breaks house rules is confiscated and you do not come in.",
  },
  {
    title: "Food & Mocktails",
    body: "Unlimited food and mocktails are included with every pass. Nothing alcoholic is served, sold, or allowed in.",
  },
  {
    title: "Photography & Content",
    body: "The floor will be photographed and filmed. Being inside is consent for crowd and atmosphere shots. We will not sell close-up portraits of you.",
  },
  {
    title: "Transfers",
    body: "Name changes go through AVION staff only, up to 48 hours before doors, and only if that pass has not already been scanned.",
  },
  {
    title: "Right of Admission",
    body: "We can refuse or revoke entry at any time for safety, capacity, or policy reasons. A revoked pass is not refunded.",
  },
  {
    title: "Contact",
    body: `Questions before the event: ${EVENT.email}. Bring the QR from your email or the MY PASSES page — screenshots of someone else's pass will not get you in.`,
  },
];
