import { apiClient } from "@/services/api-client";
import type { CustomerFormValues, CustomerNoteValues } from "./customer.schemas";
import type { CustomerDetail, CustomerFilters, CustomerListResponse, CustomerNote, CustomerRecord } from "./customer.types";

export async function getCustomers(filters: CustomerFilters) {
  const response = await apiClient.get<CustomerListResponse>("/customers", { params: filters });
  return response.data;
}

export async function getCustomer(customerId: string) {
  const response = await apiClient.get<{ data: CustomerDetail }>(`/customers/${customerId}`);
  return response.data.data;
}

export async function createCustomer(values: CustomerFormValues) {
  const response = await apiClient.post<{ data: CustomerRecord }>("/customers", { ...values, phone: values.phone || null });
  return response.data.data;
}

export async function updateCustomer(customerId: string, values: CustomerFormValues) {
  const response = await apiClient.patch<{ data: CustomerRecord }>(`/customers/${customerId}`, { ...values, phone: values.phone || null });
  return response.data.data;
}

export async function deleteCustomer(customerId: string) {
  await apiClient.delete(`/customers/${customerId}`);
}

export async function getCustomerNotes(customerId: string) {
  const response = await apiClient.get<{ data: CustomerNote[] }>(`/customers/${customerId}/notes`);
  return response.data.data;
}

export async function createCustomerNote(customerId: string, values: CustomerNoteValues) {
  const response = await apiClient.post<{ data: CustomerNote }>(`/customers/${customerId}/notes`, values);
  return response.data.data;
}
