import { z } from "zod";

export const addTeacherDocumentSchema = z.object({
  body: z.object({
    doc_type: z.enum(["resume", "id_proof", "degree_certificate", "experience_letter", "photo", "other"]),
    file_name: z.string().min(1),
    storage_path: z.string().min(1),
    notes: z.string().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const deleteTeacherDocumentSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid(), docId: z.string().uuid() }),
});
