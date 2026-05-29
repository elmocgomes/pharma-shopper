import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import type { AppEnv } from "../server.js";

// In-memory settings (in production, store in DB or env)
// These are defaults that can be overridden at runtime
let appSettings = {
  ai: {
    model: "claude-sonnet-4-20250514",
    maxTokens: 300,
    parseMaxTokens: 1024,
  },
  campaign: {
    defaultRateLimitPerHour: 10,
    businessHoursStart: "08:00",
    businessHoursEnd: "18:00",
    maxFollowUps: 2,
    responseTimeoutMinutes: 30,
  },
  persona: {
    rotationThreshold: 5,
  },
  antiDetection: {
    minDelaySeconds: 30,
    maxDelaySeconds: 300,
    warmupDays: 3,
    warmupDailyLimit: 10,
    dailyMessageLimit: 50,
  },
};

export type AppSettings = typeof appSettings;

export function getSettings(): AppSettings {
  return appSettings;
}

const settingsSchema = z.object({
  ai: z.object({
    model: z.string().min(1),
    maxTokens: z.number().int().positive(),
    parseMaxTokens: z.number().int().positive(),
  }).optional(),
  campaign: z.object({
    defaultRateLimitPerHour: z.number().int().positive(),
    businessHoursStart: z.string(),
    businessHoursEnd: z.string(),
    maxFollowUps: z.number().int().min(0),
    responseTimeoutMinutes: z.number().int().positive(),
  }).optional(),
  persona: z.object({
    rotationThreshold: z.number().int().positive(),
  }).optional(),
  antiDetection: z.object({
    minDelaySeconds: z.number().int().positive(),
    maxDelaySeconds: z.number().int().positive(),
    warmupDays: z.number().int().min(0),
    warmupDailyLimit: z.number().int().positive(),
    dailyMessageLimit: z.number().int().positive(),
  }).optional(),
});

export const settingsRoutes = new Hono<AppEnv>()
  .use(requireAuth)

  .get("/", async (c) => {
    return c.json({ data: appSettings });
  })

  .put("/", async (c) => {
    const parsed = settingsSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

    const update = parsed.data;
    if (update.ai) appSettings.ai = { ...appSettings.ai, ...update.ai };
    if (update.campaign) appSettings.campaign = { ...appSettings.campaign, ...update.campaign };
    if (update.persona) appSettings.persona = { ...appSettings.persona, ...update.persona };
    if (update.antiDetection) appSettings.antiDetection = { ...appSettings.antiDetection, ...update.antiDetection };

    return c.json({ data: appSettings });
  });
