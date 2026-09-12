import { PrismaClient } from "@prisma/client";
import { now, seedAuthors, seedBooks, seedLoans } from "./seed-data.js";

const prisma = new PrismaClient();

/** Cada upsert usa el id fijo del seed, por lo que ejecutar el script varias veces no duplica datos. */
async function main() {
  for (const author of seedAuthors) {
    await prisma.author.upsert({
      where: { id: author.id },
      update: author,
      create: author,
    });
  }

  for (const book of seedBooks) {
    await prisma.book.upsert({
      where: { id: book.id },
      update: { ...book, updatedAt: now },
      create: { ...book, createdAt: now, updatedAt: now },
    });
  }

  for (const loan of seedLoans) {
    await prisma.loan.upsert({
      where: { id: loan.id },
      update: loan,
      create: { ...loan, loanedAt: now },
    });
  }

  console.log(
    `Seed listo: ${await prisma.author.count()} autores, ${await prisma.book.count()} libros, ${await prisma.loan.count()} prestamos`,
  );
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
