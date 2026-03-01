export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const SEC_BASE_URL = "https://data.sec.gov";
export const SEC_USER_AGENT =
  process.env.SEC_USER_AGENT ?? "sec-valuation-saas/1.0 support@example.com";
