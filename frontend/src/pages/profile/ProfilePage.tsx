import { ChangeEvent, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/store/authStore";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { updateOwnProfile, uploadAvatar } from "@/services/profile.service";
import { ROLE_LABEL } from "@/utils/roles";

const profileFormSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export function ProfilePage() {
  const { user } = useAuth();
  const setUser = useAuthStore((state) => state.setUser);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { full_name: user?.full_name ?? "", phone: user?.phone ?? "" },
  });

  async function onSubmit(values: ProfileFormValues) {
    if (!user) return;
    setSuccessMessage(null);
    const updated = await updateOwnProfile(user.id, {
      full_name: values.full_name,
      phone: values.phone || null,
    });
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
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Profile</h1>
        <p className="text-sm text-slate-500">{ROLE_LABEL[user.roles.name]} account</p>
      </div>

      <Card className="flex items-center gap-4">
        <img
          src={user.avatar_url ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}`}
          alt="Profile avatar"
          className="h-16 w-16 rounded-full object-cover"
        />
        <div>
          <Button
            type="button"
            variant="secondary"
            isLoading={isUploadingAvatar}
            onClick={() => fileInputRef.current?.click()}
          >
            Change photo
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
          {avatarError && <p className="mt-1 text-xs text-red-600">{avatarError}</p>}
        </div>
      </Card>

      <Card>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Input
            label="Full name"
            error={errors.full_name?.message}
            {...register("full_name")}
          />
          <Input label="Email" value={user.email} disabled readOnly />
          <Input label="Phone" error={errors.phone?.message} {...register("phone")} />

          {successMessage && <p className="text-sm text-green-600">{successMessage}</p>}

          <Button type="submit" isLoading={isSubmitting}>
            Save changes
          </Button>
        </form>
      </Card>
    </div>
  );
}
