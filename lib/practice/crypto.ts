import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import type { AnswerKey } from "./model";

function secret() {
  const value = process.env.MENTORA_TEST_SECRET;
  if (!value || !/^[a-f0-9]{64}$/i.test(value))
    throw new Error(
      "Practice tests are not configured. Contact the administrator.",
    );
  return Buffer.from(value, "hex");
}
export function seal(keys: AnswerKey[]) {
  const token = randomBytes(32).toString("hex");
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", secret(), iv);
  const data = Buffer.concat([
    cipher.update(JSON.stringify({ keys, token }), "utf8"),
    cipher.final(),
  ]);
  return {
    encrypted_key: [iv, cipher.getAuthTag(), data]
      .map((b) => b.toString("base64url"))
      .join("."),
    grading_hash: createHash("sha256").update(token).digest("hex"),
  };
}
export function unseal(value: string): { keys: AnswerKey[]; token: string } {
  const [iv, tag, data] = value
    .split(".")
    .map((s) => Buffer.from(s, "base64url"));
  const cipher = createDecipheriv("aes-256-gcm", secret(), iv);
  cipher.setAuthTag(tag);
  return JSON.parse(
    Buffer.concat([cipher.update(data), cipher.final()]).toString("utf8"),
  );
}
