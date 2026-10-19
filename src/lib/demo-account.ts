export const DEMO_EMAIL = "vitaliy@closingdesk.local";
export const DEMO_NAME = "Vitaliy";
export const DEMO_PASSWORD = "harbor-pine";

export function attorneyEmail(): string {
  return (process.env.CLOSINGDESK_ATTORNEY_EMAIL || DEMO_EMAIL).trim().toLowerCase();
}

export function attorneyName(): string {
  return (process.env.CLOSINGDESK_ATTORNEY_NAME || DEMO_NAME).trim() || DEMO_NAME;
}

/** Null in production when no password is configured, so a known default is never seeded. */
export function attorneyPassword(): string | null {
  const configured = process.env.CLOSINGDESK_ATTORNEY_PASSWORD?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") return null;
  return DEMO_PASSWORD;
}

export function loginHint(): string | null {
  if (process.env.NODE_ENV === "production") return null;
  if (process.env.CLOSINGDESK_ATTORNEY_PASSWORD) return null;
  return `${DEMO_EMAIL} / ${DEMO_PASSWORD}`;
}
