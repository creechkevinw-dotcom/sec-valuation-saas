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

export const analyzeCompanySchema = z.object({
  valuationId: z.string().uuid(),
  forceRefresh: z.boolean().optional().default(false),
});

export const watchlistMutationSchema = z.object({
  ticker: z
    .string()
    .trim()
    .toUpperCase()
    .min(1)
    .max(10)
    .regex(/^[A-Z.\-]+$/, "Ticker must be uppercase letters, dot, or dash"),
});

export const recommendationConsentSchema = z.object({
  consentVersion: z.string().trim().min(1).max(50),
});

export const tradeRecommendationSchema = z.object({
  ticker: z
    .string()
    .trim()
    .toUpperCase()
    .min(1)
    .max(10)
    .regex(/^[A-Z.\-]+$/, "Ticker must be uppercase letters, dot, or dash"),
});
