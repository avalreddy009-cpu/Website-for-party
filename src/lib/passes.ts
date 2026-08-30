export type PassId = "general" | "vip" | "underground";

export type PassTier = {
  id: PassId;
  index: string;
  name: string;
  subtitle: string;
  price: number;
  strikePrice?: number;
  badge?: string;
  blurb: string;
  perks: string[];
  capacity: string;
  accent: string;
  accentSoft: string;
};

export const PASSES: PassTier[] = [
  {
    id: "general",
    index: "01",
    name: "GENERAL ENTRY",
    subtitle: "THE FLOOR",
    price: 899,
    strikePrice: 1199,
    blurb:
      "Get in, get lost. Full access to the main floor and every drop from noon to five.",
    perks: [
      "Full entry access · 12:00 PM — 5:00 PM",
      "Main floor + open-air sound stage",
      "Welcome shot on arrival",
      "Access to food & drink counters (pay as you go)",
      "Cloakroom + free hydration bar",
    ],
    capacity: "420 PASSES RELEASED",
    accent: "#3d82ff",
    accentSoft: "rgba(61, 130, 255, 0.45)",
  },
  {
    id: "vip",
    index: "02",
    name: "VIP ACCESS",
    subtitle: "THE ELEVATED DECK",
    price: 2199,
    strikePrice: 2799,
    badge: "MOST WANTED",
    blurb:
      "Skip the line, take the deck. Elevated views, faster bar, and a curated plate.",
    perks: [
      "Fast-track entry · zero queue",
      "Elevated VIP deck overlooking the floor",
      "2 premium drinks + curated food platter",
      "Dedicated express bar & washrooms",
      "UTOPIA enamel pin + holographic wristband",
      "Priority re-entry all afternoon",
    ],
    capacity: "140 PASSES RELEASED",
    accent: "#55e6ff",
    accentSoft: "rgba(85, 230, 255, 0.45)",
  },
  {
    id: "underground",
    index: "03",
    name: "UNDERGROUND PASS",
    subtitle: "THE DJ ZONE",
    price: 3999,
    badge: "ONLY 60 LEFT",
    blurb:
      "Behind the decks with the artists. The pass for the right people — nothing held back.",
    perks: [
      "DJ zone + booth-side access during sets",
      "Unlimited food & bar, all five hours",
      "Exclusive UTOPIA merch drop (tee + tote)",
      "Artist meet & greet between sets",
      "Invite to the undisclosed afterparty",
      "Personal host + private entrance",
    ],
    capacity: "60 PASSES RELEASED",
    accent: "#6b3bff",
    accentSoft: "rgba(107, 59, 255, 0.5)",
  },
];

export const BOOKING_FEE_RATE = 0.07;

export function getPassById(id: PassId): PassTier {
  return PASSES.find((pass) => pass.id === id) ?? PASSES[0];
}
