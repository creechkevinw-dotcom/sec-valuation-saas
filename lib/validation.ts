import { z } from "zod";

export const tickerSchema = z.object({
  ticker: z
    .string()
    .trim()
    .toUpperCase()
    .min(1)
    .max(10)
    .regex(/^[A-Z.\-]+$/, "Ticker must be uppercase letters, dot, or dash"),
});
