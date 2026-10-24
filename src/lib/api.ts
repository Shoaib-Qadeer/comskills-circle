import { NextResponse } from "next/server";
import { z, type ZodType } from "zod";
import { ApiError } from "./auth";

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Wraps a route handler: converts ApiError / ZodError / unknown errors into JSON responses. */
export function route<C>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof ApiError) {
        return NextResponse.json({ error: err.message, ...(err.data || {}) }, { status: err.status });
      }
      if (err instanceof z.ZodError) {
        const first = err.issues[0];
        const path = first?.path?.join(".");
        return NextResponse.json(
          { error: path ? `${path}: ${first.message}` : first?.message || "Invalid input" },
          { status: 400 },
        );
      }
      console.error("[api] unhandled", err);
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
  };
}

export async function readJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "Invalid JSON body");
  }
  return schema.parse(body);
}

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export type IdCtx = { params: Promise<{ id: string }> };
