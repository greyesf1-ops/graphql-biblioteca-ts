import type { BookStatus } from "@prisma/client";

/**
 * Datos minimos compartidos por el seed reproducible (`prisma/seed.ts`) y por
 * `resetStore()` (`src/data/store.ts`), que reutiliza el mismo conjunto para
 * reiniciar la base entre pruebas. Una sola fuente evita que ambos se desincronicen.
 */

export const now = new Date("2026-09-01T12:00:00.000Z");

export const seedAuthors = [
  {
    id: "author-1",
    name: "Ana Torres",
    country: "Guatemala",
    biography: "Investigadora de diseno de APIs y sistemas de informacion.",
  },
  { id: "author-2", name: "Carlos Mendez", country: "Mexico", biography: null },
  {
    id: "author-3",
    name: "Lucia Herrera",
    country: "Costa Rica",
    biography: "Docente y divulgadora de arquitectura de software.",
  },
] as const;

export const seedBooks: ReadonlyArray<{
  id: string;
  title: string;
  summary: string | null;
  isbn: string;
  status: BookStatus;
  publishedYear: number | null;
  authorId: string;
  shelfCode: string;
  acquisitionCost: number;
}> = [
  {
    id: "book-1",
    title: "Diseno de APIs conscientes",
    summary: "Decisiones practicas para contratos de servicios mantenibles.",
    isbn: "9780000000001",
    status: "AVAILABLE",
    publishedYear: 2024,
    authorId: "author-1",
    shelfCode: "TEC-A01",
    acquisitionCost: 175,
  },
  {
    id: "book-2",
    title: "El laberinto de los datos",
    summary: "Una introduccion narrativa al modelado y consulta de datos.",
    isbn: "9780000000002",
    status: "LOANED",
    publishedYear: 2022,
    authorId: "author-1",
    shelfCode: "TEC-A02",
    acquisitionCost: 150,
  },
  {
    id: "book-3",
    title: "TypeScript paso a paso",
    summary: null,
    isbn: "9780000000003",
    status: "AVAILABLE",
    publishedYear: 2025,
    authorId: "author-2",
    shelfCode: "TEC-T01",
    acquisitionCost: 210,
  },
  {
    id: "book-4",
    title: "Sistemas distribuidos sin misterio",
    summary: "Conceptos esenciales explicados mediante ejemplos pequenos.",
    isbn: "9780000000004",
    status: "RESERVED",
    publishedYear: 2023,
    authorId: "author-3",
    shelfCode: "TEC-S01",
    acquisitionCost: 230,
  },
  {
    id: "book-5",
    title: "Arquitectura para equipos",
    summary: "Patrones y conversaciones para construir software en conjunto.",
    isbn: "9780000000005",
    status: "MAINTENANCE",
    publishedYear: null,
    authorId: "author-3",
    shelfCode: "TEC-A03",
    acquisitionCost: 190,
  },
  {
    id: "book-6",
    title: "Consultas que cuentan historias",
    summary: "Seleccion de datos orientada a las necesidades de cada interfaz.",
    isbn: "9780000000006",
    status: "AVAILABLE",
    publishedYear: 2026,
    authorId: "author-2",
    shelfCode: "TEC-Q01",
    acquisitionCost: 200,
  },
];

/** book-2 ya tiene status LOANED en el seed; este prestamo mantiene ambos datos consistentes. */
export const seedLoans: ReadonlyArray<{
  id: string;
  bookId: string;
  borrowerName: string;
}> = [{ id: "loan-1", bookId: "book-2", borrowerName: "Marta Aguilar" }];
