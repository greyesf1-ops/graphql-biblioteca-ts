import { z } from "zod";
import { BOOK_STATUSES } from "./domain/types.js";
import { MAX_PAGE_SIZE } from "./security.js";

const currentYear = new Date().getFullYear();

const nullableSummary = z
  .string()
  .trim()
  .min(10, "El resumen debe tener al menos 10 caracteres.")
  .max(500, "El resumen no puede superar 500 caracteres.")
  .nullable();

const nullablePublishedYear = z
  .number()
  .int("El ano de publicacion debe ser entero.")
  .min(1450, "El ano de publicacion no puede ser anterior a 1450.")
  .max(
    currentYear + 1,
    `El ano de publicacion no puede ser posterior a ${currentYear + 1}.`,
  )
  .nullable();

export const createBookInputSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, "El titulo debe tener al menos 3 caracteres.")
      .max(120, "El titulo no puede superar 120 caracteres."),
    summary: nullableSummary.optional().default(null),
    isbn: z
      .string()
      .trim()
      .regex(/^\d{10}(?:\d{3})?$/, "El ISBN debe contener 10 o 13 digitos."),
    status: z.enum(BOOK_STATUSES).optional().default("AVAILABLE"),
    publishedYear: nullablePublishedYear.optional().default(null),
    authorId: z.string().trim().min(1, "El identificador del autor es obligatorio."),
  })
  .strict();

export const updateBookInputSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, "El titulo debe tener al menos 3 caracteres.")
      .max(120, "El titulo no puede superar 120 caracteres.")
      .optional(),
    summary: nullableSummary.optional(),
    isbn: z
      .string()
      .trim()
      .regex(/^\d{10}(?:\d{3})?$/, "El ISBN debe contener 10 o 13 digitos.")
      .optional(),
    status: z.enum(BOOK_STATUSES).optional(),
    publishedYear: nullablePublishedYear.optional(),
    authorId: z
      .string()
      .trim()
      .min(1, "El identificador del autor es obligatorio.")
      .optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Debe enviar al menos un campo para modificar.",
  });

export const filterSchema = z
  .object({
    search: z.string().trim().max(100).optional(),
    status: z.enum(BOOK_STATUSES).optional(),
    authorId: z.string().trim().min(1).optional(),
  })
  .strict();

export const createLoanInputSchema = z
  .object({
    bookId: z.string().trim().min(1, "El identificador del libro es obligatorio."),
    borrowerName: z
      .string()
      .trim()
      .min(3, "El nombre de quien solicita el prestamo debe tener al menos 3 caracteres.")
      .max(120, "El nombre no puede superar 120 caracteres."),
  })
  .strict();

export const paginationSchema = z
  .object({
    page: z.number().int().min(1, "page debe ser al menos 1."),
    pageSize: z
      .number()
      .int()
      .min(1, "pageSize debe ser al menos 1.")
      .max(
        MAX_PAGE_SIZE,
        `pageSize no puede superar el limite de ${MAX_PAGE_SIZE}.`,
      ),
  })
  .strict();
