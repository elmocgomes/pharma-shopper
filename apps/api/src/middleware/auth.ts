import { createMiddleware } from "hono/factory";
import jwt from "jsonwebtoken";
import { env } from "../env.js";
import type { AppEnv } from "../server.js";

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const payload = jwt.verify(header.slice(7), env.JWT_SECRET) as {
      sub: string;
    };
    c.set("userId", payload.sub);
    await next();
  } catch {
    return c.json({ error: "Invalid token" }, 401);
  }
});
