import { z } from "zod";

export const env = z
  .object({
    DATABASE_URL: z.string(),
    REDIS_URL: z.string().default("redis://localhost:6379"),
    WA_GATEWAY_URL: z.string().default("http://localhost:5001"),
    WA_GATEWAY_KEY: z.string().default(""),
    JWT_SECRET: z.string().default("dev-secret"),
    ANTHROPIC_API_KEY: z.string().optional(),
    PORT: z
      .string()
      .default("3000")
      .transform((v) => Number(v)),
  })
  .parse(process.env);
