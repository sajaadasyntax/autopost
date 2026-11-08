export function normalizePhone(input: string): string {
  return input.replace(/\D/g, '');
}

export function parseAllowlist(value: string | undefined): Set<string> {
  if (!value?.trim()) {
    return new Set();
  }
  return new Set(
    value
      .split(',')
      .map((phone) => normalizePhone(phone))
      .filter(Boolean),
  );
}
