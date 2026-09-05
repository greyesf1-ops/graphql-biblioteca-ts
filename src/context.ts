import DataLoader from "dataloader";
import { authorRepository, bookRepository } from "./data/store.js";
import type { AuthorRecord, BookRecord } from "./domain/types.js";

export interface GraphQLContext {
  authorLoader: DataLoader<string, AuthorRecord | null>;
  booksByAuthorLoader: DataLoader<string, BookRecord[]>;
}

/** Un cache por solicitud evita mezclar datos entre clientes. */
export function createContext(): GraphQLContext {
  return {
    authorLoader: new DataLoader<string, AuthorRecord | null>(
      async (ids) => authorRepository.findByIds(ids),
      { name: "authorById" },
    ),
    booksByAuthorLoader: new DataLoader<string, BookRecord[]>(
      async (authorIds) => bookRepository.findByAuthorIds(authorIds),
      { name: "booksByAuthorId" },
    ),
  };
}
