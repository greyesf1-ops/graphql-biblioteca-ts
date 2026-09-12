import { PrismaClient, BookStatus } from "@prisma/client";

const prisma = new PrismaClient();
const now = new Date("2026-09-01T12:00:00.000Z");

async function main() {
  const authors = [
    ["author-1", "Ana Torres", "Guatemala", "Investigadora de diseno de APIs y sistemas de informacion."],
    ["author-2", "Carlos Mendez", "Mexico", null],
    ["author-3", "Lucia Herrera", "Costa Rica", "Docente y divulgadora de arquitectura de software."],
  ] as const;
  for (const [id, name, country, biography] of authors) {
    await prisma.author.upsert({ where: { id }, update: { name, country, biography }, create: { id, name, country, biography } });
  }
  const books = [
    ["book-1", "Diseno de APIs conscientes", "9780000000001", BookStatus.AVAILABLE, 2024, "author-1", "TEC-A01", 175],
    ["book-2", "El laberinto de los datos", "9780000000002", BookStatus.LOANED, 2022, "author-1", "TEC-A02", 150],
    ["book-3", "TypeScript paso a paso", "9780000000003", BookStatus.AVAILABLE, 2025, "author-2", "TEC-T01", 210],
  ] as const;
  for (const [id, title, isbn, status, publishedYear, authorId, shelfCode, acquisitionCost] of books) {
    await prisma.book.upsert({ where: { id }, update: { title, isbn, status, publishedYear, authorId, shelfCode, acquisitionCost, updatedAt: now }, create: { id, title, isbn, status, publishedYear, authorId, shelfCode, acquisitionCost, createdAt: now, updatedAt: now } });
  }
  console.log(`Seed listo: ${await prisma.author.count()} autores, ${await prisma.book.count()} libros`);
}

main().finally(() => prisma.$disconnect());
