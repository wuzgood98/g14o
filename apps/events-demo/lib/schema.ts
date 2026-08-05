import { z } from "zod";

export const demoEventSchema = {
  demo: {
    notification: z.object({
      body: z.string().min(1),
      title: z.string().min(1),
    }),
    ping: z.object({ message: z.string().min(1) }),
  },
  auth: {
    login: z.object({ userId: z.string().min(1), password: z.string().min(1) }),
    logout: z.object({ userId: z.string().min(1) }),
  },
};
