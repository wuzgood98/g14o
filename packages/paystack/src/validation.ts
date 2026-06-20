import { z } from "zod";

/**
 * The schema for the disable subscription params.
 */
export const disableSubscriptionParamsSchema = z.object({
  /**
   * The code of the subscription to disable.
   * @required
   */
  code: z
    .string()
    .meta({
      description: "The code of the subscription to disable.",
    })
    .min(1),
  /**
   * The token of the subscription to disable.
   * @required
   */
  token: z
    .string()
    .meta({
      description: "The token of the subscription to disable.",
    })
    .min(1),
});

export type DisableSubscriptionParams = z.infer<
  typeof disableSubscriptionParamsSchema
>;
