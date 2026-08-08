import { ChangeEvent, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, IdCard, GraduationCap, Briefcase, School, MapPin, KeyRound, Camera, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/store/authStore";
import { removeAvatar, uploadAvatar } from "@/services/profile.service";
import { changePassword } from "@/services/auth.service";
import { getApiErrorMessage } from "@/lib/axios";
import * as portalService from "@/services/teacher/portal.service";
import { ErrorState } from "@/pages/admin/dashboard/components/states/ErrorState";

const profileFormSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().optional(),
  address: z.string().max(500).optional(),
});
type ProfileFormValues = z.infer<typeof profileFormSchema>;

const passwordFormSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
type PasswordFormValues = z.infer<typeof passwordFormSchema>;

export function TeacherProfilePage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const setUser = useAuthStore((state) => state.setUser);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAvatarBusy, setAvatarBusy] = useState(false);

  const {
    data: profile,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["teacher", "profile"],
    queryFn: portalService.fetchProfile,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    values: profile
      ? { full_name: profile.users.full_name, phone: profile.users.phone ?? "", address: profile.address ?? "" }
      : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: (values: ProfileFormValues) =>
      portalService.updateProfile({
        full_name: values.full_name,
        phone: values.phone || null,
        address: values.address || null,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["teacher", "profile"], updated);
      if (user) setUser({ ...user, full_name: updated.users.full_name, phone: updated.users.phone });
      reset({ full_name: updated.users.full_name, phone: updated.users.phone ?? "", address: updated.address ?? "" });
      toast.success("Profile updated successfully.");
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to update profile.")),
  });

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    reset: resetPassword,
    formState: { errors: passwordErrors, isSubmitting: isPasswordSubmitting },
  } = useForm<PasswordFormValues>({ resolver: zodResolver(passwordFormSchema) });

  const passwordMutation = useMutation({
    mutationFn: (values: PasswordFormValues) => changePassword(values.currentPassword, values.newPassword),
    onSuccess: () => {
      resetPassword();
      toast.success("Password changed successfully.");
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to change password.")),
  });

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    setAvatarBusy(true);
    try {
      const avatarUrl = await uploadAvatar(user.id, file);
      setUser({ ...user, avatar_url: avatarUrl });
      queryClient.invalidateQueries({ queryKey: ["teacher", "profile"] });
      toast.success("Profile photo updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload photo.");
    } finally {
      setAvatarBusy(false);
      event.target.value = "";
    }
  }

  async function handleAvatarRemove() {
    if (!user) return;
    setAvatarBusy(true);
    try {
      await removeAvatar(user.id);
      setUser({ ...user, avatar_url: null });
      queryClient.invalidateQueries({ queryKey: ["teacher", "profile"] });
      toast.success("Profile photo removed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove photo.");
    } finally {
      setAvatarBusy(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (isError) {
    return <ErrorState message={getApiErrorMessage(error, "Failed to load your profile.")} onRetry={() => void refetch()} />;
  }

  if (!profile) return null;

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">My Profile</h1>
        <p className="text-sm text-[var(--ink-muted)]">
          Everything about your teaching account — profile, contact details, and security.
        </p>
      </div>

      <Card className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
        <div className="relative shrink-0">
          <img
            src={profile.users.avatar_url ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.users.full_name)}`}
            alt=""
            className="h-20 w-20 rounded-full object-cover ring-2 ring-white shadow-sm dark:ring-white/10"
          />
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold text-[var(--ink-primary)]">{profile.users.full_name}</h2>
            {profile.isClassTeacher && <Badge variant="info">Class Teacher</Badge>}
          </div>
          <p className="text-sm text-[var(--ink-muted)]">{profile.qualification ?? "Teacher"}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              className="!px-3 !py-1.5 text-xs"
              isLoading={isAvatarBusy}
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera size={14} className="mr-1.5 inline" strokeWidth={1.75} />
              Change photo
            </Button>
            {profile.users.avatar_url && (
              <Button
                type="button"
                variant="ghost"
                className="!px-3 !py-1.5 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                isLoading={isAvatarBusy}
                onClick={handleAvatarRemove}
              >
                <Trash2 size={14} className="mr-1.5 inline" strokeWidth={1.75} />
                Remove photo
              </Button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-[var(--ink-secondary)] sm:grid-cols-2">
            <InfoRow icon={IdCard} label="Employee ID" value={profile.employee_id} />
            <InfoRow icon={Mail} label="Email" value={profile.users.email} />
            <InfoRow icon={GraduationCap} label="Qualification" value={profile.qualification ?? "—"} />
            <InfoRow icon={Briefcase} label="Experience" value={profile.experience_years != null ? `${profile.experience_years} year(s)` : "—"} />
            <InfoRow icon={School} label="Assigned School" value={profile.schools?.name ?? "—"} />
          </div>
        </div>
      </Card>

      {profile.isClassTeacher && profile.classTeacherOf && (
        <Card className="space-y-4">
          <h2 className="text-lg font-semibold text-[var(--ink-primary)]">Class Teacher Of</h2>
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <Field label="Academic Year" value={profile.classTeacherOf.academicYear} />
            <Field label="Class" value={profile.classTeacherOf.className} />
            <Field label="Section" value={profile.classTeacherOf.section} />
            <Field label="Total Students" value={String(profile.classTeacherOf.totalStudents)} />
          </dl>
        </Card>
      )}

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--ink-primary)]">Personal & contact details</h2>
        <form className="space-y-4" onSubmit={handleSubmit((values) => updateMutation.mutate(values))} noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Full name" error={errors.full_name?.message} {...register("full_name")} />
            <Input label="Phone" error={errors.phone?.message} {...register("phone")} />
          </div>
          <Textarea label="Address" rows={2} error={errors.address?.message} {...register("address")} />
          <div className="flex items-center gap-2 text-xs text-[var(--ink-muted)]">
            <MapPin size={13} strokeWidth={1.75} />
            Used for school records only.
          </div>
          <Button type="submit" isLoading={isSubmitting || updateMutation.isPending} disabled={!isDirty}>
            Save changes
          </Button>
        </form>
      </Card>

      <Card className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--ink-primary)]">
          <KeyRound size={17} strokeWidth={1.75} />
          Change password
        </h2>
        <form
          className="grid grid-cols-1 gap-4 sm:grid-cols-3"
          onSubmit={handlePasswordSubmit((values) => passwordMutation.mutate(values))}
          noValidate
        >
          <Input
            type="password"
            label="Current password"
            error={passwordErrors.currentPassword?.message}
            {...registerPassword("currentPassword")}
          />
          <Input
            type="password"
            label="New password"
            error={passwordErrors.newPassword?.message}
            {...registerPassword("newPassword")}
          />
          <Input
            type="password"
            label="Confirm new password"
            error={passwordErrors.confirmPassword?.message}
            {...registerPassword("confirmPassword")}
          />
          <div className="sm:col-span-3">
            <Button type="submit" isLoading={isPasswordSubmitting || passwordMutation.isPending}>
              Update password
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={14} strokeWidth={1.75} className="shrink-0 text-[var(--ink-muted)]" />
      <span className="text-[var(--ink-muted)]">{label}:</span>
      <span className="font-medium text-[var(--ink-primary)]">{value}</span>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">{label}</dt>
      <dd className="mt-0.5 font-semibold text-[var(--ink-primary)]">{value}</dd>
    </div>
  );
}
