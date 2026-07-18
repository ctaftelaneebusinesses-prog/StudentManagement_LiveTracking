import { z } from "zod";

export const addDocumentSchema = z.object({
  body: z.object({
    doc_type: z.enum(["birth_certificate", "id_proof", "transfer_certificate", "photo", "medical", "other"]),
    file_name: z.string().min(1),
    storage_path: z.string().min(1),
    notes: z.string().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const deleteDocumentSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid(), docId: z.string().uuid() }),
});
