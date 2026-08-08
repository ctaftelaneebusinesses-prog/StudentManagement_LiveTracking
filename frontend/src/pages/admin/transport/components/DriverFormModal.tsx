import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { PasswordField } from "@/components/ui/PasswordField";
import { useToast } from "@/components/ui/Toast";
import { getApiErrorMessage } from "@/lib/axios";
import { generateDefaultPassword } from "@/utils/password";
import * as transportService from "@/services/transport.service";
import { Driver } from "@/types/transport.types";

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function DriverPhotoField({ driver, onUploaded }: { driver: Driver; onUploaded: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const uploadMutation = useMutation({
    mutationFn: (file: File) => transportService.uploadDriverPhoto(driver.id, file),
    onSuccess: () => {
      onUploaded();
      toast.success("Photo updated");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to upload photo"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => transportService.deleteDriverPhoto(driver.id),
    onSuccess: () => {
      onUploaded();
      toast.success("Photo removed");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to remove photo"),
  });

  return (
    <div className="flex items-center gap-4 sm:col-span-2">
      {driver.users.avatar_url ? (
        <img src={driver.users.avatar_url} alt={driver.users.full_name} className="h-14 w-14 rounded-full object-cover ring-2 ring-white dark:ring-white/10" />
      ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-lg font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
          {getInitials(driver.users.full_name)}
        </div>
      )}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadMutation.mutate(file);
          }}
        />
        <div className="flex gap-1">
          <Button type="button" variant="ghost" className="!px-2 !py-1 text-xs" isLoading={uploadMutation.isPending} onClick={() => fileInputRef.current?.click()}>
            Change photo
          </Button>
          {driver.users.avatar_url && (
            <Button type="button" variant="ghost" className="!px-2 !py-1 text-xs text-red-600" isLoading={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
              Remove
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

interface DriverFormValues {
  email: string;
  full_name: string;
  phone: string;
  password: string;
  license_number: string;
  license_expiry: string;
  address: string;
  emergency_contact_phone: string;
}

interface DriverFormModalProps {
  isOpen: boolean;
  driver: Driver | null;
  onClose: () => void;
  onSaved: () => void;
}

export function DriverFormModal({ isOpen, driver, onClose, onSaved }: DriverFormModalProps) {
  const queryClient = useQueryClient();
  const isEditMode = !!driver;

  const { register, handleSubmit, reset, watch, setValue, getValues } = useForm<DriverFormValues>({
    defaultValues: { email: "", full_name: "", phone: "", password: "", license_number: "", license_expiry: "", address: "", emergency_contact_phone: "" },
  });

  useEffect(() => {
    if (!isOpen) return;
    reset({
      email: driver?.users.email ?? "",
      full_name: driver?.users.full_name ?? "",
      phone: driver?.users.phone ?? "",
      password: "",
      license_number: driver?.license_number ?? "",
      license_expiry: driver?.license_expiry ?? "",
      address: driver?.address ?? "",
      emergency_contact_phone: driver?.emergency_contact_phone ?? "",
    });
  }, [isOpen, driver, reset]);

  const mutation = useMutation({
    mutationFn: (values: DriverFormValues) =>
      isEditMode
        ? transportService.updateDriver(driver!.id, {
            full_name: values.full_name,
            phone: values.phone || undefined,
            license_number: values.license_number,
            license_expiry: values.license_expiry || undefined,
            address: values.address || undefined,
            emergency_contact_phone: values.emergency_contact_phone || undefined,
          })
        : transportService.createDriver({
            email: values.email,
            full_name: values.full_name,
            phone: values.phone || undefined,
            password: values.password || undefined,
            license_number: values.license_number,
            license_expiry: values.license_expiry || undefined,
          }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transport"] });
      onSaved();
    },
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditMode ? "Edit Driver" : "Add Driver"} size="xl">
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {isEditMode ? (
          <DriverPhotoField driver={driver!} onUploaded={() => void queryClient.invalidateQueries({ queryKey: ["transport"] })} />
        ) : (
          <p className="text-xs text-[var(--ink-muted)] sm:col-span-2">A profile photo can be added once the driver is created.</p>
        )}
        <Input label="Full name" {...register("full_name", { required: true })} />
        <Input label="Email" type="email" disabled={isEditMode} {...register("email", { required: !isEditMode })} />
        <Input label="Phone" {...register("phone")} />
        <Input label="License number" {...register("license_number", { required: true })} />
        <Input label="License expiry" type="date" {...register("license_expiry")} />
        <Input label="Address" {...register("address")} />
        <Input label="Emergency contact phone" {...register("emergency_contact_phone")} />

        {!isEditMode && (
          <div className="sm:col-span-2">
            <PasswordField
              value={watch("password")}
              onChange={(v) => setValue("password", v)}
              onGenerate={() => setValue("password", generateDefaultPassword(getValues("full_name"), getValues("license_number")))}
            />
          </div>
        )}

        {mutation.isError && (
          <p className="sm:col-span-2 text-sm text-red-600">{getApiErrorMessage(mutation.error, "Failed to save driver. Please try again.")}</p>
        )}

        <Button type="submit" className="sm:col-span-2" isLoading={mutation.isPending}>
          {isEditMode ? "Save changes" : "Add driver"}
        </Button>
      </form>
    </Modal>
  );
}
