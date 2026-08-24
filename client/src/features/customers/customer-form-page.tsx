import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getCustomerError, getLocalizedCustomerError } from "./customer-error";
import { useCreateCustomer, useCustomer, useUpdateCustomer } from "./customer-hooks";
import { customerFormSchema, type CustomerFormValues } from "./customer.schemas";
import { CustomerPage, LoadingRows, PageHeader, StatePanel } from "./customer-ui";

export function CustomerFormPage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const isEditing = Boolean(id);
  const customer = useCustomer(id);
  const create = useCreateCustomer();
  const update = useUpdateCustomer(id);
  const navigate = useNavigate();
  const [apiError, setApiError] = useState<string | null>(null);
  const { register, reset, handleSubmit, formState: { errors, isSubmitting } } = useForm<CustomerFormValues>({ resolver: zodResolver(customerFormSchema), defaultValues: { name: "", email: "", phone: "" } });

  useEffect(() => { if (customer.data) reset({ name: customer.data.name, email: customer.data.email, phone: customer.data.phone ?? "" }); }, [customer.data, reset]);

  const submit = handleSubmit(async (values) => {
    setApiError(null);
    try {
      const saved = isEditing ? await update.mutateAsync(values) : await create.mutateAsync(values);
      navigate(`/customers/${saved.id}`, { replace: true });
    } catch (error) { setApiError(getLocalizedCustomerError(error, t("customers.saveError"), t)); }
  });

  if (isEditing && customer.isLoading) return <CustomerPage><LoadingRows /></CustomerPage>;
  if (isEditing && customer.isError) {
    const error = getCustomerError(customer.error, t("customers.loadError"));
    return <CustomerPage><StatePanel>{error.status === 404 ? t("customers.notFound") : getLocalizedCustomerError(customer.error, t("customers.loadError"), t)}</StatePanel></CustomerPage>;
  }

  return <CustomerPage>
    <PageHeader title={isEditing ? t("customers.editTitle") : t("customers.createTitle")} description={t("customers.formDescription")} />
    <form className="mt-6 max-w-2xl rounded-md border bg-white" onSubmit={submit} noValidate>
      <div className="space-y-5 p-5 sm:p-6">
      {apiError && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{apiError}</p>}
      <FormField id="customer-name" label={t("customers.name")} error={errors.name?.message ? t(errors.name.message) : undefined}><input id="customer-name" className="input" autoComplete="name" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "customer-name-error" : undefined} {...register("name")} /></FormField>
      <FormField id="customer-email" label={t("customers.email")} error={errors.email?.message ? t(errors.email.message) : undefined}><input id="customer-email" className="input text-start" dir="ltr" type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "customer-email-error" : undefined} {...register("email")} /></FormField>
      <FormField id="customer-phone" label={t("customers.phoneOptional")} error={errors.phone?.message ? t(errors.phone.message) : undefined}><input id="customer-phone" className="input text-start" dir="ltr" type="tel" autoComplete="tel" aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? "customer-phone-error" : undefined} {...register("phone")} /></FormField>
      </div>
      <div className="flex flex-col-reverse gap-3 border-t bg-muted/40 px-5 py-4 sm:flex-row sm:justify-end sm:px-6"><Link className="button-secondary text-center" to={isEditing ? `/customers/${id}` : "/customers"}>{t("common.cancel")}</Link><button className="button-link" type="submit" disabled={isSubmitting}>{isSubmitting ? t("common.saving") : t("common.save")}</button></div>
    </form>
  </CustomerPage>;
}

function FormField({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return <div><label className="block text-sm font-medium" htmlFor={id}>{label}</label><div className="mt-2">{children}</div>{error && <p id={`${id}-error`} className="mt-1.5 text-sm text-red-700">{error}</p>}</div>;
}
