import { redirect } from "next/navigation";
import { Dashboard } from "@/components/Dashboard";
import { currentUser } from "@/lib/auth/current";
import { listMatterRows } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const rows = await listMatterRows(user.id);
  return <Dashboard rows={rows} name={user.name} />;
}
