import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import { Spinner } from "@/components/ui/Spinner";
import * as studentsService from "@/services/admin/students.service";
import * as classesService from "@/services/admin/classes.service";
import * as parentsService from "@/services/admin/parents.service";
import * as documentsService from "@/services/admin/studentDocuments.service";
import { DocumentType, LinkedParent, ParentRelation } from "@/types/admin.types";

const RELATION_OPTIONS = [
  { value: "father", label: "Father" },
  { value: "mother", label: "Mother" },
  { value: "guardian", label: "Guardian" },
];

const DOC_TYPE_OPTIONS: { value: DocumentType; label: string }[] = [
  { value: "birth_certificate", label: "Birth certificate" },
  { value: "id_proof", label: "ID proof" },
  { value: "transfer_certificate", label: "Transfer certificate" },
  { value: "photo", label: "Photo" },
  { value: "medical", label: "Medical record" },
  { value: "other", label: "Other" },
];

export function StudentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const studentId = id!;
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const studentQuery = useQuery({
    queryKey: ["admin", "students", studentId],
    queryFn: () => studentsService.fetchStudent(studentId),
  });

  const parentsQuery = useQuery({
    queryKey: ["admin", "students", studentId, "parents"],
    queryFn: () => parentsService.fetchParentsForStudent(studentId),
  });

  const documentsQuery = useQuery({
    queryKey: ["admin", "students", studentId, "documents"],
    queryFn: () => documentsService.fetchDocuments(studentId),
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["admin", "classes"],
    queryFn: classesService.fetchClasses,
  });
  const classOptions = classes.map((c) => ({ value: c.id, label: `${c.name} - ${c.section}` }));

  function invalidateStudent() {
    queryClient.invalidateQueries({ queryKey: ["admin", "students", studentId] });
    queryClient.invalidateQueries({ queryKey: ["admin", "students"] });
  }
  function invalidateParents() {
    queryClient.invalidateQueries({ queryKey: ["admin", "students", studentId, "parents"] });
  }
  function invalidateDocuments() {
    queryClient.invalidateQueries({ queryKey: ["admin", "students", studentId, "documents"] });
  }

  if (studentQuery.isLoading) return <Spinner label="Loading student profile..." />;
  if (!studentQuery.data) return <p className="text-sm text-slate-500">Student not found.</p>;

  const student = studentQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/dashboard/admin/students" className="text-sm text-brand-600 hover:underline">
            ← Back to students
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">{student.users.full_name}</h1>
          <p className="text-sm text-slate-500">
            Admission No: {student.admission_no}
            {!student.users.is_active && <span className="ml-2 text-red-600">(Deactivated)</span>}
          </p>
        </div>
        <img
          src={student.users.avatar_url ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(student.users.full_name)}`}
          alt="Student avatar"
          className="h-16 w-16 rounded-full object-cover"
        />
      </div>

      <PersonalDetailsCard student={student} onSaved={invalidateStudent} />

      <ClassDetailsCard
        student={student}
        classOptions={classOptions}
        onAssigned={invalidateStudent}
      />

      <ParentDetailsCard
        studentId={studentId}
        parents={parentsQuery.data ?? []}
        isLoading={parentsQuery.isLoading}
        onChanged={invalidateParents}
      />

      <DocumentsCard
        studentId={studentId}
        schoolId={user?.school_id ?? ""}
        documents={documentsQuery.data ?? []}
        isLoading={documentsQuery.isLoading}
        onChanged={invalidateDocuments}
      />
    </div>
  );
}

// ----------------------------------------------------------------------------
function PersonalDetailsCard({
  student,
  onSaved,
}: {
  student: Awaited<ReturnType<typeof studentsService.fetchStudent>>;
  onSaved: () => void;
}) {
  const [isEditing, setEditing] = useState(false);
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm({
    defaultValues: {
      full_name: student.users.full_name,
      phone: student.users.phone ?? "",
      roll_no: student.roll_no ?? "",
      date_of_birth: student.date_of_birth ?? "",
      gender: student.gender ?? "",
      address: student.address ?? "",
    },
  });

  const updateMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) => studentsService.updateStudent(student.id, values),
    onSuccess: () => {
      onSaved();
      setEditing(false);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: () => studentsService.deactivateStudent(student.id),
    onSuccess: onSaved,
  });

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Personal details</h2>
        <div className="flex gap-2">
          {!isEditing && (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
          {student.users.is_active && (
            <Button variant="danger" onClick={() => deactivateMutation.mutate()} isLoading={deactivateMutation.isPending}>
              Deactivate
            </Button>
          )}
        </div>
      </div>

      {isEditing ? (
        <form
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          onSubmit={handleSubmit((values) => updateMutation.mutate(values))}
        >
          <Input label="Full name" {...register("full_name", { required: true })} />
          <Input label="Phone" {...register("phone")} />
          <Input label="Roll number" {...register("roll_no")} />
          <Input label="Date of birth" type="date" {...register("date_of_birth")} />
          <Select
            label="Gender"
            options={[
              { value: "male", label: "Male" },
              { value: "female", label: "Female" },
              { value: "other", label: "Other" },
            ]}
            placeholder="Select gender"
            {...register("gender")}
          />
          <Input label="Address" {...register("address")} />
          <div className="col-span-full flex gap-3">
            <Button type="submit" isLoading={isSubmitting || updateMutation.isPending}>
              Save changes
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                reset();
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <Field label="Email" value={student.users.email} />
          <Field label="Phone" value={student.users.phone ?? "—"} />
          <Field label="Roll number" value={student.roll_no ?? "—"} />
          <Field label="Date of birth" value={student.date_of_birth ?? "—"} />
          <Field label="Gender" value={student.gender ?? "—"} />
          <Field label="Address" value={student.address ?? "—"} />
          <Field label="Admission date" value={student.admission_date} />
        </dl>
      )}
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-slate-800">{value}</dd>
    </div>
  );
}

// ----------------------------------------------------------------------------
function ClassDetailsCard({
  student,
  classOptions,
  onAssigned,
}: {
  student: Awaited<ReturnType<typeof studentsService.fetchStudent>>;
  classOptions: { value: string; label: string }[];
  onAssigned: () => void;
}) {
  const assignClassMutation = useMutation({
    mutationFn: (classId: string) => studentsService.assignClass(student.id, classId),
    onSuccess: onAssigned,
  });

  return (
    <Card className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Class details</h2>
      <div className="flex items-end gap-4">
        <Select
          key={student.class_id ?? "unassigned"}
          label="Class"
          placeholder="Unassigned"
          options={classOptions}
          defaultValue={student.class_id ?? ""}
          onChange={(e) => e.target.value && assignClassMutation.mutate(e.target.value)}
        />
        {assignClassMutation.isPending && <p className="text-sm text-slate-500">Saving...</p>}
      </div>
    </Card>
  );
}

// ----------------------------------------------------------------------------
function ParentDetailsCard({
  studentId,
  parents,
  isLoading,
  onChanged,
}: {
  studentId: string;
  parents: LinkedParent[];
  isLoading: boolean;
  onChanged: () => void;
}) {
  const [isAddOpen, setAddOpen] = useState(false);
  const [isLinkOpen, setLinkOpen] = useState(false);
  const [editingParent, setEditingParent] = useState<LinkedParent | null>(null);
  const [unlinking, setUnlinking] = useState<LinkedParent | null>(null);
  const [search, setSearch] = useState("");

  const searchQuery = useQuery({
    queryKey: ["admin", "parents", "search", search],
    queryFn: () => parentsService.searchParents(search || undefined),
    enabled: isLinkOpen,
  });

  const {
    register: registerAdd,
    handleSubmit: handleSubmitAdd,
    reset: resetAdd,
    formState: { isSubmitting: isAddSubmitting },
  } = useForm({
    defaultValues: { email: "", full_name: "", phone: "", occupation: "", address: "", relation: "guardian" as ParentRelation },
  });

  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    reset: resetEdit,
  } = useForm({
    defaultValues: { relation: "guardian" as ParentRelation, occupation: "", address: "", phone: "" },
  });

  const addMutation = useMutation({
    mutationFn: (values: parentsService.CreateAndLinkParentInput) =>
      parentsService.createAndLinkParent(studentId, values),
    onSuccess: () => {
      onChanged();
      resetAdd();
      setAddOpen(false);
    },
  });

  const linkMutation = useMutation({
    mutationFn: ({ parentId, relation }: { parentId: string; relation: ParentRelation }) =>
      parentsService.linkExistingParent(studentId, parentId, relation),
    onSuccess: () => {
      onChanged();
      setLinkOpen(false);
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ parentId, patch }: { parentId: string; patch: parentsService.UpdateLinkedParentInput }) =>
      parentsService.updateLinkedParent(studentId, parentId, patch),
    onSuccess: () => {
      onChanged();
      setEditingParent(null);
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: (parentId: string) => parentsService.unlinkParent(studentId, parentId),
    onSuccess: () => {
      onChanged();
      setUnlinking(null);
    },
  });

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Parent / guardian details</h2>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setLinkOpen(true)}>
            Link existing
          </Button>
          <Button onClick={() => setAddOpen(true)}>Add parent</Button>
        </div>
      </div>

      <DataTable<LinkedParent>
        isLoading={isLoading}
        rows={parents}
        rowKey={(p) => p.parents.id}
        emptyMessage="No parents or guardians linked yet."
        columns={[
          { header: "Relation", cell: (p) => p.relation },
          { header: "Name", cell: (p) => p.parents.users.full_name },
          { header: "Email", cell: (p) => p.parents.users.email },
          { header: "Phone", cell: (p) => p.parents.users.phone ?? "—" },
          { header: "Occupation", cell: (p) => p.parents.occupation ?? "—" },
          {
            header: "",
            cell: (p) => (
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  className="!px-2 !py-1 text-xs"
                  onClick={() => {
                    setEditingParent(p);
                    resetEdit({
                      relation: p.relation,
                      occupation: p.parents.occupation ?? "",
                      address: p.parents.address ?? "",
                      phone: p.parents.users.phone ?? "",
                    });
                  }}
                >
                  Edit
                </Button>
                <Button variant="ghost" className="!px-2 !py-1 text-xs text-red-600" onClick={() => setUnlinking(p)}>
                  Unlink
                </Button>
              </div>
            ),
          },
        ]}
      />

      <Modal isOpen={isAddOpen} onClose={() => setAddOpen(false)} title="Add new parent/guardian">
        <form className="space-y-4" onSubmit={handleSubmitAdd((values) => addMutation.mutate(values))}>
          <Input label="Full name" {...registerAdd("full_name", { required: true })} />
          <Input label="Email" type="email" {...registerAdd("email", { required: true })} />
          <Input label="Phone (optional)" {...registerAdd("phone")} />
          <Select label="Relation" options={RELATION_OPTIONS} {...registerAdd("relation")} />
          <Input label="Occupation (optional)" {...registerAdd("occupation")} />
          <Input label="Address (optional)" {...registerAdd("address")} />
          {addMutation.isError && <p className="text-sm text-red-600">Failed to add parent. The email may already be in use.</p>}
          <p className="text-xs text-slate-500">The parent will receive an email invite to set a password.</p>
          <Button type="submit" className="w-full" isLoading={isAddSubmitting || addMutation.isPending}>
            Add and link
          </Button>
        </form>
      </Modal>

      <Modal isOpen={isLinkOpen} onClose={() => setLinkOpen(false)} title="Link existing parent">
        <div className="space-y-4">
          <Input label="Search by name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
          {searchQuery.isLoading && <Spinner label="Searching..." />}
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {(searchQuery.data ?? []).map((parent) => (
              <li key={parent.id} className="flex items-center justify-between rounded-md border border-slate-200 p-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">{parent.users.full_name}</p>
                  <p className="text-xs text-slate-500">{parent.users.email}</p>
                </div>
                <Select
                  label=""
                  className="w-32"
                  options={RELATION_OPTIONS}
                  defaultValue="guardian"
                  onChange={(e) => linkMutation.mutate({ parentId: parent.id, relation: e.target.value as ParentRelation })}
                />
              </li>
            ))}
          </ul>
          {searchQuery.data?.length === 0 && <p className="text-sm text-slate-500">No matching parents found.</p>}
        </div>
      </Modal>

      <Modal isOpen={!!editingParent} onClose={() => setEditingParent(null)} title="Edit parent details">
        <form
          className="space-y-4"
          onSubmit={handleSubmitEdit((values) =>
            editingParent && editMutation.mutate({ parentId: editingParent.parents.id, patch: values })
          )}
        >
          <Select label="Relation" options={RELATION_OPTIONS} {...registerEdit("relation")} />
          <Input label="Phone" {...registerEdit("phone")} />
          <Input label="Occupation" {...registerEdit("occupation")} />
          <Input label="Address" {...registerEdit("address")} />
          <Button type="submit" className="w-full" isLoading={editMutation.isPending}>
            Save changes
          </Button>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!unlinking}
        title="Unlink parent"
        message={`Unlink ${unlinking?.parents.users.full_name} from this student? Their account is not deleted.`}
        confirmLabel="Unlink"
        isLoading={unlinkMutation.isPending}
        onConfirm={() => unlinking && unlinkMutation.mutate(unlinking.parents.id)}
        onCancel={() => setUnlinking(null)}
      />
    </Card>
  );
}

// ----------------------------------------------------------------------------
function DocumentsCard({
  studentId,
  schoolId,
  documents,
  isLoading,
  onChanged,
}: {
  studentId: string;
  schoolId: string;
  documents: Awaited<ReturnType<typeof documentsService.fetchDocuments>>;
  isLoading: boolean;
  onChanged: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState<DocumentType>("other");
  const [notes, setNotes] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setUploading] = useState(false);
  const [deletingDoc, setDeletingDoc] = useState<(typeof documents)[number] | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (documentId: string) => documentsService.deleteDocument(studentId, documentId),
    onSuccess: () => {
      onChanged();
      setDeletingDoc(null);
    },
  });

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      await documentsService.uploadDocument(schoolId, studentId, file, docType, notes || undefined);
      onChanged();
      setNotes("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to upload document");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Documents</h2>

      <DataTable
        isLoading={isLoading}
        rows={documents}
        rowKey={(d) => d.id}
        emptyMessage="No documents uploaded yet."
        columns={[
          { header: "Type", cell: (d) => DOC_TYPE_OPTIONS.find((o) => o.value === d.doc_type)?.label ?? d.doc_type },
          { header: "File", cell: (d) => d.file_name },
          {
            header: "Uploaded",
            cell: (d) => new Date(d.uploaded_at).toLocaleDateString(),
          },
          {
            header: "",
            cell: (d) => (
              <div className="flex gap-2">
                {d.url && (
                  <a href={d.url} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline">
                    View
                  </a>
                )}
                <Button variant="ghost" className="!px-2 !py-1 text-xs text-red-600" onClick={() => setDeletingDoc(d)}>
                  Delete
                </Button>
              </div>
            ),
          },
        ]}
      />

      <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
        <Select
          label="Document type"
          options={DOC_TYPE_OPTIONS}
          value={docType}
          onChange={(e) => setDocType(e.target.value as DocumentType)}
        />
        <Input label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">File</label>
          <input ref={fileInputRef} type="file" className="text-sm" />
        </div>
        <Button onClick={handleUpload} isLoading={isUploading}>
          Upload
        </Button>
      </div>
      {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}

      <ConfirmDialog
        isOpen={!!deletingDoc}
        title="Delete document"
        message={`Delete "${deletingDoc?.file_name}"? This cannot be undone.`}
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deletingDoc && deleteMutation.mutate(deletingDoc.id)}
        onCancel={() => setDeletingDoc(null)}
      />
    </Card>
  );
}
