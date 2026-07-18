import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { DataTable } from "@/components/ui/DataTable";
import * as schoolService from "@/services/admin/school.service";
import { AcademicYear, Branch, School } from "@/types/admin.types";

function SchoolProfileForm({ school }: { school: School }) {
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { register, handleSubmit, formState: { isSubmitting } } = useForm({
    defaultValues: {
      name: school.name,
      address: school.address ?? "",
      phone: school.phone ?? "",
      email: school.email ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: schoolService.updateMySchool,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "school"] });
      setSuccessMessage("School profile updated.");
    },
  });

  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold text-slate-900">School Profile</h2>
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <Input label="School name" {...register("name")} />
        <Input label="Address" {...register("address")} />
        <Input label="Phone" {...register("phone")} />
        <Input label="Email" type="email" {...register("email")} />
        {successMessage && <p className="text-sm text-green-600">{successMessage}</p>}
        <Button type="submit" isLoading={isSubmitting || mutation.isPending}>
          Save profile
        </Button>
      </form>
    </Card>
  );
}

function AcademicYearsSection() {
  const queryClient = useQueryClient();
  const [isModalOpen, setModalOpen] = useState(false);
  const { data: years = [], isLoading } = useQuery({
    queryKey: ["admin", "academic-years"],
    queryFn: schoolService.fetchAcademicYears,
  });

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm({
    defaultValues: { name: "", start_date: "", end_date: "" },
  });

  const createMutation = useMutation({
    mutationFn: schoolService.createAcademicYear,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "academic-years"] });
      reset();
      setModalOpen(false);
    },
  });

  const setCurrentMutation = useMutation({
    mutationFn: schoolService.setCurrentAcademicYear,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "academic-years"] }),
  });

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Academic Years</h2>
        <Button onClick={() => setModalOpen(true)}>Add academic year</Button>
      </div>

      <DataTable<AcademicYear>
        isLoading={isLoading}
        rows={years}
        rowKey={(y) => y.id}
        emptyMessage="No academic years yet."
        columns={[
          { header: "Name", cell: (y) => y.name },
          { header: "Start", cell: (y) => y.start_date },
          { header: "End", cell: (y) => y.end_date },
          {
            header: "Status",
            cell: (y) =>
              y.is_current ? (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  Current
                </span>
              ) : (
                <Button
                  variant="ghost"
                  className="!px-2 !py-1 text-xs"
                  isLoading={setCurrentMutation.isPending}
                  onClick={() => setCurrentMutation.mutate(y.id)}
                >
                  Set as current
                </Button>
              ),
          },
        ]}
      />

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title="Add academic year">
        <form
          className="space-y-4"
          onSubmit={handleSubmit((values) => createMutation.mutate(values))}
        >
          <Input label="Name (e.g. 2026-2027)" {...register("name", { required: true })} />
          <Input label="Start date" type="date" {...register("start_date", { required: true })} />
          <Input label="End date" type="date" {...register("end_date", { required: true })} />
          {createMutation.isError && (
            <p className="text-sm text-red-600">Failed to create academic year.</p>
          )}
          <Button type="submit" className="w-full" isLoading={isSubmitting || createMutation.isPending}>
            Create
          </Button>
        </form>
      </Modal>
    </Card>
  );
}

function BranchesSection() {
  const queryClient = useQueryClient();
  const [isModalOpen, setModalOpen] = useState(false);
  const { data: branches = [], isLoading } = useQuery({
    queryKey: ["admin", "branches"],
    queryFn: schoolService.fetchBranches,
  });

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm({
    defaultValues: { name: "", address: "" },
  });

  const createMutation = useMutation({
    mutationFn: schoolService.createBranch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "branches"] });
      reset();
      setModalOpen(false);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: schoolService.deactivateBranch,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "branches"] }),
  });

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Branches</h2>
        <Button onClick={() => setModalOpen(true)}>Add branch</Button>
      </div>

      <DataTable<Branch>
        isLoading={isLoading}
        rows={branches}
        rowKey={(b) => b.id}
        emptyMessage="No branches yet."
        columns={[
          { header: "Name", cell: (b) => b.name },
          { header: "Address", cell: (b) => b.address ?? "—" },
          { header: "Main", cell: (b) => (b.is_main ? "Yes" : "No") },
          {
            header: "Status",
            cell: (b) => (b.is_active ? "Active" : "Inactive"),
          },
          {
            header: "",
            cell: (b) =>
              b.is_active && (
                <Button
                  variant="ghost"
                  className="!px-2 !py-1 text-xs text-red-600"
                  isLoading={deactivateMutation.isPending}
                  onClick={() => deactivateMutation.mutate(b.id)}
                >
                  Deactivate
                </Button>
              ),
          },
        ]}
      />

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title="Add branch">
        <form className="space-y-4" onSubmit={handleSubmit((values) => createMutation.mutate(values))}>
          <Input label="Branch name" {...register("name", { required: true })} />
          <Input label="Address" {...register("address")} />
          {createMutation.isError && <p className="text-sm text-red-600">Failed to create branch.</p>}
          <Button type="submit" className="w-full" isLoading={isSubmitting || createMutation.isPending}>
            Create
          </Button>
        </form>
      </Modal>
    </Card>
  );
}

export function SchoolSettingsPage() {
  const { data: school, isLoading } = useQuery({
    queryKey: ["admin", "school"],
    queryFn: schoolService.fetchMySchool,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">School Settings</h1>
      {isLoading || !school ? <p className="text-sm text-slate-500">Loading...</p> : <SchoolProfileForm school={school} />}
      <AcademicYearsSection />
      <BranchesSection />
    </div>
  );
}
