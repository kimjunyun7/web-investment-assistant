import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    // Ensure ownership by joining through searches
    const { data: report, error } = await supabase
      .from("analysis_reports")
      .select("*, searches!inner(user_id)")
      .eq("id", id)
      .eq("searches.user_id", user.id)
      .single();

    if (error || !report) {
      return NextResponse.json({ error: error?.message || "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: report.id,
      status: report.status,
      report_data: report.report_data,
      created_at: report.created_at,
      updated_at: report.updated_at,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message || "Unexpected error" }, { status: 500 });
  }
}
