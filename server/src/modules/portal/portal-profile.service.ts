import { Prisma, type Role } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "../audit-logs/audit-log.constants.js";
import type { AuditRequestContext } from "../audit-logs/audit-request-context.js";
import { changedFields, createAuditLog } from "../audit-logs/audit-log.service.js";
import type { PortalProfileUpdateInput } from "./portal.schema.js";

export type PortalProfile = {
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  createdAt: string;
  passwordChangedAt: string | null;
};

async function ownCustomer(userId: string) {
  const customer = await prisma.customer.findUnique({
    where: { userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      createdAt: true,
      user: { select: { role: true, passwordChangedAt: true } },
    },
  });
  if (!customer) {
    throw new AppError(403, "CUSTOMER_PROFILE_REQUIRED", "A linked customer profile is required");
  }
  return customer;
}

type OwnCustomer = Awaited<ReturnType<typeof ownCustomer>>;

function toPortalProfile(customer: OwnCustomer, phone: string | null): PortalProfile {
  return {
    name: customer.name,
    email: customer.email,
    phone,
    role: customer.user?.role ?? "CUSTOMER",
    createdAt: customer.createdAt.toISOString(),
    passwordChangedAt: customer.user?.passwordChangedAt
      ? customer.user.passwordChangedAt.toISOString()
      : null,
  };
}

export async function getProfile(userId: string): Promise<PortalProfile> {
  const customer = await ownCustomer(userId);
  return toPortalProfile(customer, customer.phone);
}

export async function updateProfile(
  userId: string,
  input: PortalProfileUpdateInput,
  requestContext?: AuditRequestContext,
): Promise<PortalProfile> {
  const current = await ownCustomer(userId);

  const nextName = input.name;
  const nextEmail = input.email;
  const nextPhone = input.phone === undefined ? current.phone : input.phone;

  if (nextEmail !== current.email) {
    const [userClash, customerClash] = await Promise.all([
      prisma.user.findFirst({ where: { email: nextEmail, NOT: { id: userId } }, select: { id: true } }),
      prisma.customer.findFirst({ where: { email: nextEmail, NOT: { userId } }, select: { id: true } }),
    ]);
    if (userClash || customerClash) {
      throw new AppError(409, "EMAIL_IN_USE", "This email is already in use");
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id: current.id },
        data: { name: nextName, email: nextEmail, phone: nextPhone },
      });
      await tx.user.update({
        where: { id: userId },
        data: { name: nextName, email: nextEmail, phone: nextPhone },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError(409, "EMAIL_IN_USE", "This email is already in use");
    }
    throw error;
  }

  const next: PortalProfile = {
    ...toPortalProfile(current, nextPhone),
    name: nextName,
    email: nextEmail,
  };
  await createAuditLog({
    actorId: userId,
    action: AUDIT_ACTIONS.PROFILE_UPDATED,
    entityType: AUDIT_ENTITY_TYPES.CUSTOMER,
    entityId: current.id,
    changes: changedFields(
      { name: current.name, email: current.email, phone: current.phone },
      { name: nextName, email: nextEmail, phone: nextPhone },
      ["name", "email", "phone"],
    ),
    requestContext,
  });

  return next;
}
