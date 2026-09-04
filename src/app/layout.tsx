import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

// The AVION logotype is a high-contrast Didone, so the whole site speaks in one.
const bodoni = Bodoni_Moda({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono-rave",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: "UTOPIA — by AVION Productions | Sep 27, Ouzo Club Hyderabad",
  description:
    "UTOPIA: a state of escape. The party for the right people. Sunday 27 September, 12–5 PM at Ouzo Club and Kitchen, Hyderabad. Unlimited food, unlimited mocktails, zero alcohol.",
  keywords: [
    "UTOPIA",
    "AVION Productions",
    "Hyderabad day party",
    "Ouzo Club and Kitchen",
    "no alcohol party",
    "September 27",
  ],
  // No og:image / twitter card — sharing the URL should stay a plain link.
  openGraph: {
    title: "",
    description: "",
    type: "website",
    images: [],
  },
  twitter: {
    card: "summary",
    title: "",
    description: "",
    images: [],
  },
};

export const viewport: Viewport = {
  themeColor: "#030307",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${bodoni.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="bg-void text-bone flex min-h-full flex-col">
        {children}
      </body>
    </html>
  );
}
