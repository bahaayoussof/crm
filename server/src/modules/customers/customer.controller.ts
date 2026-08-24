import type { RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import type { CreateCustomerInput, CreateCustomerNoteInput, CustomerListQuery, CustomerParams, UpdateCustomerInput } from "./customer.schema.js";
import { addCustomerNote, createCustomer, deleteCustomer, getCustomer, listCustomerNotes, listCustomers, updateCustomer } from "./customer.service.js";

export const list: RequestHandler = async (_request, response) => {
  const result = await listCustomers(response.locals.validatedQuery as CustomerListQuery);
  response.status(200).json(result);
};

export const detail: RequestHandler = async (_request, response) => {
  const { id } = response.locals.validatedParams as CustomerParams;
  response.status(200).json({ data: await getCustomer(id) });
};

export const create: RequestHandler<unknown, unknown, CreateCustomerInput> = async (request, response) => {
  response.status(201).json({ data: await createCustomer(request.body) });
};

export const update: RequestHandler<unknown, unknown, UpdateCustomerInput> = async (request, response) => {
  const { id } = response.locals.validatedParams as CustomerParams;
  response.status(200).json({ data: await updateCustomer(id, request.body) });
};

export const remove: RequestHandler = async (_request, response) => {
  const { id } = response.locals.validatedParams as CustomerParams;
  await deleteCustomer(id);
  response.status(204).send();
};

export const notes: RequestHandler = async (_request, response) => {
  const { id } = response.locals.validatedParams as CustomerParams;
  response.status(200).json({ data: await listCustomerNotes(id) });
};

export const addNote: RequestHandler<unknown, unknown, CreateCustomerNoteInput> = async (request, response) => {
  if (!request.auth) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
  const { id } = response.locals.validatedParams as CustomerParams;
  response.status(201).json({ data: await addCustomerNote(id, request.auth.userId, request.body.body) });
};
