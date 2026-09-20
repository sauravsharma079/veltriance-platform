import { z } from "zod";

export const budgetFields = {
  name: z.string().trim().min(2).max(120), startDate: z.string().date(), endDate: z.string().date(),
  amount: z.number().positive().max(1e13), currency: z.string().trim().length(3).transform(s => s.toUpperCase()),
  department: z.string().trim().max(80).nullable().optional(), costCenter: z.string().trim().max(80).nullable().optional(), category: z.string().trim().max(80).nullable().optional(),
  warnPct: z.number().int().min(1).max(100), hardStop: z.boolean(), active: z.boolean(),
};
