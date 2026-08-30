import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Modal } from "@/components/ui/modal";
import { getLocalizedCustomerError } from "./customer-error";
import { useCreateCustomer } from "./customer-hooks";
import { customerFormSchema, type CustomerFormValues } from "./customer.schemas";

export interface CustomerCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CustomerCreateModal({
  open,
  onOpenChange,
  onSuccess,
}: CustomerCreateModalProps) {
  const { t } = useTranslation();
  const create = useCreateCustomer();
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    reset,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: { name: "", email: "", phone: "" },
  });

  const handleClose = () => {
    reset();
    setApiError(null);
    onOpenChange(false);
  };

  const submit = handleSubmit(async (values) => {
    setApiError(null);
    try {
      await create.mutateAsync(values);
      handleClose();
      onSuccess?.();
    } catch (error) {
      setApiError(getLocalizedCustomerError(error, t("customers.saveError"), t));
    }
  });

  const pending = isSubmitting || create.isPending;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t("customers.createTitle")}
      description={t("customers.formDescription")}
      maxWidth="lg"
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        {apiError && (
          <p
            className="rounded-md border border-danger-subtle bg-danger-subtle/50 p-3 text-xs text-danger-foreground"
            role="alert"
          >
            {apiError}
          </p>
        )}

        <div>
          <label htmlFor="modal-customer-name" className="block text-xs font-medium text-foreground">
            {t("customers.name")} <span className="text-danger">*</span>
          </label>
          <input
            id="modal-customer-name"
            className="input mt-1"
            autoComplete="name"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "modal-customer-name-error" : undefined}
            {...register("name")}
          />
          {errors.name?.message && (
            <p id="modal-customer-name-error" role="alert" className="mt-1 text-xs text-danger">
              {t(errors.name.message)}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="modal-customer-email" className="block text-xs font-medium text-foreground">
            {t("customers.email")} <span className="text-danger">*</span>
          </label>
          <input
            id="modal-customer-email"
            className="input mt-1 text-start"
            dir="ltr"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "modal-customer-email-error" : undefined}
            {...register("email")}
          />
          {errors.email?.message && (
            <p id="modal-customer-email-error" role="alert" className="mt-1 text-xs text-danger">
              {t(errors.email.message)}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="modal-customer-phone" className="block text-xs font-medium text-foreground">
            {t("customers.phoneOptional")}
          </label>
          <input
            id="modal-customer-phone"
            className="input mt-1 text-start"
            dir="ltr"
            type="tel"
            autoComplete="tel"
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? "modal-customer-phone-error" : undefined}
            {...register("phone")}
          />
          {errors.phone?.message && (
            <p id="modal-customer-phone-error" role="alert" className="mt-1 text-xs text-danger">
              {t(errors.phone.message)}
            </p>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="button-secondary text-xs"
            disabled={pending}
            onClick={handleClose}
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            className="button-link text-xs"
            disabled={pending}
          >
            {pending ? t("common.saving") : t("common.save")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
