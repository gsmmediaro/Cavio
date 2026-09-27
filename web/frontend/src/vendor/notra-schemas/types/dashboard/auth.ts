export type PendingAuthStep =
  | "password"
  | "email-verification"
  | "mfa"
  | "complete"
  | null;

export type AuthMethod = "email" | "google" | "github" | "apple";
