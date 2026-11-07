import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { encrypt, decrypt } from "../server/store.ts";

test("credentials are encrypted with authentication, including Unicode and punctuation", () => {
  const key = randomBytes(32);
  const value = { password: "test-only-口令$`@!", username: "test" };
  const encrypted = encrypt(value, key);
  assert.equal(encrypted.includes(Buffer.from(value.password)), false);
  assert.deepEqual(decrypt(encrypted, key), value);
  const tampered = Buffer.from(encrypted);
  tampered[tampered.length - 1] ^= 1;
  assert.throws(() => decrypt(tampered, key));
  assert.throws(() => decrypt(encrypted, randomBytes(32)));
});
