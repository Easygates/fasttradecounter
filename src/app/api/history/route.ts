import { and, desc, eq, gte, ilike, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { pickingRequests } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { apiError, HttpError } from "@/lib/http";
import type { Status } from "@/lib/types";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    await requireSession(request);
    const params = new URL(request.url).searchParams;
    const clauses = [];
    const q = (params.get("q") || "").trim().slice(0, 80);
    const status = params.get("status");
    if (q) clauses.push(ilike(pickingRequests.orderNumber, `%${q.replace(/[\\%_]/g, "\\$&")}%`));
    if (status && status !== "ALL") {
      if (!["NEW", "ACKNOWLEDGED", "PICKING", "COMPLETED"].includes(status)) throw new HttpError(400, "Invalid status filter.");
      clauses.push(eq(pickingRequests.status, status as Status));
    }
    for (const [key, operation] of [["from", gte], ["to", lt]] as const) {
      const value = params.get(key);
      if (value) {
        const date = new Date(value);
        if (!Number.isFinite(date.getTime())) throw new HttpError(400, "Choose a valid date range.");
        clauses.push(operation(pickingRequests.createdAt, date));
      }
    }
    const exportCsv = params.get("export") === "1";
    const page = Math.min(100000, Math.max(1, Number(params.get("page")) || 1));
    const pageSize = exportCsv ? 10000 : 25;
    const where = and(...clauses);
    const [rows, total] = await Promise.all([
      db.select().from(pickingRequests).where(where).orderBy(desc(pickingRequests.createdAt)).limit(pageSize).offset(exportCsv ? 0 : (page - 1) * pageSize),
      db.select({ count: sql<number>`count(*)::int` }).from(pickingRequests).where(where),
    ]);
    if (exportCsv) {
      const cell = (value: unknown) => {
        let text = value instanceof Date ? value.toISOString() : String(value ?? "");
        if (/^[=+@\t\r-]/.test(text)) text = `'${text}`;
        return `"${text.replace(/"/g, '""')}"`;
      };
      const csv = ["Order number,Message,Status,Submitted,Acknowledged,Picking started,Completed,Total seconds,Screenshot available", ...rows.map((r) => [r.orderNumber, r.message, r.status, r.createdAt, r.acknowledgedAt, r.pickingStartedAt, r.completedAt, r.completedAt ? Math.round((r.completedAt.getTime() - r.createdAt.getTime()) / 1000) : "", Boolean(r.screenshotPath)].map(cell).join(","))].join("\r\n");
      return new Response(`\uFEFF${csv}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="picklane-order-history.csv"', "Cache-Control": "private, no-store" } });
    }
    return Response.json({ requests: rows, total: total[0].count, page, pageSize }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
