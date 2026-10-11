import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/* Password hashing with scrypt — memory-hard, built into Node, no
   dependency. Parameters follow OWASP's Password Storage guidance for
   scrypt: N = 2^17, r = 8, p = 1 (128 MiB, a few hundred milliseconds).

   Stored form, self-describing so parameters can be raised later without
   breaking existing hashes:

     scrypt$<N>$<r>$<p>$<salt base64url>$<hash base64url>

   Every hash has its own 16-byte random salt. Verification recomputes with
   the stored parameters and compares in constant time. Plaintext passwords
   are never stored, logged or returned. */

export interface ScryptParams {
  N: number;
  r: number;
  p: number;
}

export const DEFAULT_SCRYPT: ScryptParams = { N: 2 ** 17, r: 8, p: 1 };
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

/* What a new password must be (owner bootstrap; user management later).
   Login does not reveal the policy: it only says the credentials are
   wrong. */
export const PASSWORD_POLICY = { minLength: 12, maxLength: 256 } as const;

const derive = (password: string, salt: Buffer, { N, r, p }: ScryptParams) =>
  new Promise<Buffer>((resolve, reject) => {
    const options: ScryptOptions = { N, r, p, maxmem: 256 * N * r + 1024 * 1024 };
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, options, (error, key) => (error ? reject(error) : resolve(key)));
  });

export async function hashPassword(password: string, params: ScryptParams = DEFAULT_SCRYPT): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt, params);
  return ["scrypt", params.N, params.r, params.p, salt.toString("base64url"), key.toString("base64url")].join("$");
}

/* true only for the right password. A malformed stored hash is false, not
   an exception — it can only mean the account cannot log in. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [N, r, p] = parts.slice(1, 4).map(Number);
  if (![N, r, p].every((n) => Number.isInteger(n) && n! > 0)) return false;
  const salt = Buffer.from(parts[4]!, "base64url");
  const expected = Buffer.from(parts[5]!, "base64url");
  if (salt.length === 0 || expected.length !== KEY_LENGTH) return false;
  const actual = await derive(password, salt, { N: N!, r: r!, p: p! });
  return timingSafeEqual(actual, expected);
}
