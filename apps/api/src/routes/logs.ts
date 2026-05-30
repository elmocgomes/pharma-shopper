import { Hono } from "hono";
import { Queue } from "bullmq";
import { requireAuth } from "../middleware/auth.js";
import { env } from "../env.js";
import type { AppEnv } from "../server.js";

const QUEUE_NAMES = ["campaign", "conversation", "parse", "maintenance", "analyst", "calibrate", "monitor"];

export const logRoutes = new Hono<AppEnv>()
  .use(requireAuth)

  .get("/", async (c) => {
    const queueFilter = c.req.query("queue");
    const statusFilter = c.req.query("status") || "all"; // all, completed, failed, active, waiting
    const limit = Math.min(Number(c.req.query("limit") || "50"), 200);

    const queues = (queueFilter ? [queueFilter] : QUEUE_NAMES)
      .filter((q) => QUEUE_NAMES.includes(q));

    const allJobs: Array<{
      id: string;
      queue: string;
      name: string;
      status: string;
      data: unknown;
      result: unknown;
      error: string | null;
      processedOn: number | null;
      finishedOn: number | null;
      timestamp: number;
      duration: number | null;
    }> = [];

    for (const queueName of queues) {
      const queue = new Queue(queueName, { connection: { url: env.REDIS_URL } });
      try {
        const statuses =
          statusFilter === "all"
            ? (["completed", "failed", "active", "waiting", "delayed"] as const)
            : ([statusFilter] as const);

        const jobs = await queue.getJobs(statuses as any, 0, Math.ceil(limit / queues.length), true);

        for (const job of jobs) {
          const state = await job.getState();
          allJobs.push({
            id: job.id || "",
            queue: queueName,
            name: job.name,
            status: state,
            data: job.data,
            result: job.returnvalue,
            error: job.failedReason || null,
            processedOn: job.processedOn || null,
            finishedOn: job.finishedOn || null,
            timestamp: job.timestamp,
            duration:
              job.finishedOn && job.processedOn
                ? job.finishedOn - job.processedOn
                : null,
          });
        }
        await queue.close();
      } catch {
        await queue.close();
      }
    }

    // Sort by most recent first
    allJobs.sort((a, b) => {
      const ta = a.finishedOn || a.processedOn || a.timestamp;
      const tb = b.finishedOn || b.processedOn || b.timestamp;
      return tb - ta;
    });

    return c.json({ data: allJobs.slice(0, limit) });
  })

  .get("/queues", async (c) => {
    const summary: Array<{
      name: string;
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
    }> = [];

    for (const queueName of QUEUE_NAMES) {
      const queue = new Queue(queueName, { connection: { url: env.REDIS_URL } });
      try {
        const counts = await queue.getJobCounts();
        summary.push({
          name: queueName,
          waiting: counts.waiting || 0,
          active: counts.active || 0,
          completed: counts.completed || 0,
          failed: counts.failed || 0,
          delayed: counts.delayed || 0,
        });
        await queue.close();
      } catch {
        summary.push({ name: queueName, waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 });
        await queue.close();
      }
    }

    return c.json({ data: summary });
  });
