import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { sqlite } from "@/lib/db";

const UserRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  image: z.string().nullable(),
  paystackCustomerCode: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

type UserRow = z.infer<typeof UserRowSchema>;

const SubscriptionRowSchema = z.object({
  cancelAtPeriodEnd: z.boolean(),
  currentPeriodEnd: z.string().nullable(),
  currentPeriodStart: z.string(),
  customerCode: z.string(),
  id: z.string(),
  metadata: z.string().nullable(),
  planCode: z.string(),
  planName: z.string(),
  provider: z.string(),
  referenceId: z.string(),
  status: z.string(),
  subscriptionCode: z.string(),
  userId: z.string(),
});

type SubscriptionRow = z.infer<typeof SubscriptionRowSchema>;

interface UserWithSubscriptions extends UserRow {
  subscriptions: SubscriptionRow[];
}

export async function GET() {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  const users = sqlite
    .prepare(
      `SELECT id, name, email, emailVerified, image, paystackCustomerCode, createdAt, updatedAt
       FROM user
       ORDER BY createdAt DESC`
    )
    .all();
  const validatedUsers = z.array(UserRowSchema).parse(users);

  const subscriptions = sqlite
    .prepare(
      `SELECT id, userId, referenceId, provider, subscriptionCode, customerCode,
              planCode, planName, status, currentPeriodStart, currentPeriodEnd,
              cancelAtPeriodEnd, metadata
       FROM subscription
       ORDER BY id DESC`
    )
    .all();
  const validatedSubscriptions = z
    .array(SubscriptionRowSchema)
    .parse(subscriptions);

  const subscriptionsByUserId = new Map<string, SubscriptionRow[]>();
  for (const subscription of validatedSubscriptions) {
    const existing = subscriptionsByUserId.get(subscription.userId) ?? [];
    existing.push(subscription);
    subscriptionsByUserId.set(subscription.userId, existing);
  }

  const usersWithSubscriptions: UserWithSubscriptions[] = validatedUsers.map(
    (user) => ({
      ...user,
      subscriptions: subscriptionsByUserId.get(user.id) ?? [],
    })
  );

  const currentUserSubscriptions = session
    ? await auth.api.listActiveSubscriptions({
        headers: requestHeaders,
        query: {
          customer: session.user.paystackCustomerId,
          page: 1,
          perPage: 100,
        },
      })
    : null;

  return Response.json({
    currentUser: session?.user ?? null,
    currentUserSubscriptions,
    users: usersWithSubscriptions,
    subscriptions,
    total: users.length,
    totalSubscriptions: subscriptions.length,
  });
}
