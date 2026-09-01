import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Door",
  robots: { index: false, follow: false, nocache: true },
};

export default function DoorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
