import { randomUUID } from "node:crypto";
import { Prisma, type Book as PrismaBook, type Loan as PrismaLoan } from "@prisma/client";
import { now, seedAuthors, seedBooks, seedLoans } from "../../prisma/seed-data.js";
import { LoanAlreadyActiveError } from "../domain/errors.js";
import type {
  AuthorRecord,
  BookRecord,
  CreateBookData,
  CreateLoanData,
  LoanRecord,
  UpdateBookData,
} from "../domain/types.js";
import { prisma } from "./prisma.js";

let authorBatchQueryCount = 0;
let bookByAuthorBatchQueryCount = 0;

/** Traduce las fechas nativas de Prisma al formato ISO que espera el dominio y GraphQL. */
function toBookRecord(book: PrismaBook): BookRecord {
  return {
    ...book,
    createdAt: book.createdAt.toISOString(),
    updatedAt: book.updatedAt.toISOString(),
  };
}

function toLoanRecord(loan: PrismaLoan): LoanRecord {
  return {
    ...loan,
    loanedAt: loan.loanedAt.toISOString(),
    returnedAt: loan.returnedAt ? loan.returnedAt.toISOString() : null,
  };
}

export const authorRepository = {
  /** Un solo `findMany` por lote: DataLoader agrupa los ids antes de llegar aqui. */
  async findByIds(ids: readonly string[]): Promise<(AuthorRecord | null)[]> {
    authorBatchQueryCount += 1;
    console.info(
      `[DataLoader] consulta de autores #${authorBatchQueryCount}; lote=[${ids.join(", ")}]`,
    );

    const found = await prisma.author.findMany({
      where: { id: { in: [...ids] } },
    });
    const byId = new Map(found.map((author) => [author.id, author]));
    return ids.map((id) => byId.get(id) ?? null);
  },

  async exists(id: string): Promise<boolean> {
    const author = await prisma.author.findUnique({ where: { id }, select: { id: true } });
    return author !== null;
  },
};

export const bookRepository = {
  async findById(id: string): Promise<BookRecord | null> {
    const book = await prisma.book.findUnique({ where: { id } });
    return book ? toBookRecord(book) : null;
  },

  async findAll(): Promise<BookRecord[]> {
    const books = await prisma.book.findMany({ orderBy: { id: "asc" } });
    return books.map(toBookRecord);
  },

  /** Devuelve un grupo de libros por cada autor solicitado, en el mismo orden. */
  async findByAuthorIds(authorIds: readonly string[]): Promise<BookRecord[][]> {
    bookByAuthorBatchQueryCount += 1;
    console.info(
      `[DataLoader] consulta de libros por autor #${bookByAuthorBatchQueryCount}; lote=[${authorIds.join(", ")}]`,
    );

    const found = await prisma.book.findMany({
      where: { authorId: { in: [...authorIds] } },
      orderBy: { id: "asc" },
    });
    const byAuthor = new Map<string, BookRecord[]>();
    for (const book of found) {
      const bucket = byAuthor.get(book.authorId);
      const record = toBookRecord(book);
      if (bucket) {
        bucket.push(record);
      } else {
        byAuthor.set(book.authorId, [record]);
      }
    }

    return authorIds.map((id) => byAuthor.get(id) ?? []);
  },

  async isbnExists(isbn: string, exceptBookId?: string): Promise<boolean> {
    const match = await prisma.book.findFirst({
      where: { isbn, ...(exceptBookId ? { id: { not: exceptBookId } } : {}) },
      select: { id: true },
    });
    return match !== null;
  },

  async create(data: CreateBookData): Promise<BookRecord> {
    const book = await prisma.book.create({
      data: { ...data, id: `book-${randomUUID()}` },
    });
    return toBookRecord(book);
  },

  async update(id: string, data: UpdateBookData): Promise<BookRecord | null> {
    try {
      const book = await prisma.book.update({ where: { id }, data });
      return toBookRecord(book);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        return null;
      }
      throw error;
    }
  },
};

export const loanRepository = {
  async findById(id: string): Promise<LoanRecord | null> {
    const loan = await prisma.loan.findUnique({ where: { id } });
    return loan ? toLoanRecord(loan) : null;
  },

  async findActiveByBookId(bookId: string): Promise<LoanRecord | null> {
    const loan = await prisma.loan.findFirst({ where: { bookId, returnedAt: null } });
    return loan ? toLoanRecord(loan) : null;
  },

  /**
   * Crea el prestamo y marca el libro como LOANED en una sola transaccion.
   * Si dos solicitudes concurrentes pasan la verificacion previa a la vez, el
   * indice unico parcial de la migracion rechaza la segunda insercion (P2002)
   * y la traducimos a un error de dominio en lugar de dejar pasar el SQLSTATE.
   */
  async create(data: CreateLoanData): Promise<LoanRecord> {
    try {
      const loan = await prisma.$transaction(async (tx) => {
        const created = await tx.loan.create({
          data: { ...data, id: `loan-${randomUUID()}` },
        });
        await tx.book.update({ where: { id: data.bookId }, data: { status: "LOANED" } });
        return created;
      });
      return toLoanRecord(loan);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new LoanAlreadyActiveError(data.bookId);
      }
      throw error;
    }
  },

  async markReturned(id: string): Promise<LoanRecord> {
    const loan = await prisma.$transaction(async (tx) => {
      const updated = await tx.loan.update({
        where: { id },
        data: { returnedAt: new Date() },
      });
      await tx.book.update({ where: { id: updated.bookId }, data: { status: "AVAILABLE" } });
      return updated;
    });
    return toLoanRecord(loan);
  },
};

/** Solo para pruebas: reinicia la base al contenido del seed compartido. */
export async function resetStore(): Promise<void> {
  await prisma.loan.deleteMany();
  await prisma.book.deleteMany();
  await prisma.author.deleteMany();

  for (const author of seedAuthors) {
    await prisma.author.create({ data: author });
  }
  for (const book of seedBooks) {
    await prisma.book.create({ data: { ...book, createdAt: now, updatedAt: now } });
  }
  for (const loan of seedLoans) {
    await prisma.loan.create({ data: { ...loan, loanedAt: now } });
  }

  authorBatchQueryCount = 0;
  bookByAuthorBatchQueryCount = 0;
}
