"use server";
import { adminMutation } from "~/lib/admin-mutation";
import { cancelSellerPackage } from "./package-assignment.server";

export async function cancelSellerPackageAssignment(input: { data: unknown }) {
  return adminMutation(() => cancelSellerPackage(input.data));
}
