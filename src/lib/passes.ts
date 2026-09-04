export type PassId = "early" | "vip";

export type PassTier = {
  id: PassId;
  index: string;
  name: string;
  subtitle: string;
  price: number;
  badge?: string;
  blurb: string;
  perks: string[];
  notIncluded: string;
  accent: string;
  accentSoft: string;
};

export const PASSES: PassTier[] = [
  {
    id: "early",
    index: "01",
    name: "STANDARD",
    subtitle: "General entry",
    price: 1249,
    badge: "CHEAPEST IT WILL EVER BE",
    blurb:
      "The whole party, none of the frills. Five hours on the floor, food and mocktails you don't have to keep paying for.",
    perks: [
      "Entry from 12:00 PM, stay till they switch the lights on",
      "Unlimited food — actual food, not two nachos and a prayer",
      "Unlimited mocktails, refilled until you're bored of them",
      "Live DJ, full rig, lasers doing their thing",
      "Free cloakroom so you're not dancing with a backpack",
    ],
    notIncluded: "No table, no queue-skip. You'll survive.",
    accent: "#7d8bff",
    accentSoft: "rgba(125, 139, 255, 0.42)",
  },
  {
    id: "vip",
    index: "02",
    name: "VIP",
    subtitle: "Lounge + table",
    price: 1549,
    badge: "₹300 MORE. WORTH IT.",
    blurb:
      "Everything in Standard, plus somewhere to sit, someone to bring it over, and no standing in the sun waiting to get in.",
    perks: [
      "Everything in the Standard pass",
      "Skip the queue — walk past everyone, don't make eye contact",
      "Private lounge with a table that is actually yours",
      "Table service, so nobody has to volunteer as drink runner",
      "A bouncer looking after the section (and your bag)",
      "One song request to the DJ. One. Choose carefully.",
    ],
    notIncluded: "Still no alcohol. We're not negotiating.",
    accent: "#ff3b3b",
    accentSoft: "rgba(255, 59, 59, 0.38)",
  },
];

export const MAX_QUANTITY = 8;

export const DEFAULT_PASS_PRICES: Record<PassId, number> = {
  early: 1249,
  vip: 1549,
};

export type PassPriceTable = Record<PassId, number>;

export function catalogWithPrices(prices: PassPriceTable): PassTier[] {
  const early = prices.early ?? DEFAULT_PASS_PRICES.early;
  const vip = prices.vip ?? DEFAULT_PASS_PRICES.vip;
  return PASSES.map((pass) => {
    const price = pass.id === "vip" ? vip : early;
    if (pass.id === "vip") {
      const extra = vip - early;
      return {
        ...pass,
        price,
        badge: extra > 0 ? `₹${extra.toLocaleString("en-IN")} MORE. WORTH IT.` : undefined,
      };
    }
    return { ...pass, price };
  });
}

export function getPassById(id: PassId, prices?: PassPriceTable): PassTier {
  const catalog = prices ? catalogWithPrices(prices) : PASSES;
  return catalog.find((pass) => pass.id === id) ?? catalog[0];
}

export function isPassId(value: string): value is PassId {
  return PASSES.some((pass) => pass.id === value);
}
