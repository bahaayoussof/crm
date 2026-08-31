import { describe, expect, it } from "vitest";
import { databaseIdSchema, emailSchema, nullableDatabaseIdSchema, passwordSchema } from "./common.schema.js";
import { paginationFields } from "./pagination.schema.js";
import { z } from "zod";

describe("shared validation schemas", () => {
  it("accepts Prisma CUIDs and rejects malformed database identifiers", () => {
    expect(databaseIdSchema.parse("ckz6q7m8n0000abcd1234efgh")).toBe("ckz6q7m8n0000abcd1234efgh");
    expect(databaseIdSchema.safeParse("ticket-1").success).toBe(false);
    expect(databaseIdSchema.safeParse(" ").success).toBe(false);
  });

  it("trims and lowercases valid email addresses and rejects malformed ones", () => {
    expect(emailSchema.parse("  User@Example.COM ")).toBe("user@example.com");
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
    expect(emailSchema.safeParse(`${"a".repeat(250)}@example.com`).success).toBe(false);
  });

  it("applies the same password bounds wherever composed", () => {
    expect(passwordSchema.safeParse("1234567").success).toBe(false);
    expect(passwordSchema.safeParse("12345678").success).toBe(true);
    expect(passwordSchema.safeParse("x".repeat(128)).success).toBe(true);
    expect(passwordSchema.safeParse("x".repeat(129)).success).toBe(false);
  });

  it("normalizes nullable database identifiers (CUID, empty string, null) and rejects malformed ids", () => {
    expect(nullableDatabaseIdSchema.parse("ckz6q7m8n0000abcd1234efgh")).toBe("ckz6q7m8n0000abcd1234efgh");
    expect(nullableDatabaseIdSchema.parse("")).toBeNull();
    expect(nullableDatabaseIdSchema.parse(null)).toBeNull();
    expect(nullableDatabaseIdSchema.parse(undefined)).toBeUndefined();
    expect(nullableDatabaseIdSchema.safeParse("ticket-1").success).toBe(false);
  });

  it("coerces bounded integer pagination query strings", () => {
    const schema = z.object(paginationFields(15, 50)).strict();
    expect(schema.parse({ page: "2", limit: "25" })).toEqual({ page: 2, limit: 25 });
    expect(schema.safeParse({ page: "0", limit: "25" }).success).toBe(false);
    expect(schema.safeParse({ page: "1.5", limit: "25" }).success).toBe(false);
    expect(schema.safeParse({ page: "1", limit: "51" }).success).toBe(false);
  });
});
