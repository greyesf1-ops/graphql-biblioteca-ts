import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  authorRepository,
  bookRepository,
  resetStore,
} from "../src/data/store.js";
import { yoga } from "../src/server.js";

interface GraphQLResponse {
  data?: Record<string, unknown> | null;
  errors?: Array<{
    message: string;
    extensions?: Record<string, unknown>;
  }>;
}

async function execute(
  query: string,
  variables: Record<string, unknown>,
  operationName: string,
): Promise<GraphQLResponse> {
  const response = await yoga.fetch("http://localhost/graphql", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables, operationName }),
  });

  return (await response.json()) as GraphQLResponse;
}

beforeEach(async () => {
  await resetStore();
  vi.restoreAllMocks();
});

describe("API GraphQL de biblioteca", () => {
  it("pagina, filtra y carga autores de varios libros en un solo lote", async () => {
    const batchSpy = vi.spyOn(authorRepository, "findByIds");
    const result = await execute(
      `query ListBooks($filter: BookFilterInput, $pagination: PaginationInput) {
        books(filter: $filter, pagination: $pagination) {
          items { id title author { id name } }
          pageInfo { page pageSize totalItems hasNextPage }
        }
      }`,
      { filter: {}, pagination: { page: 1, pageSize: 5 } },
      "ListBooks",
    );

    expect(result.errors).toBeUndefined();
    const books = result.data?.books as {
      items: unknown[];
      pageInfo: { totalItems: number; hasNextPage: boolean };
    };
    expect(books.items).toHaveLength(5);
    expect(books.pageInfo).toMatchObject({ totalItems: 6, hasNextPage: true });
    expect(batchSpy).toHaveBeenCalledTimes(1);
    expect(batchSpy.mock.calls[0]?.[0]).toEqual([
      "author-1",
      "author-2",
      "author-3",
    ]);
  });

  it("crea un libro con variables y permite modificar su estado", async () => {
    const created = await execute(
      `mutation CreateBook($input: CreateBookInput!) {
        createBook(input: $input) { id title status author { name } }
      }`,
      {
        input: {
          title: "GraphQL desde cero",
          summary: "Un recorrido reproducible por consultas y mutaciones.",
          isbn: "9780000000099",
          authorId: "author-2",
        },
      },
      "CreateBook",
    );

    expect(created.errors).toBeUndefined();
    const book = created.data?.createBook as { id: string; status: string };
    expect(book.status).toBe("AVAILABLE");

    const updated = await execute(
      `mutation UpdateBook($id: ID!, $input: UpdateBookInput!) {
        updateBook(id: $id, input: $input) { id status }
      }`,
      { id: book.id, input: { status: "LOANED" } },
      "UpdateBook",
    );
    expect(updated.data?.updateBook).toMatchObject({
      id: book.id,
      status: "LOANED",
    });
  });

  it("rechaza paginas mayores al limite operativo de 20", async () => {
    const result = await execute(
      `query ListBooks($pagination: PaginationInput) {
        books(pagination: $pagination) { items { id } }
      }`,
      { pagination: { page: 1, pageSize: 21 } },
      "ListBooks",
    );

    expect(result.errors?.[0]?.extensions?.code).toBe("BAD_USER_INPUT");
    expect(result.errors?.[0]?.message).toBe("La paginacion no es valida.");
    expect(result.errors?.[0]?.extensions).not.toHaveProperty("stack");
  });

  it("comunica datos invalidos sin exponer una traza interna", async () => {
    const result = await execute(
      `mutation CreateBook($input: CreateBookInput!) {
        createBook(input: $input) { id }
      }`,
      {
        input: {
          title: "x",
          isbn: "ABC",
          authorId: "author-404",
        },
      },
      "CreateBook",
    );

    expect(result.errors?.[0]?.extensions?.code).toBe("BAD_USER_INPUT");
    expect(result.errors?.[0]?.extensions).toHaveProperty("issues");
    expect(JSON.stringify(result)).not.toContain("at ");
  });

  it("usa nulabilidad intencional cuando un libro no existe", async () => {
    const result = await execute(
      `query GetBook($id: ID!) { book(id: $id) { id title } }`,
      { id: "book-404" },
      "GetBook",
    );

    expect(result).toEqual({ data: { book: null } });
  });

  it("resuelve la relacion inversa autor -> libros en un solo lote", async () => {
    const batchSpy = vi.spyOn(bookRepository, "findByAuthorIds");
    const result = await execute(
      `query ListBooksWithSiblings($pagination: PaginationInput) {
        books(pagination: $pagination) {
          items { id author { id books(first: 2) { id title } } }
        }
      }`,
      { pagination: { page: 1, pageSize: 5 } },
      "ListBooksWithSiblings",
    );

    expect(result.errors).toBeUndefined();
    expect(batchSpy).toHaveBeenCalledTimes(1);
    expect(batchSpy.mock.calls[0]?.[0]).toEqual([
      "author-1",
      "author-2",
      "author-3",
    ]);
  });

  it("limita el tamano de la relacion inversa", async () => {
    const result = await execute(
      `query AuthorBooks($id: ID!) {
        book(id: $id) { author { books(first: 50) { id } } }
      }`,
      { id: "book-1" },
      "AuthorBooks",
    );

    expect(result.errors?.[0]?.extensions?.code).toBe("BAD_USER_INPUT");
    expect(result.errors?.[0]?.message).toBe(
      "first debe ser un entero entre 1 y 20.",
    );
  });

  it("rechaza operaciones que superan la profundidad maxima", async () => {
    const result = await execute(
      `query DeepQuery {
        books {
          items {
            author {
              books {
                author {
                  books {
                    author {
                      books { id }
                    }
                  }
                }
              }
            }
          }
        }
      }`,
      {},
      "DeepQuery",
    );

    expect(result.data).toBeUndefined();
    expect(result.errors?.[0]?.extensions).toMatchObject({
      code: "QUERY_TOO_DEEP",
      maxDepth: 8,
      actualDepth: 9,
    });
  });

  it("permite la introspeccion aunque sea mas profunda que el limite", async () => {
    const response = await yoga.fetch("http://localhost/graphql", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: `query IntrospectSchema {
          __schema {
            types {
              fields { args { type { ofType { ofType { ofType { name } } } } } }
            }
          }
        }`,
        operationName: "IntrospectSchema",
      }),
    });
    const result = (await response.json()) as GraphQLResponse;

    expect(result.errors).toBeUndefined();
    expect(result.data?.__schema).toBeDefined();
  });

  it("reporta NOT_FOUND al modificar un recurso inexistente", async () => {
    const result = await execute(
      `mutation UpdateBook($id: ID!, $input: UpdateBookInput!) {
        updateBook(id: $id, input: $input) { id }
      }`,
      { id: "book-404", input: { status: "LOANED" } },
      "UpdateBook",
    );

    expect(result.errors?.[0]).toMatchObject({
      message: "El libro con id 'book-404' no existe.",
      extensions: { code: "NOT_FOUND" },
    });
  });

  it("registra un prestamo, marca el libro como LOANED y luego permite devolverlo", async () => {
    const created = await execute(
      `mutation CreateLoan($input: CreateLoanInput!) {
        createLoan(input: $input) {
          id
          borrowerName
          returnedAt
          book { id status }
        }
      }`,
      { input: { bookId: "book-1", borrowerName: "Diego Ramirez" } },
      "CreateLoan",
    );

    expect(created.errors).toBeUndefined();
    const loan = created.data?.createLoan as {
      id: string;
      returnedAt: string | null;
      book: { id: string; status: string };
    };
    expect(loan.returnedAt).toBeNull();
    expect(loan.book).toMatchObject({ id: "book-1", status: "LOANED" });

    const returned = await execute(
      `mutation ReturnLoan($id: ID!) {
        returnLoan(id: $id) { id returnedAt book { status } }
      }`,
      { id: loan.id },
      "ReturnLoan",
    );

    expect(returned.errors).toBeUndefined();
    const returnedLoan = returned.data?.returnLoan as {
      returnedAt: string | null;
      book: { status: string };
    };
    expect(returnedLoan.returnedAt).not.toBeNull();
    expect(returnedLoan.book.status).toBe("AVAILABLE");
  });

  it("protege con CONFLICT que un libro tenga dos prestamos activos a la vez", async () => {
    const first = await execute(
      `mutation CreateLoan($input: CreateLoanInput!) {
        createLoan(input: $input) { id }
      }`,
      { input: { bookId: "book-3", borrowerName: "Primer prestamista" } },
      "CreateLoan",
    );
    expect(first.errors).toBeUndefined();

    const second = await execute(
      `mutation CreateLoan($input: CreateLoanInput!) {
        createLoan(input: $input) { id }
      }`,
      { input: { bookId: "book-3", borrowerName: "Segundo prestamista" } },
      "CreateLoan",
    );

    expect(second.errors?.[0]).toMatchObject({
      extensions: { code: "CONFLICT" },
    });
  });

  it("expone el prestamo activo de un libro ya prestado en el seed", async () => {
    const result = await execute(
      `query GetBook($id: ID!) {
        book(id: $id) { id activeLoan { borrowerName returnedAt } }
      }`,
      { id: "book-2" },
      "GetBook",
    );

    expect(result.errors).toBeUndefined();
    expect(result.data?.book).toMatchObject({
      activeLoan: { borrowerName: "Marta Aguilar", returnedAt: null },
    });
  });
});
