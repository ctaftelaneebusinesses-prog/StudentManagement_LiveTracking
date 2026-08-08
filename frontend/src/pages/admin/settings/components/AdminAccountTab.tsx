import { ChangeEvent, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/store/authStore";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { SettingsCard } from "./SettingsCard";
import { updateOwnProfile, uploadAvatar } from "@/services/profile.service";
import { changePassword } from "@/services/auth.service";

const profileFormSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().optional(),
});
type ProfileFormValues = z.infer<typeof profileFormSchema>;

const passwordFormSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(6, "New password must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });
type PasswordFormValues = z.infer<typeof passwordFormSchema>;

function ProfileCard() {
  const { user } = useAuth();
  const setUser = useAuthStore((state) => state.setUser);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { full_name: user?.full_name ?? "", phone: user?.phone ?? "" },
  });

  async function onSubmit(values: ProfileFormValues) {
    if (!user) return;
    setSuccessMessage(null);
    const updated = await updateOwnProfile(user.id, { full_name: values.full_name, phone: values.phone || null });
    setUser(updated);
    setSuccessMessage("Profile updated successfully.");
  }

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    setAvatarError(null);
    setIsUploadingAvatar(true);
    try {
      const avatarUrl = await uploadAvatar(user.id, file);
      setUser({ ...user, avatar_url: avatarUrl });
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Failed to upload avatar");
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  if (!user) return null;

  return (
    <SettingsCard title="Admin Profile" subtitle="Your own account details">
      <div className="mb-5 flex items-center gap-4">
        <img
          src={user.avatar_url ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}`}
          alt="Profile avatar"
          className="h-16 w-16 rounded-full object-cover ring-1 ring-black/[0.06] dark:ring-white/[0.08]"
        />
        <div>
          <Button type="button" variant="secondary" isLoading={isUploadingAvatar} onClick={() => fileInputRef.current?.click()}>
            Change photo
          </Button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          {avatarError && <p className="mt-1 text-xs text-[var(--delta-bad)]">{avatarError}</p>}
        </div>
      </div>

      <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Input label="Full name" error={errors.full_name?.message} {...register("full_name")} />
        <Input label="Email" value={user.email} disabled readOnly />
        <Input label="Phone" error={errors.phone?.message} {...register("phone")} />
        {successMessage && <p className="sm:col-span-2 text-sm text-[var(--delta-good)]">{successMessage}</p>}
        <Button type="submit" className="sm:col-span-2 sm:w-fit" isLoading={isSubmitting}>
          Save changes
        </Button>
      </form>
    </SettingsCard>
  );
}

function ChangePasswordCard() {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
  });

  async function onSubmit(values: PasswordFormValues) {
    setSuccessMessage(null);
    setApiError(null);
    try {
      await changePassword(values.currentPassword, values.newPassword);
      setSuccessMessage("Password changed successfully.");
      reset();
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setApiError(message ?? "Failed to change password. Check your current password and try again.");
    }
  }

  return (
    <SettingsCard title="Change Password" subtitle="Choose a new password for your account">
      <form className="grid grid-cols-1 gap-4 sm:grid-cols-3" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Input label="Current password" type="password" error={errors.currentPassword?.message} {...register("currentPassword")} />
        <Input label="New password" type="password" error={errors.newPassword?.message} {...register("newPassword")} />
        <Input label="Confirm new password" type="password" error={errors.confirmPassword?.message} {...register("confirmPassword")} />
        {successMessage && <p className="sm:col-span-3 text-sm text-[var(--delta-good)]">{successMessage}</p>}
        {apiError && <p className="sm:col-span-3 text-sm text-[var(--delta-bad)]">{apiError}</p>}
        <Button type="submit" className="sm:col-span-3 sm:w-fit" isLoading={isSubmitting}>
          Change password
        </Button>
      </form>
    </SettingsCard>
  );
}

export function AdminAccountTab() {
  return (
    <div className="animate-fade-in space-y-6">
      <ProfileCard />
      <ChangePasswordCard />
    </div>
  );
}
