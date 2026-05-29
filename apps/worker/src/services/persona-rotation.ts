import { eq, and, asc } from "drizzle-orm";
import type { Db } from "@pharma-shopper/db";
import {
  personas,
  waSessions,
  waSessionPersonas,
  conversations,
} from "@pharma-shopper/db";

const DEFAULT_ROTATION_THRESHOLD = 5;

export async function selectPersonaForSession(
  db: Db,
  waSessionId: string,
  pharmacyId: string,
  rotationThreshold = DEFAULT_ROTATION_THRESHOLD,
): Promise<string | null> {
  const [session] = await db
    .select()
    .from(waSessions)
    .where(eq(waSessions.id, waSessionId))
    .limit(1);

  if (!session) return null;

  if (
    session.currentPersonaId &&
    session.personaRotationCount < rotationThreshold
  ) {
    const alreadyUsed = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(
        and(
          eq(conversations.waSessionId, waSessionId),
          eq(conversations.pharmacyId, pharmacyId),
          eq(conversations.personaId, session.currentPersonaId),
        ),
      )
      .limit(1);

    if (alreadyUsed.length === 0) {
      return session.currentPersonaId;
    }
  }

  const usedPersonaIds = await db
    .select({ personaId: conversations.personaId })
    .from(conversations)
    .where(
      and(
        eq(conversations.waSessionId, waSessionId),
        eq(conversations.pharmacyId, pharmacyId),
      ),
    );
  const usedSet = new Set(usedPersonaIds.map((r) => r.personaId).filter(Boolean));

  const candidates = await db
    .select({ id: personas.id })
    .from(personas)
    .leftJoin(
      waSessionPersonas,
      and(
        eq(waSessionPersonas.personaId, personas.id),
        eq(waSessionPersonas.waSessionId, waSessionId),
      ),
    )
    .where(eq(personas.isActive, true))
    .orderBy(asc(waSessionPersonas.lastUsedAt));

  const filtered = candidates.filter((c) => !usedSet.has(c.id));
  const chosen = filtered[0] ?? candidates[0];
  if (!chosen) return null;

  const now = new Date();

  const [existing] = await db
    .select()
    .from(waSessionPersonas)
    .where(
      and(
        eq(waSessionPersonas.waSessionId, waSessionId),
        eq(waSessionPersonas.personaId, chosen.id),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(waSessionPersonas)
      .set({
        usedCount: existing.usedCount + 1,
        lastUsedAt: now,
      })
      .where(eq(waSessionPersonas.id, existing.id));
  } else {
    await db.insert(waSessionPersonas).values({
      waSessionId,
      personaId: chosen.id,
      usedCount: 1,
      lastUsedAt: now,
    });
  }

  await db
    .update(waSessions)
    .set({
      currentPersonaId: chosen.id,
      personaRotationCount:
        chosen.id === session.currentPersonaId
          ? session.personaRotationCount + 1
          : 1,
      updatedAt: now,
    })
    .where(eq(waSessions.id, waSessionId));

  return chosen.id;
}
