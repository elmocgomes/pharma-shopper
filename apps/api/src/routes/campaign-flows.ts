import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { Queue } from "bullmq";
import {
  campaigns,
  campaignFlows,
  conversationFlows,
  personaStyleEnum,
} from "@pharma-shopper/db";
import { requireAuth } from "../middleware/auth.js";
import { env } from "../env.js";
import type { AppEnv } from "../server.js";

const calibrateQueue = new Queue("calibrate", {
  connection: { url: env.REDIS_URL },
});

export const campaignFlowRoutes = new Hono<AppEnv>()
  .use(requireAuth)

  // List campaign flows with calibration status
  .get("/:id/flows", async (c) => {
    const db = c.get("db");
    const data = await db
      .select()
      .from(campaignFlows)
      .where(eq(campaignFlows.campaignId, c.req.param("id")))
      .orderBy(campaignFlows.personaStyle);
    return c.json({ data });
  })

  // Get diff for a specific style
  .get("/:id/flows/:style/diff", async (c) => {
    const db = c.get("db");
    const style = c.req.param("style") as typeof personaStyleEnum.enumValues[number];

    const [flow] = await db
      .select()
      .from(campaignFlows)
      .where(
        and(
          eq(campaignFlows.campaignId, c.req.param("id")),
          eq(campaignFlows.personaStyle, style),
        ),
      )
      .limit(1);
    if (!flow) return c.json({ error: "Not found" }, 404);

    // Load base flow for comparison
    const [baseFlow] = await db
      .select()
      .from(conversationFlows)
      .where(eq(conversationFlows.id, flow.baseFlowId))
      .limit(1);

    return c.json({
      data: {
        personaStyle: style,
        calibrationStatus: flow.calibrationStatus,
        baseTree: baseFlow?.tree || null,
        calibratedTree: flow.calibratedTree,
        diff: flow.calibrationDiff,
        calibratedAt: flow.calibratedAt,
        approvedAt: flow.approvedAt,
      },
    });
  })

  // Trigger calibration for all persona styles
  .post("/:id/calibrate", async (c) => {
    const db = c.get("db");
    const campaignId = c.req.param("id");

    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);
    if (!campaign) return c.json({ error: "Campaign not found" }, 404);

    // Get active flows for each persona style
    const activeFlows = await db
      .select()
      .from(conversationFlows)
      .where(eq(conversationFlows.isActive, true));

    if (activeFlows.length === 0) {
      return c.json({ error: "No active flows found. Create and activate flows first." }, 400);
    }

    let queued = 0;
    for (const flow of activeFlows) {
      // Create or update campaign_flow record
      const existing = await db
        .select()
        .from(campaignFlows)
        .where(
          and(
            eq(campaignFlows.campaignId, campaignId),
            eq(campaignFlows.personaStyle, flow.personaStyle),
          ),
        )
        .limit(1);

      if (existing.length === 0) {
        await db.insert(campaignFlows).values({
          campaignId,
          baseFlowId: flow.id,
          personaStyle: flow.personaStyle,
          calibrationStatus: "pending",
        });
      } else {
        await db
          .update(campaignFlows)
          .set({
            baseFlowId: flow.id,
            calibrationStatus: "pending",
            calibratedTree: null,
            calibrationDiff: null,
            approvedBy: null,
            approvedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(campaignFlows.id, existing[0].id));
      }

      await calibrateQueue.add("calibrate", {
        campaignId,
        personaStyle: flow.personaStyle,
        baseFlowId: flow.id,
      });
      queued++;
    }

    await db
      .update(campaigns)
      .set({ calibrationStatus: "pending", updatedAt: new Date() })
      .where(eq(campaigns.id, campaignId));

    return c.json({ data: { queued } });
  })

  // Approve a calibrated flow
  .post("/:id/flows/:style/approve", async (c) => {
    const db = c.get("db");
    const style = c.req.param("style") as typeof personaStyleEnum.enumValues[number];
    const userId = c.get("userId");

    const [flow] = await db
      .update(campaignFlows)
      .set({
        approvedBy: userId,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(campaignFlows.campaignId, c.req.param("id")),
          eq(campaignFlows.personaStyle, style),
          eq(campaignFlows.calibrationStatus, "ready"),
        ),
      )
      .returning();
    if (!flow) return c.json({ error: "Not found or not ready for approval" }, 404);

    // Check if all flows are now approved
    const allFlows = await db
      .select()
      .from(campaignFlows)
      .where(eq(campaignFlows.campaignId, c.req.param("id")));

    const allApproved = allFlows.every((f) => f.approvedAt != null);
    if (allApproved) {
      await db
        .update(campaigns)
        .set({ calibrationStatus: "approved", updatedAt: new Date() })
        .where(eq(campaigns.id, c.req.param("id")));
    }

    return c.json({ data: flow });
  })

  // Reject a calibrated flow (re-calibrate)
  .post("/:id/flows/:style/reject", async (c) => {
    const db = c.get("db");
    const style = c.req.param("style") as typeof personaStyleEnum.enumValues[number];

    const [flow] = await db
      .select()
      .from(campaignFlows)
      .where(
        and(
          eq(campaignFlows.campaignId, c.req.param("id")),
          eq(campaignFlows.personaStyle, style),
        ),
      )
      .limit(1);
    if (!flow) return c.json({ error: "Not found" }, 404);

    await db
      .update(campaignFlows)
      .set({
        calibrationStatus: "rejected",
        approvedBy: null,
        approvedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(campaignFlows.id, flow.id));

    // Re-queue calibration
    await calibrateQueue.add("calibrate", {
      campaignId: c.req.param("id"),
      personaStyle: style,
      baseFlowId: flow.baseFlowId,
    });

    return c.json({ data: { requeued: true } });
  });
