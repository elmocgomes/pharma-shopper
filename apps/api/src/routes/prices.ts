import { Hono } from "hono";
import { eq, sql, and, gte, lte, desc, type SQL } from "drizzle-orm";
import {
  priceRecords,
  products,
  pharmacies,
} from "@pharma-shopper/db";
import { requireAuth } from "../middleware/auth.js";
import type { AppEnv } from "../server.js";

export const priceRoutes = new Hono<AppEnv>()
  .use(requireAuth)

  .get("/", async (c) => {
    const db = c.get("db");
    const productId = c.req.query("product");
    const pharmacyId = c.req.query("pharmacy");
    const state = c.req.query("state");
    const page = Number(c.req.query("page") || "1");
    const limit = Math.min(Number(c.req.query("limit") || "50"), 100);
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [];
    if (productId) conditions.push(eq(priceRecords.productId, productId));
    if (pharmacyId) conditions.push(eq(priceRecords.pharmacyId, pharmacyId));
    if (state) conditions.push(eq(pharmacies.state, state));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, [{ count }]] = await Promise.all([
      db
        .select({
          record: priceRecords,
          product: products,
          pharmacy: pharmacies,
        })
        .from(priceRecords)
        .innerJoin(products, eq(priceRecords.productId, products.id))
        .innerJoin(pharmacies, eq(priceRecords.pharmacyId, pharmacies.id))
        .where(where)
        .orderBy(desc(priceRecords.collectedAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(priceRecords)
        .innerJoin(pharmacies, eq(priceRecords.pharmacyId, pharmacies.id))
        .where(where),
    ]);

    const result = data.map((r) => ({
      ...r.record,
      product: r.product,
      pharmacy: r.pharmacy,
    }));

    return c.json({ data: result, total: count, page, limit });
  })

  .get("/comparison", async (c) => {
    const db = c.get("db");
    const productId = c.req.query("product");
    const state = c.req.query("state");

    const conditions: SQL[] = [];
    if (productId) conditions.push(eq(priceRecords.productId, productId));
    if (state) conditions.push(eq(pharmacies.state, state));
    conditions.push(sql`${priceRecords.price} is not null`);

    const data = await db
      .select({
        productId: priceRecords.productId,
        productName: products.name,
        pharmacyId: priceRecords.pharmacyId,
        pharmacyName: pharmacies.name,
        pharmacyState: pharmacies.state,
        pharmacyCity: pharmacies.city,
        price: priceRecords.price,
        availability: priceRecords.availability,
        isGeneric: priceRecords.isGeneric,
        brand: priceRecords.brand,
        collectedAt: priceRecords.collectedAt,
      })
      .from(priceRecords)
      .innerJoin(products, eq(priceRecords.productId, products.id))
      .innerJoin(pharmacies, eq(priceRecords.pharmacyId, pharmacies.id))
      .where(and(...conditions))
      .orderBy(priceRecords.price);

    return c.json({ data });
  })

  .get("/summary", async (c) => {
    const db = c.get("db");
    const state = c.req.query("state");

    const conditions: SQL[] = [sql`${priceRecords.price} is not null`];
    if (state) conditions.push(eq(pharmacies.state, state));

    const data = await db
      .select({
        productId: priceRecords.productId,
        productName: products.name,
        avgPrice: sql<string>`round(avg(${priceRecords.price}::numeric), 2)`,
        minPrice: sql<string>`min(${priceRecords.price}::numeric)`,
        maxPrice: sql<string>`max(${priceRecords.price}::numeric)`,
        count: sql<number>`count(*)::int`,
        inStock: sql<number>`count(*) filter (where ${priceRecords.availability} = 'in_stock')::int`,
        outOfStock: sql<number>`count(*) filter (where ${priceRecords.availability} = 'out_of_stock')::int`,
        genericCount: sql<number>`count(*) filter (where ${priceRecords.isGeneric} = true)::int`,
        brandCount: sql<number>`count(*) filter (where ${priceRecords.isGeneric} = false)::int`,
      })
      .from(priceRecords)
      .innerJoin(products, eq(priceRecords.productId, products.id))
      .innerJoin(pharmacies, eq(priceRecords.pharmacyId, pharmacies.id))
      .where(and(...conditions))
      .groupBy(priceRecords.productId, products.name)
      .orderBy(products.name);

    return c.json({ data });
  })

  .get("/by-state", async (c) => {
    const db = c.get("db");
    const productId = c.req.query("product");

    const conditions: SQL[] = [sql`${priceRecords.price} is not null`];
    if (productId) conditions.push(eq(priceRecords.productId, productId));

    const data = await db
      .select({
        state: pharmacies.state,
        avgPrice: sql<string>`round(avg(${priceRecords.price}::numeric), 2)`,
        minPrice: sql<string>`min(${priceRecords.price}::numeric)`,
        maxPrice: sql<string>`max(${priceRecords.price}::numeric)`,
        count: sql<number>`count(*)::int`,
      })
      .from(priceRecords)
      .innerJoin(pharmacies, eq(priceRecords.pharmacyId, pharmacies.id))
      .where(and(...conditions))
      .groupBy(pharmacies.state)
      .orderBy(pharmacies.state);

    return c.json({ data });
  })

  .get("/export", async (c) => {
    const db = c.get("db");
    const productId = c.req.query("product");
    const state = c.req.query("state");

    const conditions: SQL[] = [];
    if (productId) conditions.push(eq(priceRecords.productId, productId));
    if (state) conditions.push(eq(pharmacies.state, state));

    const data = await db
      .select({
        productName: products.name,
        activeIngredient: products.activeIngredient,
        pharmacyName: pharmacies.name,
        pharmacyCity: pharmacies.city,
        pharmacyState: pharmacies.state,
        price: priceRecords.price,
        availability: priceRecords.availability,
        brand: priceRecords.brand,
        isGeneric: priceRecords.isGeneric,
        collectedAt: priceRecords.collectedAt,
      })
      .from(priceRecords)
      .innerJoin(products, eq(priceRecords.productId, products.id))
      .innerJoin(pharmacies, eq(priceRecords.pharmacyId, pharmacies.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(products.name, pharmacies.name);

    const header = "Produto,Princípio Ativo,Farmácia,Cidade,Estado,Preço,Disponibilidade,Marca,Genérico,Data\n";
    const rows = data.map((r) =>
      [
        `"${r.productName}"`,
        `"${r.activeIngredient || ""}"`,
        `"${r.pharmacyName}"`,
        `"${r.pharmacyCity || ""}"`,
        `"${r.pharmacyState || ""}"`,
        r.price || "",
        r.availability,
        `"${r.brand || ""}"`,
        r.isGeneric ? "Sim" : "Não",
        r.collectedAt ? new Date(r.collectedAt).toISOString() : "",
      ].join(","),
    );

    c.header("Content-Type", "text/csv; charset=utf-8");
    c.header("Content-Disposition", "attachment; filename=precos.csv");
    return c.body(header + rows.join("\n"));
  });
