import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { getApiErrorMessage } from "@/lib/axios";
import { useAuth } from "@/hooks/useAuth";
import * as portalService from "@/services/teacher/portal.service";
import * as marksService from "@/services/teacher/marks.service";
import * as evaluatedPapersService from "@/services/teacher/evaluatedPapers.service";
import { ClassSubjectMarksStatus, TeacherClassSummary } from "@/types/teacher.types";

type TeacherMarksTab = "entry" | "overview" | "papers";

export function TeacherMarksPage() {
  const dashboardQuery = useQuery({ queryKey: ["teacher", "dashboard"], queryFn: portalService.fetchDashboard });
  const classes = dashboardQuery.data?.classes ?? [];
  const homeroomClasses = classes.filter((c) => c.isHomeroom);
  const [tab, setTab] = useState<TeacherMarksTab>("entry");
  const showOverviewTab = homeroomClasses.length > 0;
  const activeTab = tab === "overview" && !showOverviewTab ? "entry" : tab;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Marks</h1>
        <p className="text-sm text-slate-500">
          {showOverviewTab
            ? "Enter marks for your subjects, upload evaluated papers, and track your class's marks completion."
            : "Enter exam marks and upload evaluated papers for your classes."}
        </p>
      </div>

      <Tabs
        tabs={[
          { key: "entry", label: "Marks Entry" },
          ...(showOverviewTab ? [{ key: "overview" as const, label: "Class Overview" }] : []),
          { key: "papers", label: "Evaluated Papers" },
        ]}
        active={activeTab}
        onChange={setTab}
      />

      {activeTab === "entry" && <MarksEntryPanel classes={classes} />}
      {activeTab === "overview" && <ClassOverviewPanel homeroomClasses={homeroomClasses} />}
      {activeTab === "papers" && <EvaluatedPapersPanel classes={classes} />}
    </div>
  );
}

function MarksEntryPanel({ classes }: { classes: TeacherClassSummary[] }) {
  const queryClient = useQueryClient();
  const [classId, setClassId] = useState("");
  const [examId, setExamId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [isExamModalOpen, setExamModalOpen] = useState(false);
  const [marksDraft, setMarksDraft] = useState<Record<string, { marks_obtained: string; max_marks: string; grade: string }>>({});
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const classOptions = classes.map((c) => ({ value: c.id, label: `${c.name} - ${c.section}` }));
  const selectedClass = classes.find((c) => c.id === classId);
  const subjectOptions = (selectedClass?.subjects ?? []).map((s) => ({ value: s.id, label: `${s.name} (${s.code})` }));

  const examsQuery = useQuery({
    queryKey: ["teacher", "exams", classId],
    queryFn: () => marksService.fetchExams(classId),
    enabled: !!classId,
  });
  const examOptions = (examsQuery.data ?? []).map((e) => ({ value: e.id, label: e.name }));

  const rosterQuery = useQuery({
    queryKey: ["teacher", "roster", classId],
    queryFn: () => portalService.fetchRoster(classId),
    enabled: !!classId,
  });

  const marksQuery = useQuery({
    queryKey: ["teacher", "marks", examId],
    queryFn: () => marksService.fetchMarksForExam(examId),
    enabled: !!examId,
  });

  useEffect(() => {
    if (!rosterQuery.data || !subjectId) return;
    const existingByStudent = new Map(
      (marksQuery.data ?? []).filter((m) => m.subject_id === subjectId).map((m) => [m.student_id, m])
    );
    const next: Record<string, { marks_obtained: string; max_marks: string; grade: string }> = {};
    for (const student of rosterQuery.data) {
      const existing = existingByStudent.get(student.id);
      next[student.id] = {
        marks_obtained: existing ? String(existing.marks_obtained) : "",
        max_marks: existing ? String(existing.max_marks) : "100",
        grade: existing?.grade ?? "",
      };
    }
    setMarksDraft(next);
    setSaveMessage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rosterQuery.data, marksQuery.data, subjectId]);

  const createExamMutation = useMutation({
    mutationFn: marksService.createExam,
    onSuccess: (exam) => {
      queryClient.invalidateQueries({ queryKey: ["teacher", "exams", classId] });
      setExamId(exam.id);
      setExamModalOpen(false);
    },
  });

  const saveMarksMutation = useMutation({
    mutationFn: () =>
      marksService.upsertMarks(
        examId,
        Object.entries(marksDraft)
          .filter(([, v]) => v.marks_obtained !== "")
          .map(([student_id, v]) => ({
            student_id,
            subject_id: subjectId,
            marks_obtained: Number(v.marks_obtained),
            max_marks: v.max_marks ? Number(v.max_marks) : undefined,
            grade: v.grade || undefined,
          }))
      ),
    onSuccess: () => {
      setSaveMessage("Marks saved.");
      marksQuery.refetch();
    },
  });

  const bySubject = useMemo(() => {
    const groups = new Map<string, typeof marksQuery.data>();
    for (const m of marksQuery.data ?? []) {
      const key = m.subjects?.name ?? m.subject_id;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(m);
    }
    return Array.from(groups.entries());
  }, [marksQuery.data]);

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <Select
            label="Class"
            name="marksClassId"
            placeholder="Select class"
            options={classOptions}
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setExamId("");
              setSubjectId("");
            }}
          />
          <Select
            label="Exam"
            name="examId"
            placeholder="Select exam"
            options={examOptions}
            value={examId}
            onChange={(e) => setExamId(e.target.value)}
          />
          <Button variant="secondary" disabled={!classId} onClick={() => setExamModalOpen(true)}>
            New exam
          </Button>
          <Select
            label="Subject"
            name="subjectId"
            placeholder="Select subject"
            options={subjectOptions}
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
          />
        </div>

        {!classId || !examId || !subjectId ? (
          <p className="text-sm text-slate-500">Select a class, exam, and subject to enter marks.</p>
        ) : rosterQuery.isLoading || marksQuery.isLoading ? (
          <Spinner label="Loading students..." />
        ) : (
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Student</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Marks obtained</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Max marks</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {(rosterQuery.data ?? []).map((student) => (
                    <tr key={student.id}>
                      <td className="px-4 py-3 text-slate-700">{student.users.full_name}</td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm"
                          value={marksDraft[student.id]?.marks_obtained ?? ""}
                          onChange={(e) =>
                            setMarksDraft((prev) => ({
                              ...prev,
                              [student.id]: { ...prev[student.id], marks_obtained: e.target.value },
                            }))
                          }
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm"
                          value={marksDraft[student.id]?.max_marks ?? "100"}
                          onChange={(e) =>
                            setMarksDraft((prev) => ({
                              ...prev,
                              [student.id]: { ...prev[student.id], max_marks: e.target.value },
                            }))
                          }
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm"
                          value={marksDraft[student.id]?.grade ?? ""}
                          onChange={(e) =>
                            setMarksDraft((prev) => ({
                              ...prev,
                              [student.id]: { ...prev[student.id], grade: e.target.value },
                            }))
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {saveMessage && <p className="text-sm text-green-600">{saveMessage}</p>}
            {saveMarksMutation.isError && <p className="text-sm text-red-600">Failed to save marks.</p>}
            <Button onClick={() => saveMarksMutation.mutate()} isLoading={saveMarksMutation.isPending}>
              Save marks
            </Button>
          </div>
        )}
      </Card>

      {examId && (
        <Card className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Subject-wise marks for this exam</h2>
          {bySubject.length === 0 ? (
            <p className="text-sm text-slate-500">No marks recorded yet.</p>
          ) : (
            bySubject.map(([subjectName, rows]) => (
              <div key={subjectName}>
                <h3 className="mb-2 text-sm font-semibold text-slate-700">{subjectName}</h3>
                <ul className="space-y-1 text-sm">
                  {(rows ?? []).map((r) => (
                    <li key={r.id} className="flex justify-between rounded-md border border-slate-100 px-3 py-1.5">
                      <span className="text-slate-600">{r.students?.users.full_name ?? r.student_id}</span>
                      <span className="text-slate-800">
                        {r.marks_obtained} / {r.max_marks} {r.grade ? `(${r.grade})` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </Card>
      )}

      <ExamModal
        isOpen={isExamModalOpen}
        classId={classId}
        onClose={() => setExamModalOpen(false)}
        onCreate={(values) => createExamMutation.mutate(values)}
        isSubmitting={createExamMutation.isPending}
        isError={createExamMutation.isError}
      />
    </div>
  );
}

function ExamModal({
  isOpen,
  classId,
  onClose,
  onCreate,
  isSubmitting,
  isError,
}: {
  isOpen: boolean;
  classId: string;
  onClose: () => void;
  onCreate: (values: marksService.CreateExamInput) => void;
  isSubmitting: boolean;
  isError: boolean;
}) {
  const { register, handleSubmit, reset } = useForm({ defaultValues: { name: "", exam_date: "" } });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create exam">
      <form
        className="space-y-4"
        onSubmit={handleSubmit((values) => {
          onCreate({ class_id: classId, name: values.name, exam_date: values.exam_date || undefined });
          reset();
        })}
      >
        <Input label="Exam name" {...register("name", { required: true })} />
        <Input label="Exam date (optional)" type="date" {...register("exam_date")} />
        {isError && <p className="text-sm text-red-600">Failed to create exam.</p>}
        <Button type="submit" className="w-full" isLoading={isSubmitting}>
          Create
        </Button>
      </form>
    </Modal>
  );
}

function ClassOverviewPanel({ homeroomClasses }: { homeroomClasses: TeacherClassSummary[] }) {
  const toast = useToast();
  const [classId, setClassId] = useState(homeroomClasses[0]?.id ?? "");
  const [examId, setExamId] = useState("");

  const classOptions = homeroomClasses.map((c) => ({ value: c.id, label: `${c.name} - ${c.section}` }));

  const examsQuery = useQuery({
    queryKey: ["teacher", "exams", classId],
    queryFn: () => marksService.fetchExams(classId),
    enabled: !!classId,
  });
  const examOptions = (examsQuery.data ?? []).map((e) => ({ value: e.id, label: e.name }));

  const statusQuery = useQuery({
    queryKey: ["teacher", "marks-status", classId, examId],
    queryFn: () => marksService.fetchClassSubjectStatus(examId, classId),
    enabled: !!classId && !!examId,
  });

  const reminderMutation = useMutation({
    mutationFn: (subjectId: string) => marksService.sendMarksReminder(examId, subjectId, classId),
    onSuccess: () => toast.success("Reminder sent."),
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to send reminder.")),
  });

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <Select
          label="Class"
          options={classOptions}
          value={classId}
          onChange={(e) => {
            setClassId(e.target.value);
            setExamId("");
          }}
        />
        <Select
          label="Exam"
          placeholder="Select exam"
          options={examOptions}
          value={examId}
          onChange={(e) => setExamId(e.target.value)}
        />
      </div>

      {!examId ? (
        <p className="text-sm text-slate-500">Select an exam to see each subject's marks completion status.</p>
      ) : (
        <DataTable<ClassSubjectMarksStatus>
          isLoading={statusQuery.isLoading}
          rows={statusQuery.data ?? []}
          rowKey={(s) => s.subjectId}
          emptyMessage="No subjects are assigned to this class yet."
          columns={[
            { header: "Subject", cell: (s) => `${s.subjectName} (${s.subjectCode})` },
            { header: "Assigned teacher", cell: (s) => s.teacherName },
            {
              header: "Marks status",
              cell: (s) => (
                <Badge variant={s.status === "completed" ? "success" : "warning"}>
                  {s.status === "completed" ? "Completed" : `Pending (${s.markedCount}/${s.rosterCount})`}
                </Badge>
              ),
            },
            {
              header: "Last updated",
              cell: (s) => (s.lastUpdated ? new Date(s.lastUpdated).toLocaleString() : "—"),
            },
            {
              header: "",
              cell: (s) =>
                s.status === "pending" && s.teacherId ? (
                  <Button
                    variant="ghost"
                    className="!px-2 !py-1 text-xs"
                    isLoading={reminderMutation.isPending}
                    onClick={() => reminderMutation.mutate(s.subjectId)}
                  >
                    Remind
                  </Button>
                ) : null,
            },
          ]}
        />
      )}
    </Card>
  );
}

/** Uploads one student's corrected/graded answer sheet for a chosen exam + subject — mirrors MarksEntryPanel's class/exam/subject selectors and roster query. */
function EvaluatedPapersPanel({ classes }: { classes: TeacherClassSummary[] }) {
  const { user } = useAuth();
  const toast = useToast();
  const [classId, setClassId] = useState("");
  const [examId, setExamId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [uploadingStudentId, setUploadingStudentId] = useState<string | null>(null);
  const [uploadedStudentIds, setUploadedStudentIds] = useState<Set<string>>(new Set());

  const classOptions = classes.map((c) => ({ value: c.id, label: `${c.name} - ${c.section}` }));
  const selectedClass = classes.find((c) => c.id === classId);
  const subjectOptions = (selectedClass?.subjects ?? []).map((s) => ({ value: s.id, label: `${s.name} (${s.code})` }));

  const examsQuery = useQuery({
    queryKey: ["teacher", "exams", classId],
    queryFn: () => marksService.fetchExams(classId),
    enabled: !!classId,
  });
  const examOptions = (examsQuery.data ?? []).map((e) => ({ value: e.id, label: e.name }));

  const rosterQuery = useQuery({
    queryKey: ["teacher", "roster", classId],
    queryFn: () => portalService.fetchRoster(classId),
    enabled: !!classId,
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ studentId, file }: { studentId: string; file: File }) => {
      const storagePath = await evaluatedPapersService.uploadEvaluatedPaperFile(user!.school_id!, studentId, file);
      return evaluatedPapersService.addEvaluatedPaper(studentId, {
        exam_id: examId,
        subject_id: subjectId,
        file_name: file.name,
        storage_path: storagePath,
      });
    },
    onSuccess: (_result, { studentId }) => {
      setUploadedStudentIds((prev) => new Set(prev).add(studentId));
      toast.success("Evaluated paper uploaded.");
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to upload the evaluated paper.")),
    onSettled: () => setUploadingStudentId(null),
  });

  function handleFileSelected(studentId: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      setUploadingStudentId(studentId);
      uploadMutation.mutate({ studentId, file });
    }
    event.target.value = "";
  }

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <Select
          label="Class"
          placeholder="Select class"
          options={classOptions}
          value={classId}
          onChange={(e) => {
            setClassId(e.target.value);
            setExamId("");
            setSubjectId("");
          }}
        />
        <Select
          label="Exam"
          placeholder="Select exam"
          options={examOptions}
          value={examId}
          onChange={(e) => setExamId(e.target.value)}
        />
        <Select
          label="Subject"
          placeholder="Select subject"
          options={subjectOptions}
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
        />
      </div>

      {!classId || !examId || !subjectId ? (
        <p className="text-sm text-slate-500">Select a class, exam, and subject to upload evaluated papers.</p>
      ) : rosterQuery.isLoading ? (
        <Spinner label="Loading students..." />
      ) : (
        <DataTable
          rows={rosterQuery.data ?? []}
          rowKey={(s) => s.id}
          emptyMessage="No students in this class yet."
          columns={[
            { header: "Student", cell: (s) => s.users.full_name },
            { header: "Admission No.", cell: (s) => s.admission_no },
            {
              header: "",
              className: "text-right",
              cell: (s) => (
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs">
                  {uploadedStudentIds.has(s.id) && <Badge variant="success">Uploaded</Badge>}
                  <span className="rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 dark:border-white/20 dark:text-slate-200 dark:hover:bg-white/10">
                    {uploadingStudentId === s.id && uploadMutation.isPending ? "Uploading…" : "Upload paper"}
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    disabled={uploadMutation.isPending}
                    onChange={(e) => handleFileSelected(s.id, e)}
                  />
                </label>
              ),
            },
          ]}
        />
      )}
    </Card>
  );
}
