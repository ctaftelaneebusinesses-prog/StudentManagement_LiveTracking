import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { DatePicker } from "@/components/ui/DatePicker";
import { Textarea } from "@/components/ui/Textarea";
import { PasswordField } from "@/components/ui/PasswordField";
import { Button } from "@/components/ui/Button";
import { getApiErrorMessage } from "@/lib/axios";
import { digitsOnly, PHONE_PATTERN, AADHAAR_PATTERN } from "@/utils/formHelpers";
import { generateDefaultPassword } from "@/utils/password";
import { resolveClassId } from "@/utils/classPicker";
import { ClassSectionValue, ClassSectionSelects } from "@/pages/admin/teachers/components/ClassSectionSelects";
import {
  INDIAN_STATE_OPTIONS,
  BLOOD_GROUP_OPTIONS,
  RELIGION_OPTIONS,
  CATEGORY_OPTIONS,
  getDistrictOptionsForState,
} from "@/utils/indianRegions";
import { RegistrationMeta, RegistrationResult, submitRegistration } from "@/services/registration.service";
import { GENDER_OPTIONS, FormSectionHeading, FormGrid } from "./formShared";

interface FormValues {
  full_name: string;
  email: string;
  phone: string;
  admission_no: string;
  roll_no: string;
  date_of_birth: string;
  gender: string;
  blood_group: string;
  aadhaar_number: string;
  address: string;
  religion: string;
  category: string;
  state: string;
  district: string;
  city: string;
  pin_code: string;
  father_name: string;
  father_phone: string;
  father_email: string;
  father_occupation: string;
  mother_name: string;
  mother_phone: string;
  mother_email: string;
  mother_occupation: string;
  guardian_name: string;
  guardian_phone: string;
  guardian_email: string;
  guardian_occupation: string;
}

export function StudentForm({ meta, onSuccess }: { meta: RegistrationMeta; onSuccess: (r: RegistrationResult) => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [classSection, setClassSection] = useState<ClassSectionValue>({ academicYearId: "", className: "", section: "" });
  const [classError, setClassError] = useState<string | null>(null);
  const [districtOptions, setDistrictOptions] = useState<{ value: string; label: string }[]>([]);

  const {
    register,
    control,
    watch,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>();

  const stateValue = watch("state");

  useEffect(() => {
    let cancelled = false;
    if (stateValue) {
      getDistrictOptionsForState(stateValue).then((options) => {
        if (!cancelled) setDistrictOptions(options);
      });
    } else {
      setDistrictOptions([]);
    }
    return () => {
      cancelled = true;
    };
  }, [stateValue]);

  async function onSubmit(values: FormValues) {
    setServerError(null);
    setClassError(null);

    const class_id = resolveClassId(meta.classes, classSection.academicYearId, classSection.className, classSection.section);
    if (!class_id) {
      setClassError("Select your Academic Year, Class, and Section.");
      return;
    }

    try {
      const result = await submitRegistration("student", {
        school_code: meta.school.code,
        full_name: values.full_name,
        email: values.email,
        phone: values.phone || undefined,
        password: password || undefined,
        admission_no: values.admission_no || undefined,
        roll_no: values.roll_no || undefined,
        class_id,
        date_of_birth: values.date_of_birth || undefined,
        gender: values.gender || undefined,
        blood_group: values.blood_group || undefined,
        aadhaar_number: values.aadhaar_number || undefined,
        address: values.address || undefined,
        religion: values.religion || undefined,
        category: values.category || undefined,
        state: values.state || undefined,
        district: values.district || undefined,
        city: values.city || undefined,
        pin_code: values.pin_code || undefined,
        father_name: values.father_name || undefined,
        father_phone: values.father_phone || undefined,
        father_email: values.father_email || undefined,
        father_occupation: values.father_occupation || undefined,
        mother_name: values.mother_name || undefined,
        mother_phone: values.mother_phone || undefined,
        mother_email: values.mother_email || undefined,
        mother_occupation: values.mother_occupation || undefined,
        guardian_name: values.guardian_name || undefined,
        guardian_phone: values.guardian_phone || undefined,
        guardian_email: values.guardian_email || undefined,
        guardian_occupation: values.guardian_occupation || undefined,
      });
      onSuccess(result);
    } catch (err) {
      setServerError(getApiErrorMessage(err, "Couldn't submit your registration."));
    }
  }

  return (
    <form className="space-y-1" onSubmit={handleSubmit(onSubmit)} noValidate>
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Student registration</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Sent to your Class Teacher for approval (or your School Admin, if one isn't assigned yet).
      </p>

      <FormSectionHeading>Personal information</FormSectionHeading>
      <FormGrid>
        <Input label="Student name" error={errors.full_name?.message} {...register("full_name", { required: "Student name is required" })} />
        <Input label="Email" type="email" error={errors.email?.message} {...register("email", { required: "Email is required" })} />
        <Input
          label="Mobile number (optional)"
          inputMode="numeric"
          error={errors.phone?.message}
          {...digitsOnly(register("phone", { pattern: PHONE_PATTERN }), 10)}
        />
        <Input label="Admission number (if available)" {...register("admission_no")} />
        <Input label="Roll number (optional)" {...register("roll_no")} />
        <Select label="Gender (optional)" options={GENDER_OPTIONS} placeholder="Select gender" {...register("gender")} />
        <Controller
          name="date_of_birth"
          control={control}
          render={({ field }) => <DatePicker label="Date of birth (optional)" value={field.value ?? ""} onChange={field.onChange} />}
        />
        <Select label="Blood group (optional)" options={BLOOD_GROUP_OPTIONS} placeholder="Select blood group" {...register("blood_group")} />
        <Input
          label="Aadhaar number (optional)"
          inputMode="numeric"
          error={errors.aadhaar_number?.message}
          {...digitsOnly(register("aadhaar_number", { pattern: AADHAAR_PATTERN }), 12)}
        />
      </FormGrid>
      <div className="mt-4">
        <Textarea label="Address (optional)" rows={2} {...register("address")} />
      </div>

      <FormSectionHeading>Academic information</FormSectionHeading>
      <FormGrid>
        <ClassSectionSelects classes={meta.classes} value={classSection} onChange={setClassSection} />
      </FormGrid>
      {classError && <p className="mt-2 text-sm text-red-600">{classError}</p>}

      <FormSectionHeading>Additional information</FormSectionHeading>
      <FormGrid>
        <Controller
          name="religion"
          control={control}
          render={({ field }) => (
            <SearchableSelect label="Religion (optional)" options={RELIGION_OPTIONS} value={field.value ?? ""} onChange={field.onChange} />
          )}
        />
        <Select label="Category (optional)" options={CATEGORY_OPTIONS} placeholder="Select category" {...register("category")} />
        <Controller
          name="state"
          control={control}
          render={({ field }) => (
            <SearchableSelect
              label="State (optional)"
              options={INDIAN_STATE_OPTIONS}
              value={field.value ?? ""}
              onChange={(v) => {
                field.onChange(v);
                setValue("district", "");
              }}
            />
          )}
        />
        <Controller
          name="district"
          control={control}
          render={({ field }) => (
            <SearchableSelect
              label="District (optional)"
              options={districtOptions}
              value={field.value ?? ""}
              onChange={field.onChange}
              disabled={!stateValue}
              placeholder={stateValue ? "Select district" : "Select a state first"}
            />
          )}
        />
        <Input label="City (optional)" placeholder="Not listed under District? Type it here" {...register("city")} />
        <Input label="PIN code (optional)" {...register("pin_code")} />
      </FormGrid>

      <FormSectionHeading>Parent / Guardian information</FormSectionHeading>
      <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Provide at least one parent or guardian's name and mobile number.</p>

      <p className="mt-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Father</p>
      <FormGrid>
        <Input label="Father name" {...register("father_name")} />
        <Input
          label="Father mobile number"
          inputMode="numeric"
          error={errors.father_phone?.message}
          {...digitsOnly(register("father_phone", { pattern: PHONE_PATTERN }), 10)}
        />
        <Input label="Father email (optional)" type="email" {...register("father_email")} />
        <Input label="Father occupation (optional)" {...register("father_occupation")} />
      </FormGrid>

      <p className="mt-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Mother</p>
      <FormGrid>
        <Input label="Mother name" {...register("mother_name")} />
        <Input
          label="Mother mobile number"
          inputMode="numeric"
          error={errors.mother_phone?.message}
          {...digitsOnly(register("mother_phone", { pattern: PHONE_PATTERN }), 10)}
        />
        <Input label="Mother email (optional)" type="email" {...register("mother_email")} />
        <Input label="Mother occupation (optional)" {...register("mother_occupation")} />
      </FormGrid>

      <p className="mt-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Guardian (optional)</p>
      <FormGrid>
        <Input label="Guardian name" {...register("guardian_name")} />
        <Input
          label="Guardian mobile number"
          inputMode="numeric"
          error={errors.guardian_phone?.message}
          {...digitsOnly(register("guardian_phone", { pattern: PHONE_PATTERN }), 10)}
        />
        <Input label="Guardian email (optional)" type="email" {...register("guardian_email")} />
        <Input label="Guardian occupation (optional)" {...register("guardian_occupation")} />
      </FormGrid>

      <div className="mt-4">
        <PasswordField
          value={password}
          onChange={setPassword}
          onGenerate={() => setPassword(generateDefaultPassword(watch("full_name"), watch("roll_no") || watch("admission_no")))}
        />
      </div>

      {serverError && (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {serverError}
        </p>
      )}

      <Button type="submit" className="mt-6 w-full" isLoading={isSubmitting}>
        Submit registration
      </Button>
    </form>
  );
}
