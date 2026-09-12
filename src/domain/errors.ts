/**
 * Errores de dominio, independientes de GraphQL. El adaptador de persistencia
 * los lanza cuando la base de datos rechaza una operacion; el resolver los
 * traduce a un error publico (`src/errors.ts`).
 */
export class LoanAlreadyActiveError extends Error {
  constructor(public readonly bookId: string) {
    super(`El libro '${bookId}' ya tiene un prestamo activo.`);
  }
}
