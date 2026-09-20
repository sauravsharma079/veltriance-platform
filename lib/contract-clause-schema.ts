import { z } from "zod";

export const clauseSchema = z.object({
  title: z.string().trim().min(2).max(150),
  category: z.string().trim().min(2).max(60),
  body: z.string().trim().min(10).max(10_000),
  fallbackBody: z.string().trim().max(10_000).nullable().optional(),
  guidance: z.string().trim().max(3000).nullable().optional(),
  required: z.boolean().optional(),
  active: z.boolean().optional(),
});
