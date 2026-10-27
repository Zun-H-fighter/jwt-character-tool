import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
const accounts = ["Alice", "Bob"].map((name, i) => {
  const salt = randomBytes(16);
  return {
    id: i + 1,
    name,
    email: `${name.toLowerCase()}@class.test`,
    salt,
    hash: scryptSync("Classroom!2026", salt, 32),
  };
});
export function findPublic(id) {
  const u = accounts.find((u) => u.id === id);
  return u ? { id: u.id, name: u.name, email: u.email } : null;
}
export function verifyCredentials(email, password) {
  const u = accounts.find((u) => u.email === email),
    reference = u ?? accounts[0];
  const ok = timingSafeEqual(
    scryptSync(password, reference.salt, 32),
    reference.hash,
  );
  return u && ok ? findPublic(u.id) : null;
}
