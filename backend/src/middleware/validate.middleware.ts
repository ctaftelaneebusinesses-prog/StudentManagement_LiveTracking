import { NextFunction, Request, Response } from "express";
import { AnyZodObject } from "zod";

/**
 * Validates req.body/query/params against a Zod schema before the request
 * reaches the controller, and writes the parsed (and possibly coerced —
 * e.g. `page` string -> number) values back onto the request so controllers
 * always see already-typed data. On failure, the ZodError is forwarded to
 * next() and formatted by error.middleware.ts.
 */
export function validate(schema: AnyZodObject) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      req.body = parsed.body ?? req.body;
      if (parsed.query) Object.assign(req.query, parsed.query);
      if (parsed.params) Object.assign(req.params, parsed.params);
      next();
    } catch (err) {
      next(err);
    }
  };
}
