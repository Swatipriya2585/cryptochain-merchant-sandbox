import type { ErrorRequestHandler, Response } from "express";
import { logger } from "../lib/logger";

export type FieldError = {
  field: string;
  message: string;
};

export type ApiErrorBody = {
  message: string;
  fields?: FieldError[];
};

export class HttpError extends Error {
  readonly status: number;
  readonly fields?: FieldError[];

  constructor(status: number, message: string, fields?: FieldError[]) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.fields = fields;
  }
}

export function sendData<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ data, error: null });
}

export function sendError(
  res: Response,
  status: number,
  message: string,
  fields?: FieldError[],
): void {
  const error: ApiErrorBody = { message };
  if (fields && fields.length > 0) {
    error.fields = fields;
  }
  res.status(status).json({ data: null, error });
}

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const envelope = req.originalUrl.startsWith("/api/v1");

  if (err instanceof HttpError) {
    sendError(res, err.status, err.message, err.fields);
    return;
  }

  if (err instanceof SyntaxError && "body" in err) {
    if (envelope) {
      sendError(res, 400, "Invalid JSON body", [{ field: "body", message: err.message }]);
      return;
    }
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }

  logger.error({ err }, "unhandled request error");
  if (envelope) {
    sendError(res, 500, "Internal server error");
    return;
  }
  res.status(500).json({ error: "Internal server error" });
};
