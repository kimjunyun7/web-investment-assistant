import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { runAnalysis } from "@/lib/analysis/pipeline";

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const ticker: string = body?.ticker;
    const investment_level: number = Number(body?.investment_level);
    const asset_type: "stock" | "crypto" = body?.asset_type;

    if (!ticker || !asset_type || !investment_level) {
      return NextResponse.json({ error: "Missing ticker, asset_type, or investment_level" }, { status: 400 });
    }

    // 1) Create search record
    const { data: search, error: insertSearchErr } = await supabase
      .from("searches")
      .insert({
        user_id: user.id,
        ticker,
        asset_type,
        investment_level,
      })
      .select()
      .single();

    if (insertSearchErr || !search) {
      return NextResponse.json({ error: insertSearchErr?.message || "Failed to create search" }, { status: 500 });
    }

    // 2) Create analysis report pending
    const { data: report, error: insertReportErr } = await supabase
      .from("analysis_reports")
      .insert({ search_id: search.id, status: "pending" })
      .select()
      .single();

    if (insertReportErr || !report) {
      return NextResponse.json({ error: insertReportErr?.message || "Failed to create report" }, { status: 500 });
    }

    // 3) Fire-and-forget analysis (serverless best-effort)
    (async () => {
      try {
        const output = await runAnalysis({
          ticker,
          assetType: asset_type,
          investmentLevel: investment_level,
        });

        await supabase
          .from("analysis_reports")
          .update({ status: "completed", report_data: output })
          .eq("id", report.id);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        await supabase
          .from("analysis_reports")
          .update({ status: "failed", report_data: { error: message || "analysis failed" } })
          .eq("id", report.id);
      }
    })();

    return NextResponse.json({ search_id: search.id, report_id: report.id });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message || "Unexpected error" }, { status: 500 });
  }
}
