import pino from "pino";
import { config } from "../config/env";

export const logger = pino(
  config.NODE_ENV === "sandbox"
    ? {
        level: process.env.LOG_LEVEL ?? "debug",
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        },
      }
    : {
        level: process.env.LOG_LEVEL ?? "info",
      },
);
