import { z } from "zod";

const relationEnum = z.enum(["father", "mother", "guardian"]);

export const searchParentsSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({ search: z.string().optional() }),
  params: z.object({}).optional(),
});

export const createAndLinkParentSchema = z.object({
  body: z.object({
    email: z.string().email(),
    full_name: z.string().min(2),
    phone: z.string().optional(),
    occupation: z.string().optional(),
    address: z.string().optional(),
    relation: relationEnum,
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const linkExistingParentSchema = z.object({
  body: z.object({
    parent_id: z.string().uuid(),
    relation: relationEnum,
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const updateLinkedParentSchema = z.object({
  body: z.object({
    relation: relationEnum.optional(),
    full_name: z.string().min(2).optional(),
    phone: z.string().optional(),
    occupation: z.string().optional(),
    address: z.string().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid(), parentId: z.string().uuid() }),
});

export const unlinkParentSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid(), parentId: z.string().uuid() }),
});
