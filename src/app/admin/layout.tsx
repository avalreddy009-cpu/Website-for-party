import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminSession } from "@/server/admin-session";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();
  if (!session) redirect("/login");

  return <AdminShell username={session.username}>{children}</AdminShell>;
}
