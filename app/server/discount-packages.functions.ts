"use server";
import { adminMutation } from "~/lib/admin-mutation";
import { saveDiscountPackage, setDiscountPackageActive, assignDiscountPackage, cancelDiscountAssignment, searchDiscountSellers } from "./discount-packages.server";
export async function saveDiscount(input: { data: unknown }) { return adminMutation(() => saveDiscountPackage(input.data)); }
export async function activateDiscount(input: { data: unknown }) { return adminMutation(() => setDiscountPackageActive(input.data)); }
export async function assignDiscount(input: { data: unknown }) { return adminMutation(() => assignDiscountPackage(input.data)); }
export async function cancelDiscount(input: { data: unknown }) { return adminMutation(() => cancelDiscountAssignment(input.data)); }
export async function findDiscountSellers(input: { data: unknown }) { return adminMutation(() => searchDiscountSellers(input.data)); }
