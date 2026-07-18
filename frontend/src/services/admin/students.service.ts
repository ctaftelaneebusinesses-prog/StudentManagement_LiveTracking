import { api } from "@/lib/axios";
import { PaginatedResult, Student, StudentProfile } from "@/types/admin.types";

export interface ListStudentsParams {
  classId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function fetchStudents(params: ListStudentsParams = {}): Promise<PaginatedResult<Student>> {
  const { data } = await api.get("/students", { params });
  return data.data;
}

/** Full profile — personal, class, and linked parent details. */
export async function fetchStudent(id: string): Promise<StudentProfile> {
  const { data } = await api.get(`/students/${id}`);
  return data.data;
}

export interface CreateStudentInput {
  email: string;
  full_name: string;
  phone?: string;
  admission_no: string;
  roll_no?: string;
  date_of_birth?: string;
  gender?: "male" | "female" | "other";
  address?: string;
  class_id?: string;
}

export async function createStudent(input: CreateStudentInput): Promise<Student> {
  const { data } = await api.post("/students", input);
  return data.data;
}

export async function updateStudent(id: string, patch: Partial<CreateStudentInput>): Promise<Student> {
  const { data } = await api.patch(`/students/${id}`, patch);
  return data.data;
}

export async function assignClass(id: string, classId: string): Promise<Student> {
  const { data } = await api.patch(`/students/${id}/class`, { class_id: classId });
  return data.data;
}

export async function deactivateStudent(id: string): Promise<void> {
  await api.delete(`/students/${id}`);
}
