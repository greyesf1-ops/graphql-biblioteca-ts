-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookId" TEXT NOT NULL,
    "borrowerName" TEXT NOT NULL,
    "loanedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedAt" DATETIME,
    CONSTRAINT "Loan_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Loan_bookId_idx" ON "Loan"("bookId");

-- Ajuste manual sobre el SQL generado por Prisma: el DSL de schema.prisma no
-- expresa indices unicos parciales (WHERE), asi que esta restriccion se agrega
-- a mano. Sin ella, la aplicacion podria registrar dos prestamos activos del
-- mismo libro si dos solicitudes concurrentes pasan la validacion a la vez; el
-- indice hace que la segunda insercion falle en la base de datos incluso si se
-- omite la capa GraphQL (por ejemplo, insertando por SQL directo).
CREATE UNIQUE INDEX "Loan_bookId_active_key" ON "Loan"("bookId") WHERE "returnedAt" IS NULL;

-- Revision de riesgo de datos: CREATE TABLE es puramente aditivo y no toca
-- "Author" ni "Book"; los libros ya marcados como LOANED en el seed no violan
-- este indice porque, hasta este punto, la tabla "Loan" no tiene filas.
