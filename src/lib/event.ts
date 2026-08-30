export const EVENT = {
  name: "UTOPIA",
  host: "AVION PRODUCTIONS",
  tagline: "The state of escape",
  subTagline: "and the party for the right people",
  dateLabel: "SEPTEMBER 27",
  shortDateLabel: "SEP 27",
  timeLabel: "12:00 PM — 5:00 PM",
  doorsLabel: "DOORS 11:30 AM",
  venueTeaser: "LOCATION CLASSIFIED",
  venueHint: "Coordinates drop 24 hours before doors. Pass holders only.",
  cityHint: "CITY CENTRE — WAREHOUSE DISTRICT",
  ageLabel: "21+ ONLY · VALID ID MANDATORY",
  email: "passes@avionproductions.live",
  instagram: "https://instagram.com",
  youtube: "https://youtube.com",
} as const;

/**
 * The countdown always targets the next 27 September, 12:00 local time, so the
 * timer stays live across years instead of freezing at zero after the event.
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
