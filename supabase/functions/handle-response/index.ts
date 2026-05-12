// supabase/functions/handle-response/index.ts
// Handles candidate confirm/decline and panel availability token links

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("APP_URL") || "https://your-app.netlify.app";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const action = url.searchParams.get("action"); // confirm | decline
  const status = url.searchParams.get("status"); // Available | Unavailable | On Leave
  const type = url.searchParams.get("type") || "candidate"; // candidate | panel

  if (!token) {
    return new Response("Invalid link.", { status: 400 });
  }

  // --- CANDIDATE RESPONSE ---
  if (type === "candidate" && action) {
    const { data: candidate, error } = await supabase
      .from("candidates")
      .select("id, name, status")
      .eq("confirmation_token", token)
      .single();

    if (error || !candidate) {
      return new Response(htmlPage("Invalid Link", "This confirmation link is invalid or has expired."), {
        headers: { "Content-Type": "text/html" },
      });
    }

    const newStatus = action === "confirm" ? "Confirmed" : "Declined";
    await supabase
      .from("candidates")
      .update({ status: newStatus, confirmed_at: new Date().toISOString() })
      .eq("id", candidate.id);

    // Notify recruiter/admin
    await supabase.from("notifications").insert({
      type: "candidate_response",
      title: `${candidate.name} ${newStatus} the interview`,
      message: `Candidate has ${newStatus.toLowerCase()} their scheduled interview.`,
      metadata: { candidateId: candidate.id, status: newStatus },
    });

    const color = action === "confirm" ? "#16a34a" : "#dc2626";
    const icon = action === "confirm" ? "✓" : "✗";
    return new Response(
      htmlPage(
        `${icon} ${newStatus}`,
        `Thank you, <strong>${candidate.name}</strong>. Your response has been recorded as <strong style="color:${color};">${newStatus}</strong>.`
      ),
      { headers: { "Content-Type": "text/html" } }
    );
  }

  // --- PANEL AVAILABILITY ---
  if (type === "panel" && status) {
    const { data: panel, error } = await supabase
      .from("panel_members")
      .select("id, name")
      .eq("availability_token", token)
      .single();

    if (error || !panel) {
      return new Response(htmlPage("Invalid Link", "This availability link is invalid or has expired."), {
        headers: { "Content-Type": "text/html" },
      });
    }

    await supabase
      .from("panel_members")
      .update({ availability: status, availability_updated_at: new Date().toISOString() })
      .eq("id", panel.id);

    await supabase.from("notifications").insert({
      type: "panel_availability",
      title: `${panel.name} updated availability`,
      message: `Panel member marked as: ${status}`,
      metadata: { panelId: panel.id, availability: status },
    });

    const color = status === "Available" ? "#16a34a" : status === "On Leave" ? "#d97706" : "#dc2626";
    return new Response(
      htmlPage(
        "Availability Updated",
        `Thank you, <strong>${panel.name}</strong>. Your availability has been set to <strong style="color:${color};">${status}</strong>.`
      ),
      { headers: { "Content-Type": "text/html" } }
    );
  }

  return new Response(htmlPage("Invalid Request", "Something went wrong. Please contact your admin."), {
    headers: { "Content-Type": "text/html" },
  });
});

function htmlPage(title: string, message: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} – Drive & Panel App</title>
  <style>
    body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f1f5f9; }
    .card { background: white; border-radius: 12px; padding: 48px; max-width: 480px; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    h1 { color: #1e293b; margin: 0 0 16px; }
    p { color: #475569; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
    <p style="margin-top:32px; font-size:13px; color:#94a3b8;">You can close this window.</p>
  </div>
</body>
</html>`;
}
