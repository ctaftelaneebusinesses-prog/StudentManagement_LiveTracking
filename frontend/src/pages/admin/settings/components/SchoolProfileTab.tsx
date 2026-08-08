import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Check } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { ErrorState } from "@/pages/admin/dashboard/components/states/ErrorState";
import { SettingsCard } from "./SettingsCard";
import { SettingsTabSkeleton } from "./SettingsSkeleton";
import * as schoolService from "@/services/admin/school.service";
import { INDIAN_STATE_OPTIONS, getDistrictOptionsForState } from "@/utils/indianRegions";
import { digitsOnly, PHONE_PATTERN } from "@/utils/formHelpers";

function SchoolCodeCard({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // best-effort — clipboard access can be denied, nothing else to do here
    }
  }

  return (
    <SettingsCard
      title="School Code"
      subtitle="Share this with anyone registering for an account — they'll need it on the Register page"
      className="lg:col-span-3"
    >
      <div className="flex items-center gap-3">
        <code className="rounded-md border border-black/[0.08] bg-black/[0.03] px-4 py-2 text-lg font-semibold tracking-wide text-[var(--ink-primary)] dark:border-white/[0.1] dark:bg-white/[0.06]">
          {code}
        </code>
        <Button type="button" variant="secondary" onClick={handleCopy}>
          {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </SettingsCard>
  );
}

export function SchoolProfileTab() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [districtOptions, setDistrictOptions] = useState<{ value: string; label: string }[]>([]);

  const query = useQuery({ queryKey: ["admin", "school"], queryFn: schoolService.fetchMySchool });

  const { register, handleSubmit, watch, setValue, formState: { isSubmitting, errors } } = useForm({
    values: query.data
      ? {
          name: query.data.name,
          address: query.data.address ?? "",
          phone: query.data.phone ?? "",
          email: query.data.email ?? "",
          city: query.data.city ?? "",
          district: query.data.district ?? "",
          state: query.data.state ?? "",
          pin_code: query.data.pin_code ?? "",
        }
      : undefined,
  });

  async function handleStateChange(stateName: string) {
    setValue("state", stateName);
    setValue("district", "");
    setDistrictOptions(await getDistrictOptionsForState(stateName));
  }

  useEffect(() => {
    if (query.data?.state) getDistrictOptionsForState(query.data.state).then(setDistrictOptions);
  }, [query.data?.state]);

  const mutation = useMutation({
    mutationFn: schoolService.updateMySchool,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "school"] });
      setSuccessMessage("School profile updated.");
    },
  });

  async function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !query.data) return;
    setLogoError(null);
    setIsUploadingLogo(true);
    try {
      await schoolService.uploadSchoolLogo(query.data.id, file);
      queryClient.invalidateQueries({ queryKey: ["admin", "school"] });
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : "Failed to upload logo");
    } finally {
      setIsUploadingLogo(false);
    }
  }

  if (query.isLoading) return <SettingsTabSkeleton cards={1} rows={4} />;
  if (query.isError) {
    return <ErrorState message={query.error instanceof Error ? query.error.message : undefined} onRetry={() => query.refetch()} />;
  }
  const school = query.data;
  if (!school) return null;

  return (
    <div className="animate-fade-in grid grid-cols-1 gap-4 lg:grid-cols-3">
      <SchoolCodeCard code={school.code} />

      <SettingsCard title="School Logo" subtitle="Shown on the login screen and reports" className="lg:col-span-1">
        <div className="flex flex-col items-center gap-4 py-2">
          <img
            src={school.logo_url ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(school.name)}&background=6366f1&color=fff`}
            alt="School logo"
            className="h-24 w-24 rounded-2xl object-cover ring-1 ring-black/[0.06] dark:ring-white/[0.08]"
          />
          <Button type="button" variant="secondary" isLoading={isUploadingLogo} onClick={() => fileInputRef.current?.click()}>
            Change logo
          </Button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
          {logoError && <p className="text-xs text-[var(--delta-bad)]">{logoError}</p>}
        </div>
      </SettingsCard>

      <SettingsCard title="School Profile" subtitle="Basic contact information for your school" className="lg:col-span-2">
        <form
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          onSubmit={handleSubmit((values) => {
            setSuccessMessage(null);
            mutation.mutate(values);
          })}
        >
          <Input label="School name" {...register("name")} />
          <Input
            label="Phone"
            inputMode="numeric"
            error={errors.phone?.message}
            {...digitsOnly(register("phone", { pattern: PHONE_PATTERN }), 10)}
          />
          <Input label="Email" type="email" {...register("email")} />
          <Input label="Address" {...register("address")} />
          <SearchableSelect
            label="State"
            placeholder="Select state"
            options={INDIAN_STATE_OPTIONS}
            value={watch("state") ?? ""}
            onChange={handleStateChange}
          />
          <SearchableSelect
            label="District"
            placeholder={watch("state") ? "Select district" : "Select a state first"}
            options={districtOptions}
            value={watch("district") ?? ""}
            onChange={(v) => setValue("district", v)}
            disabled={!watch("state")}
          />
          <Input label="City / Town" placeholder="Not listed under District? Type it here" {...register("city")} />
          <Input label="PIN code" {...register("pin_code")} />
          {successMessage && <p className="sm:col-span-2 text-sm text-[var(--delta-good)]">{successMessage}</p>}
          {mutation.isError && <p className="sm:col-span-2 text-sm text-[var(--delta-bad)]">Failed to update school profile.</p>}
          <Button type="submit" className="sm:col-span-2 sm:w-fit" isLoading={isSubmitting || mutation.isPending}>
            Save profile
          </Button>
        </form>
      </SettingsCard>
    </div>
  );
}
