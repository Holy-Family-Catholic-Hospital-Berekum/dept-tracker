// Keep in sync with Firebase console > Authentication > Settings > Password policy,
// which enforces the same rules server-side (including passwords set via reset emails).
export const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'An uppercase letter (A-Z)', test: (p) => /[A-Z]/.test(p) },
  { label: 'A lowercase letter (a-z)', test: (p) => /[a-z]/.test(p) },
  { label: 'A number (0-9)', test: (p) => /\d/.test(p) },
  { label: 'A symbol (e.g. ! @ # $ %)', test: (p) => /[^A-Za-z0-9]/.test(p) },
]

export function isStrongPassword(password) {
  return PASSWORD_RULES.every((rule) => rule.test(password))
}

// Look-alike characters (0/O, 1/l/I) are left out so a temporary password can be read out or copied by hand.
const SETS = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789', '!@#$%&*?']

function randomIndex(max) {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0] % max
}

export function generatePassword(length = 12) {
  const all = SETS.join('')
  const chars = SETS.map((set) => set[randomIndex(set.length)])
  while (chars.length < length) chars.push(all[randomIndex(all.length)])
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}
