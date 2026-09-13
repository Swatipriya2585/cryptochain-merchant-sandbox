import type { ZodError, ZodTypeAny, z } from "zod";
import { HttpError, type FieldError } from "./envelope";

export function fieldErrorsFromZod(error: ZodError): FieldError[] {
  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.map(String).join(".") : "(root)",
    message: issue.message,
  }));
}

export function parseRequest<S extends ZodTypeAny>(schema: S, data: unknown): z.output<S> {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new HttpError(400, "Validation failed", fieldErrorsFromZod(parsed.error));
  }
  return parsed.data;
}
