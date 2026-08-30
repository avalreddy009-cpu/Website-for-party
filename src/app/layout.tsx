import type { Metadata, Viewport } from "next";
import { Anton, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const anton = Anton({
  variable: "--font-anton",
  subsets: ["latin"],
  weight: "400",
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
  title: "UTOPIA — by AVION Productions",
  description:
    "UTOPIA: the state of escape, and the party for the right people. September 27th, 12:00 PM – 5:00 PM. An AVION Productions underground day rave.",
  keywords: [
    "UTOPIA",
    "AVION Productions",
    "rave",
    "underground party",
    "day rave",
    "techno",
  ],
  openGraph: {
    title: "UTOPIA — by AVION Productions",
    description:
      "The state of escape, and the party for the right people. Sept 27 · 12:00 PM – 5:00 PM.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#030308",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${anton.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="bg-void text-bone flex min-h-full flex-col">
        {children}
      </body>
    </html>
  );
}
