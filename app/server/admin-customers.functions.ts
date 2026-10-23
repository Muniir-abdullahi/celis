"use server";

import { createCustomerAccount } from "./admin-customers.server";

export async function createAdminCustomer(input: { data: unknown }) {
  return createCustomerAccount(input.data);
}
