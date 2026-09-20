import { z } from "zod";

export const itemSchema = z.object({
  description: z.string().trim().min(2).max(300),
  quantity: z.number().positive().max(1e9),
  unit: z.string().trim().max(20).nullable().optional(),
  specification: z.string().trim().max(2000).nullable().optional(),
  targetPrice: z.number().nonnegative().nullable().optional(),
});
