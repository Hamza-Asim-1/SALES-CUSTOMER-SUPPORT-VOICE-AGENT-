/** Production Render URLs — used when NEXT_PUBLIC_* env vars are missing at build time. */
export const AUTH_API_URL =
  process.env.NEXT_PUBLIC_AUTH_URL ?? "https://fyp-auth.onrender.com";

export const CRM_API_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://fyp-crm.onrender.com";

export const REPORTING_API_URL =
  process.env.NEXT_PUBLIC_REPORTING_URL ?? "https://fyp-reporting.onrender.com";

export const SALES_API_URL =
  process.env.NEXT_PUBLIC_SALES_URL ?? "https://fyp-sales.onrender.com";
