import { describe, expect, it } from "vitest";
import { customerFormSchema, customerNoteSchema } from "./customer.schemas";

describe("customer form contracts", () => {
  it("normalizes valid input and rejects unknown fields", () => {
    const parsed = customerFormSchema.parse({ name: " Ahmed ", email: " AHMED@Example.com ", phone: " +201000000000 " });
    expect(parsed).toEqual({ name: "Ahmed", email: "ahmed@example.com", phone: "+201000000000" });
    expect(customerFormSchema.safeParse({ ...parsed, userId: "forbidden" }).success).toBe(false);
  });

  it("requires useful customer and note values", () => {
    expect(customerFormSchema.safeParse({ name: "A", email: "invalid", phone: "" }).success).toBe(false);
    expect(customerNoteSchema.safeParse({ body: "   " }).success).toBe(false);
  });
});
