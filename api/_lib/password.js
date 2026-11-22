import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { HttpError } from "./http.js";

const COST = 10;
// Used to keep login timing similar when the username does not exist.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", COST);

export function assertStrongPassword(password) {
  const ok =
    typeof password === "string" &&
    password.length >= 8 &&
    password.length <= 72 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password);
  if (!ok) {
    throw new HttpError(
      400,
      "Password must be 8-72 characters with an uppercase letter, a lowercase letter, a number and a symbol."
    );
  }
}

export const hashPassword = (password) => bcrypt.hash(password, COST);

export function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash || DUMMY_HASH);
}

export function generateTempPassword() {
  const pick = (chars) => chars[crypto.randomInt(chars.length)];
  const groups = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789", "!@#$%*?"];
  const all = groups.join("");
  const chars = groups.map(pick);
  while (chars.length < 12) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
