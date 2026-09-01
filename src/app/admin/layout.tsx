import { AdminShell } from "@/components/admin/AdminShell";
import { CmsUnlock } from "@/components/admin/CmsUnlock";
import { getAdminSession } from "@/server/admin-session";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CMS",
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();
  if (!session) return <CmsUnlock />;

  return <AdminShell username={session.username}>{children}</AdminShell>;
}
