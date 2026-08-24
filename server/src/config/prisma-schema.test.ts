import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

const datamodel = Prisma.dmmf.datamodel;

function model(name: string) {
  const result = datamodel.models.find((candidate) => candidate.name === name);
  expect(result, `Expected Prisma model ${name}`).toBeDefined();
  return result!;
}

describe("CRM Prisma schema", () => {
  it("contains the documented domain models and enums", () => {
    expect(datamodel.models.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "User",
        "Customer",
        "Ticket",
        "TicketMessage",
        "TicketNote",
        "CustomerNote",
        "Attachment",
        "Category",
        "TicketHistory",
        "SlaRule",
        "KnowledgeArticle",
        "Notification",
        "Feedback",
        "QuickReply",
        "Department",
        "Branch",
      ]),
    );

    expect(datamodel.enums.find(({ name }) => name === "Role")?.values.map(({ name }) => name)).toEqual([
      "ADMIN",
      "MANAGER",
      "AGENT",
      "CUSTOMER",
    ]);
    expect(
      datamodel.enums.find(({ name }) => name === "TicketStatus")?.values.map(({ name }) => name),
    ).toContain("ESCALATED");
  });

  it("keeps customer identity and message authorship unambiguous", () => {
    expect(model("Customer").fields.find(({ name }) => name === "userId")?.isUnique).toBe(true);

    const messageFields = model("TicketMessage").fields;
    expect(messageFields.find(({ name }) => name === "authorUserId")?.isRequired).toBe(true);
    expect(messageFields.some(({ name }) => name === "authorCustomerId")).toBe(false);
    expect(messageFields.some(({ name }) => name === "isInternal")).toBe(false);
  });

  it("separates customer notes and supports SLA response reporting", () => {
    const customerNoteFields = model("CustomerNote").fields;
    expect(customerNoteFields.find(({ name }) => name === "customerId")?.isRequired).toBe(true);
    expect(customerNoteFields.find(({ name }) => name === "authorUserId")?.isRequired).toBe(true);
    expect(model("Ticket").fields.some(({ name }) => name === "firstRespondedAt")).toBe(true);
  });

  it("supports customer attachment context and branch-scoped departments", () => {
    expect(model("Attachment").fields.some(({ name }) => name === "customerId")).toBe(true);
    expect(model("Department").uniqueFields).toContainEqual(["branchId", "name"]);
  });

  it("enforces one feedback record and one SLA rule per key", () => {
    expect(model("Feedback").fields.find(({ name }) => name === "ticketId")?.isUnique).toBe(true);
    expect(model("SlaRule").fields.find(({ name }) => name === "priority")?.isUnique).toBe(true);
  });
});
