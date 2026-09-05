export const BOOK_STATUSES = [
  "AVAILABLE",
  "LOANED",
  "RESERVED",
  "MAINTENANCE",
] as const;

export type BookStatus = (typeof BOOK_STATUSES)[number];

export interface AuthorRecord {
  id: string;
  name: string;
  country: string;
  biography: string | null;
}

/**
 * Modelo interno. shelfCode y acquisitionCost no forman parte del esquema
 * publico: el contrato GraphQL se disena para el cliente, no copia el almacen.
 */
export interface BookRecord {
  id: string;
  title: string;
  summary: string | null;
  isbn: string;
  status: BookStatus;
  publishedYear: number | null;
  authorId: string;
  shelfCode: string;
  acquisitionCost: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBookData {
  title: string;
  summary: string | null;
  isbn: string;
  status: BookStatus;
  publishedYear: number | null;
  authorId: string;
}

export type UpdateBookData = Partial<CreateBookData>;
