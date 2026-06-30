/**
 * Slug generation for GitRoasted Roast_Records.
 *
 * A slug is the public identifier for a stored roast, formed from the
 * normalized username and a short random alphanumeric suffix
 * (e.g. `ahmmikun-x7k92`). The API retries on the rare unique-index
 * collision.
 */

/** Characters used for the random suffix: lowercase alphanumeric only. */
const SUFFIX_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** Length of the random suffix appended to every slug. */
const SUFFIX_LENGTH = 5;

/**
 * Produce a random alphanumeric suffix drawn from `[a-z0-9]`.
 */
function randomSuffix(length: number = SUFFIX_LENGTH): string {
  let suffix = "";
  for (let i = 0; i < length; i++) {
    const index = Math.floor(Math.random() * SUFFIX_ALPHABET.length);
    suffix += SUFFIX_ALPHABET[index];
  }
  return suffix;
}

/**
 * Generate a unique-ish slug for a username.
 *
 * The username is lowercased and stripped of any character outside
 * `[a-z0-9-]`; a hyphen and a 5-character random alphanumeric suffix are
 * appended. The result matches `^[a-z0-9-]+-[a-z0-9]+$`.
 *
 * If normalization removes every character of the username (e.g. the input
 * was entirely disallowed characters), a stable `user` stem is used so the
 * normalized portion is never empty.
 */
export function generateSlug(username: string): string {
  const normalized = username.toLowerCase().replace(/[^a-z0-9-]/g, "");
  const stem = normalized.length > 0 ? normalized : "user";
  return `${stem}-${randomSuffix()}`;
}
