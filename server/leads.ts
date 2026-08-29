import { z } from "zod";

export const createLeadSchema = z
  .object({
    sourceMessageId: z.string().trim().min(1),
    product: z.string().trim().min(1),
    quantity: z.number().int().positive(),
    material: z.string().nullable().optional(),
    budget: z.number().nonnegative().optional(),
  })
  .strict();

export const updateLeadStatusSchema = z
  .object({ status: z.literal("CONTACTED") })
  .strict();
