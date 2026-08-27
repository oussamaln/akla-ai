import { and, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users } from "../drizzle/schema";
import { randomBytes } from "node:crypto";
import { ENV } from "./_core/env";

let database: ReturnType<typeof drizzle> | null = null;

export function resolveRoleAssignment(role: InsertUser["role"] | undefined, isProjectOwner: boolean) {
  if (role !== undefined) return role;
  return isProjectOwner ? "admin" : undefined;
}

export function makeMemberUid() {
  return `UID-${randomBytes(6).toString("hex").toUpperCase()}`;
}

export async function getDb() {
  if (!database && process.env.DATABASE_URL) {
    try {
      database = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      database = null;
    }
  }
  return database;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId, lastSignedIn: new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: new Date() };
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  // Assign a role only for a deliberate role update or the first sign-in of the
  // configured project owner. Routine OAuth refreshes must never demote an
  // administrator back to the default member role.
  const roleAssignment = resolveRoleAssignment(user.role, user.openId === ENV.ownerOpenId);
  if (roleAssignment) {
    values.role = roleAssignment;
    updateSet.role = roleAssignment;
  }

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  await ensureMemberUid(user.openId);
}

export async function ensureMemberUid(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const existing = await db.select({ memberUid: users.memberUid }).from(users).where(eq(users.openId, openId)).limit(1);
  if (existing[0]?.memberUid) return existing[0].memberUid;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await db.update(users).set({ memberUid: makeMemberUid() }).where(and(eq(users.openId, openId), isNull(users.memberUid)));
      const updated = await db.select({ memberUid: users.memberUid }).from(users).where(eq(users.openId, openId)).limit(1);
      if (updated[0]?.memberUid) return updated[0].memberUid;
    } catch {
      // A vanishingly rare UID collision is retried with a fresh random value.
    }
  }
  throw new Error("Unable to assign a unique member UID. Please try again.");
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}
