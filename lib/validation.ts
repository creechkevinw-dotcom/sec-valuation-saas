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

export const portfolioSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export const portfolioIdSchema = z.object({
  portfolioId: z.string().uuid(),
});

export const portfolioPositionCreateSchema = z.object({
  portfolioId: z.string().uuid(),
  ticker: z
    .string()
    .trim()
    .toUpperCase()
    .min(1)
    .max(10)
    .regex(/^[A-Z.\-]+$/, "Ticker must be uppercase letters, dot, or dash"),
  quantity: z.number().positive().max(1_000_000_000),
  costBasis: z.number().nonnegative().max(1_000_000),
  openedAt: z.string().date().optional(),
});

export const portfolioPositionUpdateSchema = z.object({
  positionId: z.string().uuid(),
  quantity: z.number().positive().max(1_000_000_000).optional(),
  costBasis: z.number().nonnegative().max(1_000_000).optional(),
  openedAt: z.string().date().nullable().optional(),
});

export const portfolioPositionDeleteSchema = z.object({
  positionId: z.string().uuid(),
});
