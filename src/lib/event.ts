export const EVENT = {
  name: "UTOPIA",
  host: "AVION PRODUCTIONS",
  hostShort: "AVION",

  // Straight off the poster.
  tagline: "The party for the right people",
  subTagline: "a state of escape",

  dateLabel: "SUNDAY, SEPTEMBER 27",
  shortDateLabel: "SEP 27",
  dayLabel: "SUNDAY",
  timeLabel: "12:00 PM — 5:00 PM",
  doorsLabel: "Doors at 12. Come early, the good spots go first.",

  venueName: "Ouzo Club and Kitchen",
  venueCity: "Hyderabad",
  venueCode: "HYD",
  timezoneCode: "IST",
  venueLine: "Ouzo Club and Kitchen · Hyderabad",
  mapsUrl: "https://maps.app.goo.gl/2RwwfkFsRRg3G3rJ6",

  // This is a dry day party. It is the whole point, so we say it everywhere.
  policyShort: "Zero alcohol. Not one drop.",
  policyLong:
    "This is a day party built for people who usually get turned away at the door. Nobody is checking whether you're old enough to drink, because nobody is drinking.",

  email: "passes@avionproductions.in",
  instagram: "https://www.instagram.com/avion.prod._/",

  holdMinutes: 30,
} as const;

/**
 * Always the next 27 September at noon, so the countdown never sits at zero.
 */
export function getEventDate(from: Date = new Date()): Date {
  const candidate = new Date(from.getFullYear(), 8, 27, 12, 0, 0, 0);
  if (candidate.getTime() > from.getTime()) return candidate;
  return new Date(from.getFullYear() + 1, 8, 27, 12, 0, 0, 0);
}

export const CURRENCY = "₹";

export function formatPrice(amount: number): string {
  return `${CURRENCY}${amount.toLocaleString("en-IN")}`;
}
