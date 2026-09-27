import {
  fetchCurrentUser,
  fetchAllPermissions,
  fetchRoles,
} from "~/server/auth.functions";
import { RolesContent } from "./roles-content";

export default async function RolesPage() {
  const [user, permissions, roles] = await Promise.all([
    fetchCurrentUser(),
    fetchAllPermissions(),
    fetchRoles(),
  ]);
  return <RolesContent data={{ user, permissions, roles }} />;
}