import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as pharmaciesSchema from "./schema/pharmacies.js";
import * as productsSchema from "./schema/products.js";
import * as personasSchema from "./schema/personas.js";
import * as waSessionsSchema from "./schema/wa-sessions.js";
import * as campaignsSchema from "./schema/campaigns.js";
import * as conversationsSchema from "./schema/conversations.js";
import * as priceRecordsSchema from "./schema/price-records.js";
import * as messageTemplatesSchema from "./schema/message-templates.js";
import * as usersSchema from "./schema/users.js";

const schema = {
  ...pharmaciesSchema,
  ...productsSchema,
  ...personasSchema,
  ...waSessionsSchema,
  ...campaignsSchema,
  ...conversationsSchema,
  ...priceRecordsSchema,
  ...messageTemplatesSchema,
  ...usersSchema,
};

export function createDb(url: string) {
  const client = postgres(url);
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;
