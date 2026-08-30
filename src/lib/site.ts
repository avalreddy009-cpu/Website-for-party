/** Absolute origin of this deployment. Used for pass QR URLs and Open Graph. */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
