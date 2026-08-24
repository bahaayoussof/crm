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
    return <CustomerPage><StatePanel>{error.status === 404 ? t("customers.notFound") : error.message}</StatePanel></CustomerPage>;
  }

  return <CustomerPage>
    <PageHeader title={isEditing ? t("customers.editTitle") : t("customers.createTitle")} description={t("customers.formDescription")} />
    <form className="mt-8 max-w-xl space-y-5 rounded-md border bg-white p-5 sm:p-6" onSubmit={submit} noValidate>
      {apiError && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{apiError}</p>}
      <FormField label={t("customers.name")} error={errors.name?.message ? t(errors.name.message) : undefined}><input className="input" autoComplete="name" {...register("name")} /></FormField>
      <FormField label={t("customers.email")} error={errors.email?.message ? t(errors.email.message) : undefined}><input className="input" type="email" autoComplete="email" {...register("email")} /></FormField>
      <FormField label={t("customers.phoneOptional")} error={errors.phone?.message ? t(errors.phone.message) : undefined}><input className="input" type="tel" autoComplete="tel" {...register("phone")} /></FormField>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Link className="button-secondary text-center" to={isEditing ? `/customers/${id}` : "/customers"}>{t("common.cancel")}</Link><button className="button-link" type="submit" disabled={isSubmitting}>{isSubmitting ? t("common.saving") : t("common.save")}</button></div>
    </form>
  </CustomerPage>;
}

function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <label className="block text-sm font-medium">{label}<span className="mt-2 block">{children}</span>{error && <span className="mt-1 block text-sm text-red-600">{error}</span>}</label>;
}
