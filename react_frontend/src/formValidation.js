export function normalizePhilippineMobileNumber(value) {
  const normalized = String(value ?? "").replace(/[\s()-]/g, "");
  return normalized.startsWith("639") ? `+${normalized}` : normalized;
}

export function isValidPhilippineMobileNumber(value) {
  return /^(?:09\d{9}|\+639\d{9})$/.test(normalizePhilippineMobileNumber(value));
}
