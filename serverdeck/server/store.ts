import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import type { Project, Snapshot } from "../src/types.ts";

export const root = process.cwd();
export const local =
  process.env.SERVER_DECK_DATA_DIR || path.join(root, ".local");
mkdirSync(local, { recursive: true, mode: 0o700 });

export interface PrivateAccount {
  id: string;
  alias: string;
  username: string;
  password: string;
  keyPath: string;
}
export interface PrivateServer {
  id: string;
  name: string;
  host: string;
  port: number;
  provider: string;
  region: string;
  notes: string;
  expiresAt: string;
  monthlyCost: string;
  accounts: PrivateAccount[];
  hostKeys: string[];
}
export interface Vault {
  servers: PrivateServer[];
  projects: Project[];
}

export function encrypt(value: unknown, key: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]);
}
export function decrypt<T>(raw: Buffer, key: Buffer): T {
  const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return JSON.parse(
    Buffer.concat([
      decipher.update(raw.subarray(28)),
      decipher.final(),
    ]).toString("utf8"),
  ) as T;
}
function atomic(file: string, contents: string | Buffer) {
  const temp = file + ".tmp";
  writeFileSync(temp, contents, { mode: 0o600 });
  renameSync(temp, file);
}
function masterKey() {
  const file = path.join(local, "master.key");
  if (!existsSync(file)) writeFileSync(file, randomBytes(32), { mode: 0o600 });
  return readFileSync(file);
}
const key = masterKey();
const vaultFile = path.join(local, "vault.enc");
export function readVault(): Vault {
  return existsSync(vaultFile)
    ? decrypt<Vault>(readFileSync(vaultFile), key)
    : { servers: [], projects: [] };
}
export function writeVault(value: Vault) {
  atomic(vaultFile, encrypt(value, key));
}
export function readSnapshots(): Record<string, Snapshot> {
  const file = path.join(local, "inventory.json");
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
}
export function writeSnapshots(value: Record<string, Snapshot>) {
  atomic(path.join(local, "inventory.json"), JSON.stringify(value));
}

const authFile = path.join(local, "auth.json");
if (!existsSync(authFile)) {
  const password = randomBytes(15).toString("base64url");
  const salt = randomBytes(16).toString("hex");
  atomic(
    authFile,
    JSON.stringify({
      salt,
      hash: scryptSync(password, salt, 64).toString("hex"),
    }),
  );
  writeFileSync(
    path.join(local, "dashboard-login.txt"),
    `Server Deck 管理口令\n${password}\n\n本文件仅供首次登录使用，可在记住口令后移走。\n`,
    { mode: 0o600 },
  );
}
export function verifyPassword(password: string) {
  const auth = JSON.parse(readFileSync(authFile, "utf8"));
  const hash = scryptSync(password, auth.salt, 64);
  return timingSafeEqual(hash, Buffer.from(auth.hash, "hex"));
}
