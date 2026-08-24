import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createCustomer, createCustomerNote, deleteCustomer, getCustomer, getCustomerNotes, getCustomers, updateCustomer } from "./customer-api";
import type { CustomerFormValues, CustomerNoteValues } from "./customer.schemas";
import type { CustomerFilters } from "./customer.types";

export const customerKeys = {
  all: ["customers"] as const,
  lists: () => [...customerKeys.all, "list"] as const,
  list: (filters: CustomerFilters) => [...customerKeys.lists(), filters] as const,
  details: () => [...customerKeys.all, "detail"] as const,
  detail: (id: string) => [...customerKeys.details(), id] as const,
  notes: (id: string) => [...customerKeys.detail(id), "notes"] as const,
};

export const useCustomers = (filters: CustomerFilters) => useQuery({ queryKey: customerKeys.list(filters), queryFn: () => getCustomers(filters) });
export const useCustomer = (id: string) => useQuery({ queryKey: customerKeys.detail(id), queryFn: () => getCustomer(id), enabled: Boolean(id), retry: false });
export const useCustomerNotes = (id: string) => useQuery({ queryKey: customerKeys.notes(id), queryFn: () => getCustomerNotes(id), enabled: Boolean(id), retry: false });

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: createCustomer, onSuccess: () => queryClient.invalidateQueries({ queryKey: customerKeys.lists() }) });
}

export function useUpdateCustomer(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: CustomerFormValues) => updateCustomer(id, values),
    onSuccess: (customer) => { queryClient.setQueryData(customerKeys.detail(id), customer); queryClient.invalidateQueries({ queryKey: customerKeys.lists() }); },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: deleteCustomer, onSuccess: () => queryClient.invalidateQueries({ queryKey: customerKeys.all }) });
}

export function useCreateCustomerNote(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: CustomerNoteValues) => createCustomerNote(id, values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: customerKeys.notes(id) }),
  });
}
