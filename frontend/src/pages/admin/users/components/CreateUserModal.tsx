import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { PasswordField } from "@/components/ui/PasswordField";
import * as usersService from "@/services/admin/users.service";
import { ASSIGNABLE_ROLE_OPTIONS, ROLE_ID } from "@/utils/roles";
import { generateDefaultPassword } from "@/utils/password";
import { getApiErrorMessage } from "@/lib/axios";
import { useAuth } from "@/hooks/useAuth";

interface CreateUserFormValues {
  email: string;
  full_name: string;
  phone: string;
  password: string;
  role_id: string;
  designation: string;
}

const EMPTY_FORM: CreateUserFormValues = {
  email: "",
  full_name: "",
  phone: "",
  password: "",
  role_id: "",
  designation: "",
};

const SUPPORT_STAFF_ROLE_ID = String(ROLE_ID.support_staff);

export function CreateUserModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  // Principal Management restriction: a principal can create any user except
  // another principal — only a School Admin can create Principal accounts.
  const isPrincipalActor = hasRole("principal") && !hasRole("school_admin") && !hasRole("super_admin");
  const roleOptions = isPrincipalActor
    ? ASSIGNABLE_ROLE_OPTIONS.filter((o) => o.value !== String(ROLE_ID.principal) && o.value !== String(ROLE_ID.school_admin))
    : ASSIGNABLE_ROLE_OPTIONS;
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserFormValues>({ defaultValues: EMPTY_FORM });

  const isSupportStaff = watch("role_id") === SUPPORT_STAFF_ROLE_ID;

  const createMutation = useMutation({
    mutationFn: (values: CreateUserFormValues) =>
      usersService.createUser({
        ...values,
        password: values.password || undefined,
        role_id: Number(values.role_id),
        designation: values.designation || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      reset(EMPTY_FORM);
      onClose();
    },
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add user">
      <form className="space-y-4" onSubmit={handleSubmit((values) => createMutation.mutate(values))}>
        <Input
          label="Full name"
          error={errors.full_name?.message}
          {...register("full_name", { required: "Full name is required" })}
        />
        <Input
          label="Email"
          type="email"
          error={errors.email?.message}
          {...register("email", { required: "Email is required" })}
        />
        <Input label="Phone (optional)" {...register("phone")} />
        <Select
          label="Role"
          placeholder="Select a role"
          options={roleOptions}
          error={errors.role_id?.message}
          {...register("role_id", { required: "Role is required" })}
        />
        {isSupportStaff && (
          <Input
            label="Designation"
            placeholder="e.g. Cleaner, Ayya, Peon, Security Guard"
            error={errors.designation?.message}
            {...register("designation", { required: "Designation is required for support staff" })}
          />
        )}
        <PasswordField
          value={watch("password")}
          onChange={(v) => setValue("password", v)}
          onGenerate={() => setValue("password", generateDefaultPassword(getValues("full_name"), getValues("phone")))}
        />
        {createMutation.isError && (
          <p className="text-sm text-red-600">{getApiErrorMessage(createMutation.error, "Failed to create user. Please try again.")}</p>
        )}
        <Button type="submit" className="w-full" isLoading={isSubmitting || createMutation.isPending}>
          Create user
        </Button>
      </form>
    </Modal>
  );
}
