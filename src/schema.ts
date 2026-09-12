import { readFileSync } from "node:fs";
import { GraphQLError } from "graphql";
import { createSchema } from "graphql-yoga";
import type { GraphQLContext } from "./context.js";
import { authorRepository, bookRepository, loanRepository } from "./data/store.js";
import { LoanAlreadyActiveError } from "./domain/errors.js";
import type {
  AuthorRecord,
  BookRecord,
  BookStatus,
  CreateBookData,
  LoanRecord,
  UpdateBookData,
} from "./domain/types.js";
import { badUserInput, conflict, notFound } from "./errors.js";
import { MAX_PAGE_SIZE } from "./security.js";
import {
  createBookInputSchema,
  createLoanInputSchema,
  filterSchema,
  paginationSchema,
  updateBookInputSchema,
} from "./validation.js";

const typeDefs = readFileSync(
  new URL("../schema.graphql", import.meta.url),
  "utf8",
);

interface BookFilterInput {
  search?: string | null;
  status?: BookStatus | null;
  authorId?: string | null;
}

interface PaginationInput {
  page?: number | null;
  pageSize?: number | null;
}

interface RawCreateBookInput {
  title: string;
  summary?: string | null;
  isbn: string;
  status?: BookStatus | null;
  publishedYear?: number | null;
  authorId: string;
}

interface RawUpdateBookInput {
  title?: string | null;
  summary?: string | null;
  isbn?: string | null;
  status?: BookStatus | null;
  publishedYear?: number | null;
  authorId?: string | null;
}

function withoutNullishValues<T extends object>(input: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

export const schema = createSchema<GraphQLContext>({
  typeDefs,
  resolvers: {
    Query: {
      book: (_parent: unknown, args: { id: string }) => {
        const id = args.id.trim();
        if (!id) {
          throw badUserInput("El identificador del libro es obligatorio.");
        }
        return bookRepository.findById(id);
      },

      books: async (
        _parent: unknown,
        args: {
          filter?: BookFilterInput | null;
          pagination?: PaginationInput | null;
        },
      ) => {
        const filterResult = filterSchema.safeParse(
          withoutNullishValues(args.filter ?? {}),
        );
        if (!filterResult.success) {
          throw badUserInput("El filtro no es valido.", filterResult.error.issues);
        }

        const paginationResult = paginationSchema.safeParse({
          page: args.pagination?.page ?? 1,
          pageSize: args.pagination?.pageSize ?? 5,
        });
        if (!paginationResult.success) {
          throw badUserInput(
            "La paginacion no es valida.",
            paginationResult.error.issues,
          );
        }

        const { search, status, authorId } = filterResult.data;
        const normalizedSearch = search?.toLocaleLowerCase("es");
        const allBooks = await bookRepository.findAll();
        const filtered = allBooks.filter((book) => {
          const matchesSearch =
            !normalizedSearch ||
            book.title.toLocaleLowerCase("es").includes(normalizedSearch) ||
            (book.summary ?? "")
              .toLocaleLowerCase("es")
              .includes(normalizedSearch) ||
            book.isbn.includes(normalizedSearch);
          const matchesStatus = !status || book.status === status;
          const matchesAuthor = !authorId || book.authorId === authorId;
          return matchesSearch && matchesStatus && matchesAuthor;
        });

        const { page, pageSize } = paginationResult.data;
        const totalItems = filtered.length;
        const totalPages = Math.ceil(totalItems / pageSize);
        const start = (page - 1) * pageSize;

        return {
          items: filtered.slice(start, start + pageSize),
          pageInfo: {
            page,
            pageSize,
            totalItems,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1 && totalPages > 0,
          },
        };
      },
    },

    Mutation: {
      createBook: async (
        _parent: unknown,
        args: { input: RawCreateBookInput },
      ) => {
        const parsed = createBookInputSchema.safeParse(
          withoutNullishValues(args.input),
        );
        if (!parsed.success) {
          throw badUserInput(
            "No se pudo crear el libro: revise los datos enviados.",
            parsed.error.issues,
          );
        }

        if (!(await authorRepository.exists(parsed.data.authorId))) {
          throw notFound("El autor", parsed.data.authorId);
        }
        if (await bookRepository.isbnExists(parsed.data.isbn)) {
          throw conflict(`Ya existe un libro con ISBN '${parsed.data.isbn}'.`);
        }

        return bookRepository.create(parsed.data satisfies CreateBookData);
      },

      updateBook: async (
        _parent: unknown,
        args: { id: string; input: RawUpdateBookInput },
      ) => {
        const id = args.id.trim();
        const existing = await bookRepository.findById(id);
        if (!existing) {
          throw notFound("El libro", id);
        }

        const parsed = updateBookInputSchema.safeParse(
          withoutNullishValues(args.input),
        );
        if (!parsed.success) {
          throw badUserInput(
            "No se pudo modificar el libro: revise los datos enviados.",
            parsed.error.issues,
          );
        }

        if (
          parsed.data.authorId &&
          !(await authorRepository.exists(parsed.data.authorId))
        ) {
          throw notFound("El autor", parsed.data.authorId);
        }
        if (
          parsed.data.isbn &&
          (await bookRepository.isbnExists(parsed.data.isbn, id))
        ) {
          throw conflict(`Ya existe otro libro con ISBN '${parsed.data.isbn}'.`);
        }

        const updateData: UpdateBookData = {};
        if (parsed.data.title !== undefined) {
          updateData.title = parsed.data.title;
        }
        if (parsed.data.summary !== undefined) {
          updateData.summary = parsed.data.summary;
        }
        if (parsed.data.isbn !== undefined) {
          updateData.isbn = parsed.data.isbn;
        }
        if (parsed.data.status !== undefined) {
          updateData.status = parsed.data.status;
        }
        if (parsed.data.publishedYear !== undefined) {
          updateData.publishedYear = parsed.data.publishedYear;
        }
        if (parsed.data.authorId !== undefined) {
          updateData.authorId = parsed.data.authorId;
        }

        const updated = await bookRepository.update(id, updateData);
        if (!updated) {
          throw notFound("El libro", id);
        }
        return updated;
      },

      createLoan: async (
        _parent: unknown,
        args: { input: { bookId: string; borrowerName: string } },
      ) => {
        const parsed = createLoanInputSchema.safeParse(args.input);
        if (!parsed.success) {
          throw badUserInput(
            "No se pudo registrar el prestamo: revise los datos enviados.",
            parsed.error.issues,
          );
        }

        const book = await bookRepository.findById(parsed.data.bookId);
        if (!book) {
          throw notFound("El libro", parsed.data.bookId);
        }
        if (await loanRepository.findActiveByBookId(parsed.data.bookId)) {
          throw conflict(
            `El libro '${parsed.data.bookId}' ya tiene un prestamo activo.`,
          );
        }

        try {
          return await loanRepository.create(parsed.data);
        } catch (error) {
          if (error instanceof LoanAlreadyActiveError) {
            throw conflict(error.message);
          }
          throw error;
        }
      },

      returnLoan: async (_parent: unknown, args: { id: string }) => {
        const id = args.id.trim();
        const loan = await loanRepository.findById(id);
        if (!loan) {
          throw notFound("El prestamo", id);
        }
        if (loan.returnedAt) {
          throw conflict(`El prestamo '${id}' ya fue devuelto.`);
        }
        return loanRepository.markReturned(id);
      },
    },

    Book: {
      author: async (
        book: BookRecord,
        _args: unknown,
        context: GraphQLContext,
      ) => {
        const author = await context.authorLoader.load(book.authorId);
        if (!author) {
          throw new GraphQLError("No fue posible resolver el autor del libro.", {
            extensions: { code: "INTERNAL_SERVER_ERROR" },
          });
        }
        return author;
      },

      activeLoan: (book: BookRecord) =>
        loanRepository.findActiveByBookId(book.id),
    },

    Loan: {
      book: async (loan: LoanRecord, _args: unknown, context: GraphQLContext) => {
        const book = await context.bookLoader.load(loan.bookId);
        if (!book) {
          throw new GraphQLError("No fue posible resolver el libro del prestamo.", {
            extensions: { code: "INTERNAL_SERVER_ERROR" },
          });
        }
        return book;
      },
    },

    Author: {
      books: async (
        author: AuthorRecord,
        args: { status?: BookStatus | null; first?: number | null },
        context: GraphQLContext,
      ) => {
        const first = args.first ?? 5;
        if (!Number.isInteger(first) || first < 1 || first > MAX_PAGE_SIZE) {
          throw badUserInput(
            `first debe ser un entero entre 1 y ${MAX_PAGE_SIZE}.`,
          );
        }

        const authored = await context.booksByAuthorLoader.load(author.id);
        const status = args.status ?? null;
        const selected = status
          ? authored.filter((book) => book.status === status)
          : authored;

        return selected.slice(0, first);
      },
    },
  },
});
