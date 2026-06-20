import {
  type Paystack,
  type PaystackPlan,
  SubscriptionError,
} from "@g14o/paystack";
import type {
  AutoSubscriptionPlan,
  PaystackPlanKey,
  PlanInterval,
  PrecreatedSubscriptionPlan,
  ResolvedPlan,
  SubscriptionPlan,
} from "./types";
import { normalizePlanName } from "./utils";

const VALID_PLAN_INTERVALS = new Set<PlanInterval>([
  "monthly",
  "annually",
  "weekly",
  "daily",
  "quarterly",
  "biannually",
]);

const PRECREATED_FORBIDDEN_KEYS = [
  "amount",
  "currency",
  "interval",
  "description",
  "annualDiscountedAmount",
] as const;

const paystackIntervalFromPlan = (interval: PlanInterval): string => {
  if (interval === "annually") {
    return "annually";
  }

  return interval;
};

const amountToInteger = (amount: string): number => {
  const parsed = Number.parseInt(amount, 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new SubscriptionError(
      "Invalid plan amount",
      "SUBSCRIPTION_PLAN_NOT_FOUND"
    );
  }

  return parsed;
};

const isPrecreatedPlan = (
  plan: SubscriptionPlan
): plan is PrecreatedSubscriptionPlan =>
  "planCode" in plan &&
  typeof plan.planCode === "string" &&
  plan.planCode.length > 0;

const validateSubscriptionPlan = (plan: SubscriptionPlan): void => {
  const record = plan as unknown as Record<string, unknown>;

  if (isPrecreatedPlan(plan)) {
    for (const key of PRECREATED_FORBIDDEN_KEYS) {
      if (record[key] !== undefined) {
        throw new SubscriptionError(
          `Plan "${plan.name}" cannot include "${key}" when planCode is set`,
          "SUBSCRIPTION_PLAN_NOT_FOUND"
        );
      }
    }

    return;
  }

  if (record.planCode !== undefined) {
    throw new SubscriptionError(
      `Plan "${plan.name}" cannot include planCode without required billing fields`,
      "SUBSCRIPTION_PLAN_NOT_FOUND"
    );
  }

  if (record.annualDiscountedPlanCode !== undefined) {
    throw new SubscriptionError(
      `Plan "${plan.name}" cannot include annualDiscountedPlanCode without planCode`,
      "SUBSCRIPTION_PLAN_NOT_FOUND"
    );
  }

  const autoPlan = plan as AutoSubscriptionPlan;

  if (!(autoPlan.amount && autoPlan.currency && autoPlan.interval)) {
    throw new SubscriptionError(
      `Plan "${plan.name}" requires amount, currency, and interval`,
      "SUBSCRIPTION_PLAN_NOT_FOUND"
    );
  }
};

const mapSubscriptionPlanToResolved = (
  plan: SubscriptionPlan
): ResolvedPlan => {
  validateSubscriptionPlan(plan);

  const normalizedName = normalizePlanName(plan.name);

  if (isPrecreatedPlan(plan)) {
    return {
      normalizedName,
      name: plan.name,
      planCode: plan.planCode,
      annualDiscountedPlanCode: plan.annualDiscountedPlanCode,
      amount: "",
      currency: "",
      interval: "monthly",
    };
  }

  const autoPlan = plan as AutoSubscriptionPlan;

  return {
    normalizedName,
    name: autoPlan.name,
    amount: autoPlan.amount,
    currency: autoPlan.currency,
    interval: autoPlan.interval,
    annualDiscountedAmount: autoPlan.annualDiscountedAmount,
    description: autoPlan.description,
  };
};

const hydrateResolvedPlanFromPaystack = (
  plan: ResolvedPlan,
  remote: PaystackPlan
): void => {
  if (!VALID_PLAN_INTERVALS.has(remote.interval as PlanInterval)) {
    throw new SubscriptionError(
      `Unsupported Paystack plan interval "${remote.interval}"`,
      "SUBSCRIPTION_PLAN_NOT_FOUND"
    );
  }

  plan.amount = String(remote.amount);
  plan.currency = remote.currency;
  plan.interval = remote.interval as PlanInterval;

  if (remote.description) {
    plan.description = remote.description;
  }
};

const fetchPaystackPlan = async (
  paystack: Paystack,
  code: string
): Promise<PaystackPlan> => {
  try {
    return await paystack.plans.fetch(code);
  } catch (error) {
    throw new SubscriptionError(
      `Paystack plan "${code}" not found`,
      "SUBSCRIPTION_PLAN_NOT_FOUND",
      error
    );
  }
};

export class PlanRegistry {
  private readonly paystack: Paystack;
  private readonly plansInput:
    | SubscriptionPlan[]
    | (() => Promise<SubscriptionPlan[]>);
  private readonly cache = new Map<PaystackPlanKey, string>();
  private resolvedPlans: ResolvedPlan[] = [];

  constructor(
    paystack: Paystack,
    plansInput: SubscriptionPlan[] | (() => Promise<SubscriptionPlan[]>)
  ) {
    this.paystack = paystack;
    this.plansInput = plansInput;
  }

  /**
   * Resolve the plans to a list of the provided plans with normalized names.
   * @internal
   */
  async resolvePlans(): Promise<ResolvedPlan[]> {
    const plans =
      typeof this.plansInput === "function"
        ? await this.plansInput()
        : this.plansInput;

    this.resolvedPlans = plans.map(mapSubscriptionPlanToResolved);

    return this.resolvedPlans;
  }

  /**
   * Get a plan by name.
   * @internal
   */
  async getPlanByName(name: string): Promise<ResolvedPlan | undefined> {
    const plans = this.resolvedPlans.length
      ? this.resolvedPlans
      : await this.resolvePlans();

    return plans.find(
      (plan) => plan.normalizedName === normalizePlanName(name)
    );
  }

  private findExistingPlan(
    remotePlans: PaystackPlan[],
    plan: ResolvedPlan,
    interval: PlanInterval,
    amount: number
  ) {
    const normalizedName = normalizePlanName(plan.name);
    const paystackInterval = paystackIntervalFromPlan(interval);

    return remotePlans.find(
      (remote) =>
        remote.name.toLowerCase().includes(normalizedName) &&
        remote.interval === paystackInterval &&
        remote.amount === amount &&
        remote.currency.toUpperCase() === plan.currency.toUpperCase()
    );
  }

  /**
   * Ensure a Paystack plan exists and is cached.
   * @internal
   */
  async ensurePaystackPlan(
    plan: ResolvedPlan,
    options: { annual?: boolean | undefined } = {}
  ): Promise<string> {
    const interval: PlanInterval = options.annual ? "annually" : plan.interval;
    const cacheKey: PaystackPlanKey = `${plan.normalizedName}:${interval}`;

    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    if (plan.planCode) {
      const codeToFetch = options.annual
        ? plan.annualDiscountedPlanCode
        : plan.planCode;

      if (!codeToFetch) {
        throw new SubscriptionError(
          `Annual plan code is required for plan "${plan.name}"`,
          "SUBSCRIPTION_PLAN_NOT_FOUND"
        );
      }

      const remotePlan = await fetchPaystackPlan(this.paystack, codeToFetch);
      hydrateResolvedPlanFromPaystack(plan, remotePlan);

      const planCode = remotePlan.plan_code;
      this.cache.set(cacheKey, planCode);

      if (options.annual) {
        plan.paystackAnnualPlanCode = planCode;
      } else {
        plan.paystackPlanCode = planCode;
      }

      return planCode;
    }

    const amount = options.annual
      ? amountToInteger(plan.annualDiscountedAmount ?? plan.amount)
      : amountToInteger(plan.amount);

    const remotePlans = await this.paystack.plans.list({ perPage: 100 });
    const existing = this.findExistingPlan(remotePlans, plan, interval, amount);

    if (existing) {
      this.cache.set(cacheKey, existing.plan_code);
      if (options.annual) {
        plan.paystackAnnualPlanCode = existing.plan_code;
      } else {
        plan.paystackPlanCode = existing.plan_code;
      }
      return existing.plan_code;
    }

    const created = await this.paystack.plans.create({
      name: `${plan.name}${options.annual ? " (Annual)" : ""}`,
      amount,
      interval: paystackIntervalFromPlan(interval),
      currency: plan.currency,
      description: plan.description,
    });

    this.cache.set(cacheKey, created.plan_code);

    if (options.annual) {
      plan.paystackAnnualPlanCode = created.plan_code;
    } else {
      plan.paystackPlanCode = created.plan_code;
    }

    return created.plan_code;
  }

  async resolvePaystackPlanCode(
    planName: string,
    annual = false
  ): Promise<{ plan: ResolvedPlan; planCode: string }> {
    const plan = await this.getPlanByName(planName);

    if (!plan) {
      throw new SubscriptionError(
        `Plan "${planName}" not found`,
        "SUBSCRIPTION_PLAN_NOT_FOUND"
      );
    }

    const planCode = await this.ensurePaystackPlan(plan, { annual });
    return { plan, planCode };
  }
}
