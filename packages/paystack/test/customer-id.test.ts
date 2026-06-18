import type { Mock } from "vitest";
import { describe, expect } from "vitest";
import { getUserById, resolvePaystackCustomerId } from "../src/customer";
import {
  createMockFetch,
  createPaystackClient,
  createPaystackOptions,
  DEMO_PAYSTACK_CUSTOMER_CODE,
  DEMO_PAYSTACK_CUSTOMER_ID,
  setupAuthenticatedUpgradeTest,
  test,
} from "./_fixtures";

describe("resolvePaystackCustomerId", () => {
  test("returns cached id without fetching when paystackCustomerId is stored", async ({
    memory,
  }) => {
    const mockFetch = createMockFetch();
    const paystackClient = createPaystackClient({ fetch: mockFetch });
    const paystackOptions = createPaystackOptions(paystackClient);
    const { userId, adapter } = await setupAuthenticatedUpgradeTest({
      memory,
      paystackOptions,
    });

    await adapter.update({
      model: "user",
      where: [{ field: "id", value: userId }],
      update: {
        paystackCustomerCode: DEMO_PAYSTACK_CUSTOMER_CODE,
        paystackCustomerId: DEMO_PAYSTACK_CUSTOMER_ID,
      },
    });

    const customerId = await resolvePaystackCustomerId({
      adapter,
      paystackClient,
      userId,
    });

    expect(customerId).toBe(DEMO_PAYSTACK_CUSTOMER_ID);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("fetches customer by code, persists id, and returns numeric id", async ({
    memory,
  }) => {
    const mockFetch = createMockFetch();
    const paystackClient = createPaystackClient({ fetch: mockFetch });
    const paystackOptions = createPaystackOptions(paystackClient);
    const { userId, adapter } = await setupAuthenticatedUpgradeTest({
      memory,
      paystackOptions,
    });

    await adapter.update({
      model: "user",
      where: [{ field: "id", value: userId }],
      update: {
        paystackCustomerCode: DEMO_PAYSTACK_CUSTOMER_CODE,
      },
    });

    const customerId = await resolvePaystackCustomerId({
      adapter,
      paystackClient,
      userId,
    });

    expect(customerId).toBe(DEMO_PAYSTACK_CUSTOMER_ID);

    const user = await getUserById(adapter, userId);
    expect(user?.paystackCustomerId).toBe(DEMO_PAYSTACK_CUSTOMER_ID);

    const fetchCall = (mockFetch as Mock).mock.calls.find(([url]) =>
      String(url).includes(`/customer/${DEMO_PAYSTACK_CUSTOMER_CODE}`)
    );
    expect(fetchCall).toBeDefined();
  });
});
