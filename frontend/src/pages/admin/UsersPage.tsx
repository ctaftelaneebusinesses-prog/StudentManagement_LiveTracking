import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import * as usersService from "@/services/admin/users.service";
import { AdminUser } from "@/types/admin.types";
import { ASSIGNABLE_ROLE_OPTIONS, ROLE_LABEL } from "@/utils/roles";

export function UsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [userPendingDeactivation, setUserPendingDeactivation] = useState<AdminUser | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users", { search }],
    queryFn: () => usersService.fetchUsers({ search: search || undefined, page: 1, pageSize: 50 }),
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { email: "", full_name: "", phone: "", role_id: "" },
  });

  const createMutation = useMutation({
    mutationFn: (values: { email: string; full_name: string; phone: string; role_id: string }) =>
      usersService.inviteUser({ ...values, role_id: Number(values.role_id) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      reset();
      setCreateOpen(false);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: usersService.deactivateUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      setUserPendingDeactivation(null);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Users</h1>
        <Button onClick={() => setCreateOpen(true)}>Invite user</Button>
      </div>

      <Input
        label="Search"
        placeholder="Search by name or email"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <DataTable<AdminUser>
        isLoading={isLoading}
        rows={data?.items ?? []}
        rowKey={(u) => u.id}
        emptyMessage="No users found."
        columns={[
          { header: "Name", cell: (u) => u.full_name },
          { header: "Email", cell: (u) => u.email },
          { header: "Role", cell: (u) => ROLE_LABEL[u.roles.name] },
          {
            header: "Status",
            cell: (u) =>
              u.is_active ? (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  Active
                </span>
              ) : (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  Inactive
                </span>
              ),
          },
          {
            header: "",
            cell: (u) =>
              u.is_active && (
                <Button
                  variant="ghost"
                  className="!px-2 !py-1 text-xs text-red-600"
                  onClick={() => setUserPendingDeactivation(u)}
                >
                  Deactivate
                </Button>
              ),
          },
        ]}
      />

      <Modal isOpen={isCreateOpen} onClose={() => setCreateOpen(false)} title="Invite user">
        <form
          className="space-y-4"
          onSubmit={handleSubmit((values) => createMutation.mutate(values))}
        >
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
            options={ASSIGNABLE_ROLE_OPTIONS}
            error={errors.role_id?.message}
            {...register("role_id", { required: "Role is required" })}
          />
          {createMutation.isError && (
            <p className="text-sm text-red-600">
              Failed to invite user. The email may already be registered.
            </p>
          )}
          <p className="text-xs text-slate-500">
            The user will receive an email invite to set their own password — no password is created here.
          </p>
          <Button type="submit" className="w-full" isLoading={isSubmitting || createMutation.isPending}>
            Send invite
          </Button>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!userPendingDeactivation}
        title="Deactivate user"
        message={`Are you sure you want to deactivate ${userPendingDeactivation?.full_name}? They will no longer be able to sign in.`}
        confirmLabel="Deactivate"
        isLoading={deactivateMutation.isPending}
        onConfirm={() => userPendingDeactivation && deactivateMutation.mutate(userPendingDeactivation.id)}
        onCancel={() => setUserPendingDeactivation(null)}
      />
    </div>
  );
}
