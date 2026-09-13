import { PrismaClient } from "@prisma/client";
import { config } from "../config/env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    datasources: {
      db: {
        url: config.DATABASE_URL,
      },
    },
    log: config.NODE_ENV === "sandbox" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (config.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
