import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Search } from "lucide-react";
import * as superAdminService from "@/services/superAdmin.service";
import { SchoolAdmin } from "@/types/superAdmin.types";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { PasswordField } from "@/components/ui/PasswordField";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { isStrongEnough } from "../utils/passwordPolicy";

interface SchoolAdminFormModalProps {
  isOpen: boolean;
  /** Passing an existing admin switches the modal to edit mode. */
  admin?: SchoolAdmin | null;
  onClose: () => void;
}

interface FormState {
  full_name: string;
  email: string;
  phone: string;
  designation: string;
  password: string;
  confirmPassword: string;
  school_ids: string[];
}

const EMPTY_FORM: FormState = {
  full_name: "",
  email: "",
  phone: "",
  designation: "",
  password: "",
  confirmPassword: "",
  school_ids: [],
};

/**
 * §6 — Add / edit a School Admin.
 *
 * On edit the password and email fields are absent by design: email is the
 * Supabase Auth identity (changing it is a separate, riskier flow) and a
 * password is set through the dedicated Reset Password action, which makes
 * the audit entry say what actually happened.
 */
export function SchoolAdminFormModal({ isOpen, admin, onClose }: SchoolAdminFormModalProps) {
  const isEdit = Boolean(admin);
  const toast = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [schoolSearch, setSchoolSearch] = useState("");

  const schoolsQuery = useQuery({
    queryKey: ["super-admin", "schools"],
    queryFn: superAdminService.listSchools,
    enabled: isOpen,
  });

  useEffect(() => {
    if (!isOpen) return;
    setErrors({});
    setSchoolSearch("");
    setForm(
      admin
        ? {
            full_name: admin.full_name,
            email: admin.email,
            phone: admin.phone ?? "",
            designation: admin.designation ?? "",
            password: "",
            confirmPassword: "",
            school_ids: admin.schools.map((s) => s.id),
          }
        : EMPTY_FORM
    );
  }, [isOpen, admin]);

  const createMutation = useMutation({
    mutationFn: superAdminService.createSchoolAdmin,
    onSuccess: (created) => {
      toast.success(`${created.full_name} created and assigned to ${created.schools.length} school(s).`);
      queryClient.invalidateQueries({ queryKey: ["super-admin"] });
      onClose();
    },
    onError: (err: Error) => toast.error(readApiError(err, "Couldn't create the School Admin")),
  });

  const updateMutation = useMutation({
    mutationFn: async (values: FormState) => {
      const updated = await superAdminService.updateSchoolAdmin(admin!.id, {
        full_name: values.full_name,
        phone: values.phone || null,
        designation: values.designation || null,
      });
      // Assignments are a separate endpoint (and a separate audit action), so
      // only call it when the checkbox set actually changed.
      const before = [...admin!.schools.map((s) => s.id)].sort().join(",");
      const after = [...values.school_ids].sort().join(",");
      if (before !== after) return superAdminService.assignSchools(admin!.id, values.school_ids);
      return updated;
    },
    onSuccess: () => {
      toast.success("School Admin updated.");
      queryClient.invalidateQueries({ queryKey: ["super-admin"] });
      onClose();
    },
    onError: (err: Error) => toast.error(readApiError(err, "Couldn't update the School Admin")),
  });

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (form.full_name.trim().length < 2) next.full_name = "Enter the admin's full name";
    if (!isEdit && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) next.email = "Enter a valid email address";
    if (form.phone && form.phone.replace(/\D/g, "").length < 6) next.phone = "Enter a valid mobile number";
    if (form.school_ids.length === 0) next.school_ids = "Assign at least one school";

    if (!isEdit) {
      // Mirrors the backend's `strongPassword` zod schema exactly
      // (validators/superAdmin.validator.ts) so the form never lets through
      // something the API will reject.
      if (!isStrongEnough(form.password)) {
        next.password = "Use at least 10 characters with an uppercase, lowercase, number and symbol";
      }
      if (form.password !== form.confirmPassword) next.confirmPassword = "Passwords do not match";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validate()) return;

    if (isEdit) {
      updateMutation.mutate(form);
    } else {
      createMutation.mutate({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        designation: form.designation.trim() || undefined,
        password: form.password,
        school_ids: form.school_ids,
      });
    }
  }

  function toggleSchool(id: string) {
    setForm((prev) => ({
      ...prev,
      school_ids: prev.school_ids.includes(id)
        ? prev.school_ids.filter((x) => x !== id)
        : [...prev.school_ids, id],
    }));
  }

  const schools = schoolsQuery.data ?? [];
  const visibleSchools = schools.filter((s) => {
    const term = schoolSearch.trim().toLowerCase();
    return !term || s.name.toLowerCase().includes(term) || s.code.toLowerCase().includes(term);
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? "Edit School Admin" : "Add School Admin"} size="xl">
      <form onSubmit={handleSubmit} className="space-y-5">
        <Section title="Personal information">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Full name"
              name="full_name"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              error={errors.full_name}
              autoComplete="off"
            />
            <Input
              label="Email"
              name="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              error={errors.email}
              disabled={isEdit}
              autoComplete="off"
            />
            <Input
              label="Mobile number"
              name="phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              error={errors.phone}
              autoComplete="off"
            />
            <Input
              label="Designation (optional)"
              name="designation"
              value={form.designation}
              onChange={(e) => setForm({ ...form, designation: e.target.value })}
              autoComplete="off"
            />
          </div>
          {isEdit && (
            <p className="mt-2 text-xs text-[var(--ink-muted)]">
              Email is the sign-in identity and can&apos;t be changed here. Use Reset password to issue new credentials.
            </p>
          )}
        </Section>

        {!isEdit && (
          <Section title="Account">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <PasswordField
                value={form.password}
                onChange={(value) => setForm({ ...form, password: value, confirmPassword: value })}
                error={errors.password}
              />
              <div>
                <Input
                  label="Confirm password"
                  name="confirmPassword"
                  type="text"
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  error={errors.confirmPassword}
                  autoComplete="off"
                />
                <p className="mt-1.5 text-xs text-[var(--ink-muted)]">
                  Share this password directly — it is hashed on save and can never be viewed again.
                </p>
              </div>
            </div>
          </Section>
        )}

        <Section title="School assignment">
          <p className="mb-3 text-xs text-[var(--ink-muted)]">
            This admin will be able to manage only the schools ticked here — every other school stays invisible to
            them.
          </p>

          {schools.length > 6 && (
            <div className="relative mb-2">
              <Search
                size={14}
                strokeWidth={1.9}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]"
              />
              <input
                value={schoolSearch}
                onChange={(e) => setSchoolSearch(e.target.value)}
                placeholder="Filter schools…"
                className="w-full rounded-xl border border-black/[0.08] bg-white py-2 pl-8.5 pr-3 text-sm text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-500/20 dark:border-white/[0.1] dark:bg-[#17171a]"
                style={{ paddingLeft: "2.15rem" }}
              />
            </div>
          )}

          {schoolsQuery.isLoading ? (
            <div className="flex justify-center py-6">
              <Spinner label="Loading schools…" />
            </div>
          ) : visibleSchools.length === 0 ? (
            <p className="py-4 text-center text-sm text-[var(--ink-muted)]">No schools match that filter.</p>
          ) : (
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-black/[0.06] p-1.5 dark:border-white/[0.08]">
              {visibleSchools.map((school) => {
                const checked = form.school_ids.includes(school.id);
                return (
                  <label
                    key={school.id}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors ${
                      checked ? "bg-accent-500/[0.08]" : "hover:bg-black/[0.03] dark:hover:bg-white/[0.05]"
                    }`}
                  >
                    <Checkbox checked={checked} onChange={() => toggleSchool(school.id)} />
                    <Building2 size={15} strokeWidth={1.9} className="shrink-0 text-[var(--ink-muted)]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-[var(--ink-primary)]">
                        {school.name}
                      </span>
                      <span className="block truncate text-xs text-[var(--ink-muted)]">
                        {school.code}
                        {school.city ? ` · ${school.city}` : ""}
                        {school.is_active ? "" : " · inactive"}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
          {errors.school_ids && <p className="mt-1.5 text-xs text-red-600">{errors.school_ids}</p>}
          {form.school_ids.length > 0 && (
            <p className="mt-2 text-xs text-[var(--ink-muted)]">
              {form.school_ids.length} school{form.school_ids.length === 1 ? "" : "s"} selected
            </p>
          )}
        </Section>

        <div className="flex justify-end gap-3 border-t border-black/[0.06] pt-4 dark:border-white/[0.08]">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSaving}>
            {isEdit ? "Save changes" : "Create School Admin"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">{title}</h3>
      {children}
    </section>
  );
}

/**
 * Surfaces the backend's own validation message instead of a bare "Request
 * failed with status code 400". Shape comes from error.middleware.ts:
 * `{ success: false, message, details }`.
 */
function readApiError(err: unknown, fallback: string): string {
  const response = (err as { response?: { data?: { message?: string } } })?.response;
  return response?.data?.message ?? (err as Error)?.message ?? fallback;
}
