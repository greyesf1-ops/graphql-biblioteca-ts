import "dotenv/config";
import { PrismaClient } from "@prisma/client";

/**
 * Instancia unica del cliente Prisma. `tsx watch` recarga el modulo del
 * servidor en cada cambio; sin este singleton en globalThis cada recarga
 * abriria una conexion nueva a SQLite.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
