import { Paystack } from "@g14o/paystack";
import { env } from "@/lib/env";

export const paystack = new Paystack({
  secretKey: env.PAYSTACK_SECRET_KEY,
});
