import { fetchPlatformConfigSection } from "~/server/admin.functions";
import { SettingsContent } from "./settings-content";

export const metadata = { title: "Settings | Admin | Celis" };

export default async function AdminSettingsPage() {
  const initialConfigs = await fetchPlatformConfigSection({ data: { section: "fees" } });
  return <SettingsContent initialConfigs={initialConfigs as never} />;
}
