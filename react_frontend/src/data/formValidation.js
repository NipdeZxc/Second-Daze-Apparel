// Shared validation for the workspace forms. The backend repeats these rules
// for every action; this module gives the UI immediate, field-level feedback.
const OPTIONAL_FIELDS = new Set(["social media handle", "email", "postal code", "additional items"]);

export function isOptionalField(field) {
  const normalized = String(field).toLowerCase();
  return normalized.includes("note") || OPTIONAL_FIELDS.has(normalized);
}

// Mirrors the backend strong-password rule: length plus character variety.
export function validatePassword(password) {
  const value = String(password || "");
  if (value.length < 8 || value.length > 72) return "Password must be 8 to 72 characters.";
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value)) return "Use at least one lowercase and one uppercase letter.";
  if (!/\d/.test(value)) return "Include at least one number.";
  if (!/[^A-Za-z0-9]/.test(value)) return "Include at least one special character.";
  return "";
}

export function validateFormValues(fields, values = {}) {
  const errors = {};
  for (const field of fields) {
    const normalized = String(field).toLowerCase();
    const value = String(values[field] ?? "").trim();
    if (!isOptionalField(field) && !value) {
      errors[field] = `${field} is required.`;
    } else if (normalized.includes("quantity") || normalized.includes("threshold") || normalized.includes("days")) {
      const minimum = normalized.includes("agreed days") || normalized.includes("quantity") ? 1 : 0;
      if (value && (!/^\d+$/.test(value) || Number(value) < minimum || Number(value) > 99999999)) {
        errors[field] = minimum === 1
          ? `${field} must be a whole number greater than zero.`
          : `${field} must be a zero or positive whole number.`;
      }
    } else if (normalized.includes("amount") || normalized.includes("price")) {
      if (value && (!/^\d+(\.\d{1,2})?$/.test(value) || Number(value) < 0)) {
        errors[field] = `${field} must be a non-negative amount with up to two decimal places.`;
      }
    } else if (normalized === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      errors[field] = "Enter a valid email address.";
    } else if (normalized.includes("contact number") && value && !/^(09|\+639)\d{9}$/.test(value.replace(/[\s-]/g, ""))) {
      errors[field] = "Contact number must look like 09XXXXXXXXX or +639XXXXXXXXX.";
    }
  }
  return errors;
}
