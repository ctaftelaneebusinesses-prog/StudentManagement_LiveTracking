import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import * as studentsService from "@/services/admin/students.service";

interface AddStudentFormValues {
  full_name: string;
  email: string;
  phone: string;
  admission_no: string;
  roll_no: string;
  gender: "" | "male" | "female" | "other";
}

interface AddStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  classId: string;
  onCreated: () => void;
}

export function AddStudentModal({ isOpen, onClose, classId, onCreated }: AddStudentModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddStudentFormValues>({
    defaultValues: { full_name: "", email: "", phone: "", admission_no: "", roll_no: "", gender: "" },
  });

  const createMutation = useMutation({
    mutationFn: (values: AddStudentFormValues) =>
      studentsService.createStudent({
        full_name: values.full_name,
        email: values.email,
        phone: values.phone || undefined,
        admission_no: values.admission_no,
        roll_no: values.roll_no || undefined,
        gender: values.gender || undefined,
        class_id: classId,
      }),
    onSuccess: () => {
      reset();
      onCreated();
      onClose();
    },
  });

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add student">
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
        <Input
          label="Admission number"
          error={errors.admission_no?.message}
          {...register("admission_no", { required: "Admission number is required" })}
        />
        <Input label="Roll number (optional)" {...register("roll_no")} />
        <Select
          label="Gender (optional)"
          placeholder="Not specified"
          options={[
            { value: "male", label: "Male" },
            { value: "female", label: "Female" },
            { value: "other", label: "Other" },
          ]}
          {...register("gender")}
        />
        {createMutation.isError && (
          <p className="text-sm text-red-600">Failed to create student. The email or admission number may already be in use.</p>
        )}
        <Button type="submit" className="w-full" isLoading={isSubmitting || createMutation.isPending}>
          Add to class
        </Button>
      </form>
    </Modal>
  );
}
