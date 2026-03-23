import type { z } from "zod";

/** Helper to parse query with zod schema */
export const parseHeaders =
  <T extends z.ZodSchema>(schema: T) =>
  (ctx: { headers: unknown }): z.infer<T> =>
    schema.parse(ctx.headers);

/** Helper to parse query with zod schema */
export const parseQuery =
  <T extends z.ZodSchema>(schema: T) =>
  (ctx: { query: unknown }): z.infer<T> =>
    schema.parse(ctx.query);

/** Helper to parse body with zod schema */
export const parseBody =
  <T extends z.ZodSchema>(schema: T) =>
  (ctx: { body: unknown }): z.infer<T> =>
    schema.parse(ctx.body);

/**
 * Helper to fetch a row from Supabase based on path param.
 * Calls `getRowFromPath` under the hood.
 */
// export const rowFromPath = {
//   recordingId: <T extends string>(columns: T) =>
//     getRowFromPath({
//       table: "recordings",
//       subject: "Meeting note",
//       columns,
//     }),
//   workflowId: <T extends string>(columns: T) =>
//     getRowFromPath({
//       table: "workflows",
//       subject: "Workflow",
//       columns,
//     }),
// };
