import { ChangeEvent, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, IdCard, GraduationCap, Briefcase, Sparkles, MapPin, Camera } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/store/authStore";
import { getApiErrorMessage } from "@/lib/axios";
import * as portalService from "@/services/extracurricularPortal.service";

const profileFormSchema = z.object({
  phone: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
  bio: z.string().max(1000).optional(),
});
type ProfileFormValues = z.infer<typeof profileFormSchema>;

export function ExtracurricularProfilePage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const setUser = useAuthStore((state) => state.setUser);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAvatarBusy, setAvatarBusy] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["extracurricular", "profile"],
    queryFn: portalService.fetchPortalProfile,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    values: profile ? { phone: profile.phone ?? "", address: profile.address ?? "", bio: profile.bio ?? "" } : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: (values: ProfileFormValues) =>
      portalService.updatePortalProfile({
        phone: values.phone || undefined,
        address: values.address || undefined,
        bio: values.bio || undefined,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["extracurricular", "profile"], updated);
      if (user) setUser({ ...user, phone: updated.phone });
      reset({ phone: updated.phone ?? "", address: updated.address ?? "", bio: updated.bio ?? "" });
      toast.success("Profile updated successfully.");
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to update profile.")),
  });

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !profile) return;
    setAvatarBusy(true);
    try {
      const updated = await portalService.uploadOwnPhoto(profile.id, file);
      queryClient.setQueryData(["extracurricular", "profile"], updated);
      if (user) setUser({ ...user, avatar_url: updated.avatar_url });
      toast.success("Profile photo updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload photo.");
    } finally {
      setAvatarBusy(false);
      event.target.value = "";
    }
  }

  if (isLoading || !profile) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">My Profile</h1>
        <p className="text-sm text-[var(--ink-muted)]">
          Your instructor profile, contact details, and the activity you're registered to teach.
        </p>
      </div>

      <Card className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
        <div className="relative shrink-0">
          <img
            src={profile.avatar_url ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.full_name)}`}
            alt=""
            className="h-20 w-20 rounded-full object-cover ring-2 ring-white shadow-sm dark:ring-white/10"
          />
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold text-[var(--ink-primary)]">{profile.full_name}</h2>
            {profile.activities?.staff_title && <Badge variant="warning">{profile.activities.staff_title}</Badge>}
          </div>
          <p className="text-sm text-[var(--ink-muted)]">{profile.qualification ?? "Extracurricular Staff"}</p>
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
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-[var(--ink-secondary)] sm:grid-cols-2">
            <InfoRow icon={IdCard} label="Staff Code" value={profile.staff_code} />
            <InfoRow icon={Mail} label="Email" value={profile.email} />
            <InfoRow icon={Sparkles} label="Activity" value={profile.activities?.name ?? "—"} />
            <InfoRow icon={GraduationCap} label="Qualification" value={profile.qualification ?? "—"} />
            <InfoRow icon={Briefcase} label="Experience" value={profile.experience_years != null ? `${profile.experience_years} year(s)` : "—"} />
          </div>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--ink-primary)]">Personal & contact details</h2>
        <form className="space-y-4" onSubmit={handleSubmit((values) => updateMutation.mutate(values))} noValidate>
          <Input label="Phone" error={errors.phone?.message} {...register("phone")} />
          <Textarea label="Address" rows={2} error={errors.address?.message} {...register("address")} />
          <Textarea label="Bio" rows={4} error={errors.bio?.message} {...register("bio")} placeholder="A short introduction students and parents will see." />
          <div className="flex items-center gap-2 text-xs text-[var(--ink-muted)]">
            <MapPin size={13} strokeWidth={1.75} />
            Email, staff code, and activity are managed by your school admin.
          </div>
          <Button type="submit" isLoading={isSubmitting || updateMutation.isPending} disabled={!isDirty}>
            Save changes
          </Button>
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
