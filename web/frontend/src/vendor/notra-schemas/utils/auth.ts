export function normalizeBackupCode(code: string): string {
  return code.replace(/\s+/g, "").toUpperCase();
}
