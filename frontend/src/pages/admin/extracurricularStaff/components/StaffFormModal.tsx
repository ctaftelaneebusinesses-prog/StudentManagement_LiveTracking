import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { DatePicker } from "@/components/ui/DatePicker";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PasswordField } from "@/components/ui/PasswordField";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import * as staffService from "@/services/admin/extracurricularStaff.service";
import * as activitiesService from "@/services/admin/activities.service";
import { ExtracurricularGender, ExtracurricularStaff } from "@/types/extracurricularStaff.types";
import { getApiErrorMessage } from "@/lib/axios";
import { generateDefaultPassword } from "@/utils/password";
import { digitsOnly } from "@/utils/formHelpers";

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

const staffFormSchema = z.object({
  full_name: z.string().min(2, "Full name is required"),
  email: z.string().email("Enter a valid email"),
  phone: z
    .string()
    .optional()
    .refine((v) => !v || /^\d{10}$/.test(v), { message: "Phone number must be exactly 10 digits" }),
  password: z.string().optional(),
  gender: z.string().optional(),
  date_of_birth: z.string().optional(),
  address: z.string().optional(),
  staff_type_activity_id: z.string().min(1, "Select a staff type"),
  qualification: z.string().optional(),
  experience_years: z.string().optional(),
  bio: z.string().optional(),
});
type StaffFormValues = z.infer<typeof staffFormSchema>;

const EMPTY_FORM: StaffFormValues = {
  full_name: "",
  email: "",
  phone: "",
  password: "",
  gender: "",
  date_of_birth: "",
  address: "",
  staff_type_activity_id: "",
  qualification: "",
  experience_years: "",
  bio: "",
};

interface StaffFormModalProps {
  isOpen: boolean;
  mode: "add" | "edit";
  staff: ExtracurricularStaff | null;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Add/Edit modal for extracurricular staff, mirroring TeacherFormModal's
 * react-hook-form + zod pattern. Photo upload and activity assignment are
 * two-step flows: the photo file is held locally and uploaded via
 * uploadExtracurricularStaffPhoto after the staff record is created/updated,
 * and activity assignment (edit mode only, since it needs a staff id) is
 * saved via a separate assignActivities call in the same mutation.
 */
export function StaffFormModal({ isOpen, mode, staff, onClose, onSaved }: StaffFormModalProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<StaffFormValues>({ resolver: zodResolver(staffFormSchema), defaultValues: EMPTY_FORM });

  const { data: activities = [] } = useQuery({
    queryKey: ["admin", "activities", "all"],
    queryFn: () => activitiesService.fetchActivities(),
    enabled: isOpen,
  });

  // Fetch the full profile (edit mode only) to know which activities are
  // already assigned — the list-row `staff` object doesn't carry that.
  const profileQuery = useQuery({
    queryKey: ["admin", "extracurricular-staff", staff?.id, "profile-for-form"],
    queryFn: () => staffService.fetchExtracurricularStaffMember(staff!.id),
    enabled: isOpen && mode === "edit" && !!staff?.id,
  });

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [selectedActivityIds, setSelectedActivityIds] = useState<Set<string>>(new Set());
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (staff) {
      reset({
        full_name: staff.users.full_name,
        email: staff.users.email,
        phone: staff.users.phone ?? "",
        password: "",
        gender: staff.gender ?? "",
        date_of_birth: staff.date_of_birth?.slice(0, 10) ?? "",
        address: staff.address ?? "",
        staff_type_activity_id: staff.staff_type_activity_id,
        qualification: staff.qualification ?? "",
        experience_years: staff.experience_years != null ? String(staff.experience_years) : "",
        bio: staff.bio ?? "",
      });
      setPhotoPreview(staff.users.avatar_url ?? null);
    } else {
      reset(EMPTY_FORM);
      setPhotoPreview(null);
    }
    setPhotoFile(null);
    setSelectedActivityIds(new Set());
    setSaveError(null);
  }, [isOpen, staff, reset]);

  useEffect(() => {
    if (profileQuery.data) {
      setSelectedActivityIds(new Set(profileQuery.data.assignedActivities.map((a) => a.activity_id)));
    }
  }, [profileQuery.data]);

  function handlePhotoChange(file: File | undefined) {
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function toggleActivity(activityId: string) {
    setSelectedActivityIds((prev) => {
      const next = new Set(prev);
      if (next.has(activityId)) next.delete(activityId);
      else next.add(activityId);
      return next;
    });
  }

  function invalidateStaff() {
    queryClient.invalidateQueries({ queryKey: ["admin", "extracurricular-staff"] });
  }

  const saveMutation = useMutation({
    mutationFn: async (values: StaffFormValues) => {
      let staffId = staff?.id ?? null;

      if (!staffId) {
        const created = await staffService.createExtracurricularStaff({
          full_name: values.full_name,
          email: values.email,
          phone: values.phone || undefined,
          password: values.password || undefined,
          gender: (values.gender || undefined) as ExtracurricularGender | undefined,
          date_of_birth: values.date_of_birth || undefined,
          address: values.address || undefined,
          staff_type_activity_id: values.staff_type_activity_id,
          qualification: values.qualification || undefined,
          experience_years: values.experience_years ? Number(values.experience_years) : undefined,
          bio: values.bio || undefined,
        });
        staffId = created.id;
      } else {
        await staffService.updateExtracurricularStaff(staffId, {
          full_name: values.full_name,
          phone: values.phone || undefined,
          gender: (values.gender || undefined) as ExtracurricularGender | undefined,
          date_of_birth: values.date_of_birth || undefined,
          address: values.address || undefined,
          staff_type_activity_id: values.staff_type_activity_id,
          qualification: values.qualification || undefined,
          experience_years: values.experience_years ? Number(values.experience_years) : undefined,
          bio: values.bio || undefined,
        });
        await staffService.assignActivities(staffId, Array.from(selectedActivityIds));
      }

      if (photoFile) {
        await staffService.uploadExtracurricularStaffPhoto(staffId, photoFile);
      }
    },
    onSuccess: () => {
      invalidateStaff();
      onSaved();
      toast.success(mode === "edit" ? "Staff member updated." : "Staff member added.");
      onClose();
    },
    onError: (err) => {
      setSaveError(getApiErrorMessage(err, mode === "edit" ? "Failed to update staff member." : "Failed to create staff member."));
    },
  });

  async function onSubmit(values: StaffFormValues) {
    setSaveError(null);
    setSaving(true);
    try {
      await saveMutation.mutateAsync(values);
    } finally {
      setSaving(false);
    }
  }

  const title = mode === "edit" ? "Edit staff member" : "Add staff member";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="xl">
      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
        <section className="space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Personal information
          </h3>

          <div className="flex items-center gap-4">
            {photoPreview ? (
              <img
                src={photoPreview}
                alt=""
                className="h-14 w-14 rounded-full object-cover ring-2 ring-white dark:ring-white/10"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-lg font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                {(watch("full_name") || "?").trim().charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handlePhotoChange(e.target.files?.[0])}
              />
              <Button type="button" variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => fileInputRef.current?.click()}>
                {photoPreview ? "Change photo" : "Upload photo"}
              </Button>
              <p className="text-xs text-slate-400 dark:text-slate-500">Uploaded once details are saved.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Full name" error={errors.full_name?.message} {...register("full_name")} />
            {mode === "edit" && <Input label="Staff ID" value={staff?.staff_code ?? ""} disabled readOnly />}
            <Input label="Email" type="email" disabled={mode === "edit"} error={errors.email?.message} {...register("email")} />
            <Input
              label="Mobile number (optional)"
              inputMode="numeric"
              error={errors.phone?.message}
              {...digitsOnly(register("phone"), 10)}
            />
            <Select label="Gender (optional)" placeholder="Select gender" options={GENDER_OPTIONS} {...register("gender")} />
            <DatePicker
              label="Date of birth (optional)"
              value={watch("date_of_birth") ?? ""}
              onChange={(iso) => setValue("date_of_birth", iso)}
            />
          </div>
          <Textarea label="Address (optional)" rows={2} {...register("address")} />

          {mode !== "edit" && (
            <PasswordField
              value={watch("password") ?? ""}
              onChange={(v) => setValue("password", v)}
              onGenerate={() => setValue("password", generateDefaultPassword(getValues("full_name")))}
            />
          )}
        </section>

        <section className="space-y-4 border-t border-slate-100 pt-5 dark:border-white/10">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Professional information
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SearchableSelect
              label="Staff type"
              placeholder="Select staff type"
              options={activities.map((a) => ({ value: a.id, label: a.staff_title }))}
              value={watch("staff_type_activity_id") ?? ""}
              onChange={(v) => setValue("staff_type_activity_id", v, { shouldValidate: true })}
              error={errors.staff_type_activity_id?.message}
            />
            <Input label="Qualification (optional)" {...register("qualification")} />
            <Input label="Experience (years, optional)" type="number" min={0} max={80} {...register("experience_years")} />
          </div>
          <Textarea label="Bio (optional)" rows={3} {...register("bio")} />
        </section>

        {mode === "edit" && (
          <section className="space-y-3 border-t border-slate-100 pt-5 dark:border-white/10">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Assign activities
            </h3>
            <div className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-2 dark:border-white/10">
              {activities.length === 0 && (
                <p className="text-sm text-slate-400 dark:text-slate-500">No activities available yet.</p>
              )}
              {activities.map((a) => (
                <label key={a.id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                  <Checkbox checked={selectedActivityIds.has(a.id)} onChange={() => toggleActivity(a.id)} />
                  {a.name} <span className="text-xs text-slate-400 dark:text-slate-500">({a.staff_title})</span>
                </label>
              ))}
            </div>
          </section>
        )}

        {saveError && <p className="text-sm text-red-600">{saveError}</p>}

        <Button type="submit" className="w-full" isLoading={isSaving}>
          {mode === "edit" ? "Save changes" : "Create"}
        </Button>
      </form>
    </Modal>
  );
}
