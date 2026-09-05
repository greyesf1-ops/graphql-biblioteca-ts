import type {
  AuthorRecord,
  BookRecord,
  CreateBookData,
  UpdateBookData,
} from "../domain/types.js";

const seedAuthors: AuthorRecord[] = [
  {
    id: "author-1",
    name: "Ana Torres",
    country: "Guatemala",
    biography: "Investigadora de diseno de APIs y sistemas de informacion.",
  },
  {
    id: "author-2",
    name: "Carlos Mendez",
    country: "Mexico",
    biography: null,
  },
  {
    id: "author-3",
    name: "Lucia Herrera",
    country: "Costa Rica",
    biography: "Docente y divulgadora de arquitectura de software.",
  },
];

const now = "2026-09-01T12:00:00.000Z";

const seedBooks: BookRecord[] = [
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
    createdAt: now,
    updatedAt: now,
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
    createdAt: now,
    updatedAt: now,
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
    createdAt: now,
    updatedAt: now,
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
    createdAt: now,
    updatedAt: now,
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
    createdAt: now,
    updatedAt: now,
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
    createdAt: now,
    updatedAt: now,
  },
];

let authors = structuredClone(seedAuthors);
let books = structuredClone(seedBooks);
let nextBookId = seedBooks.length + 1;
let authorBatchQueryCount = 0;
let bookByAuthorBatchQueryCount = 0;

export const authorRepository = {
  async findByIds(ids: readonly string[]): Promise<(AuthorRecord | null)[]> {
    authorBatchQueryCount += 1;
    console.info(
      `[DataLoader] consulta de autores #${authorBatchQueryCount}; lote=[${ids.join(", ")}]`,
    );

    const byId = new Map(authors.map((author) => [author.id, author]));
    return ids.map((id) => byId.get(id) ?? null);
  },

  exists(id: string): boolean {
    return authors.some((author) => author.id === id);
  },
};

export const bookRepository = {
  findById(id: string): BookRecord | null {
    return books.find((book) => book.id === id) ?? null;
  },

  findAll(): BookRecord[] {
    return [...books];
  },

  /** Devuelve un grupo de libros por cada autor solicitado, en el mismo orden. */
  async findByAuthorIds(
    authorIds: readonly string[],
  ): Promise<BookRecord[][]> {
    bookByAuthorBatchQueryCount += 1;
    console.info(
      `[DataLoader] consulta de libros por autor #${bookByAuthorBatchQueryCount}; lote=[${authorIds.join(", ")}]`,
    );

    const byAuthor = new Map<string, BookRecord[]>();
    for (const book of books) {
      const bucket = byAuthor.get(book.authorId);
      if (bucket) {
        bucket.push(book);
      } else {
        byAuthor.set(book.authorId, [book]);
      }
    }

    return authorIds.map((id) => byAuthor.get(id) ?? []);
  },

  isbnExists(isbn: string, exceptBookId?: string): boolean {
    return books.some(
      (book) => book.isbn === isbn && book.id !== exceptBookId,
    );
  },

  create(data: CreateBookData): BookRecord {
    const timestamp = new Date().toISOString();
    const book: BookRecord = {
      ...data,
      id: `book-${nextBookId++}`,
      shelfCode: "PENDING",
      acquisitionCost: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    books.push(book);
    return book;
  },

  update(id: string, data: UpdateBookData): BookRecord | null {
    const index = books.findIndex((book) => book.id === id);
    const current = books[index];
    if (index < 0 || !current) {
      return null;
    }

    const updated: BookRecord = {
      ...current,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    books[index] = updated;
    return updated;
  },
};

export function resetStore(): void {
  authors = structuredClone(seedAuthors);
  books = structuredClone(seedBooks);
  nextBookId = seedBooks.length + 1;
  authorBatchQueryCount = 0;
  bookByAuthorBatchQueryCount = 0;
}
