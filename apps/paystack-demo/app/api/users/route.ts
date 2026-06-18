import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { sqlite } from "@/lib/db";

interface UserRow {
  createdAt: string;
  email: string;
  emailVerified: boolean;
  id: string;
  image: string | null;
  name: string;
  paystackCustomerCode: string | null;
  updatedAt: string;
}

interface SubscriptionRow {
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  currentPeriodStart: string;
  customerCode: string;
  id: string;
  metadata: string | null;
  planCode: string;
  planName: string;
  provider: string;
  referenceId: string;
  status: string;
  subscriptionCode: string;
  userId: string;
}

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
    .all() as unknown as UserRow[];

  const subscriptions = sqlite
    .prepare(
      `SELECT id, userId, referenceId, provider, subscriptionCode, customerCode,
              planCode, planName, status, currentPeriodStart, currentPeriodEnd,
              cancelAtPeriodEnd, metadata
       FROM subscription
       ORDER BY id DESC`
    )
    .all() as unknown as SubscriptionRow[];

  const subscriptionsByUserId = new Map<string, SubscriptionRow[]>();
  for (const subscription of subscriptions) {
    const existing = subscriptionsByUserId.get(subscription.userId) ?? [];
    existing.push(subscription);
    subscriptionsByUserId.set(subscription.userId, existing);
  }

  const usersWithSubscriptions: UserWithSubscriptions[] = users.map((user) => ({
    ...user,
    subscriptions: subscriptionsByUserId.get(user.id) ?? [],
  }));

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
