// supabase/functions/send-email/index.ts
// Deploy via: Supabase Dashboard > Edge Functions > New Function

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("APP_URL") || "https://your-app.netlify.app";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendBrevoEmail(to: string, toName: string, subject: string, htmlContent: string) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: "Drive & Panel App", email: "noreply@yourcompany.com" },
      to: [{ email: to, name: toName }],
      subject,
      htmlContent,
    }),
  });
  return res.ok;
}

function candidateConfirmationEmail(candidate: any, confirmUrl: string, declineUrl: string) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1e40af;">Interview Confirmation Required</h2>
      <p>Dear <strong>${candidate.name}</strong>,</p>
      <p>You have been scheduled for an interview. Please confirm your attendance:</p>
      <table style="width:100%; margin: 20px 0;">
        <tr><td><strong>Interview Level:</strong></td><td>${candidate.interview_level}</td></tr>
        <tr><td><strong>Date & Time:</strong></td><td>${candidate.interview_date ? new Date(candidate.interview_date).toLocaleString("en-IN") : "TBD"}</td></tr>
        <tr><td><strong>Interview Link:</strong></td><td><a href="${candidate.interview_link}">${candidate.interview_link || "Will be shared separately"}</a></td></tr>
      </table>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${confirmUrl}" style="background:#16a34a;color:white;padding:12px 32px;border-radius:6px;text-decoration:none;margin-right:16px;font-weight:bold;">✓ Confirm</a>
        <a href="${declineUrl}" style="background:#dc2626;color:white;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:bold;">✗ Decline</a>
      </div>
      <p style="color:#6b7280;font-size:13px;">If buttons don't work, copy-paste these links:<br>
        Confirm: ${confirmUrl}<br>Decline: ${declineUrl}</p>
    </div>`;
}

function panelAvailabilityEmail(panel: any, updateUrl: string) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1e40af;">Weekly Availability Update</h2>
      <p>Dear <strong>${panel.name}</strong>,</p>
      <p>Please update your availability for upcoming interviews this week.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${updateUrl}&status=Available" style="background:#16a34a;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;margin:8px;display:inline-block;">✓ Available</a>
        <a href="${updateUrl}&status=Unavailable" style="background:#dc2626;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;margin:8px;display:inline-block;">✗ Unavailable</a>
        <a href="${updateUrl}&status=On Leave" style="background:#d97706;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;margin:8px;display:inline-block;">📅 On Leave</a>
      </div>
      <p style="color:#6b7280;font-size:13px;">This link is valid for 7 days. Contact admin if you have issues.</p>
    </div>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const { type, payload } = await req.json();
  let success = false;

  if (type === "candidate_confirmation") {
    const { candidateId } = payload;
    const { data: candidate } = await supabase
      .from("candidates").select("*").eq("id", candidateId).single();
    if (candidate) {
      const confirmUrl = `${APP_URL}/confirm?token=${candidate.confirmation_token}&action=confirm`;
      const declineUrl = `${APP_URL}/confirm?token=${candidate.confirmation_token}&action=decline`;
      success = await sendBrevoEmail(
        candidate.email, candidate.name,
        "Interview Confirmation Required – Please Respond",
        candidateConfirmationEmail(candidate, confirmUrl, declineUrl)
      );
      await supabase.from("email_logs").insert({
        recipient_email: candidate.email, recipient_name: candidate.name,
        subject: "Interview Confirmation", type: "candidate_confirmation",
        status: success ? "sent" : "failed", sent_at: new Date().toISOString(),
        metadata: { candidateId }
      });
    }
  }

  if (type === "panel_availability") {
    // Runs every Thursday via pg_cron
    const { data: panels } = await supabase
      .from("panel_members").select("*").eq("is_active", true);
    let count = 0;
    for (const panel of panels || []) {
      const updateUrl = `${APP_URL}/availability?token=${panel.availability_token}`;
      const ok = await sendBrevoEmail(
        panel.email, panel.name,
        "Please Update Your Interview Availability",
        panelAvailabilityEmail(panel, updateUrl)
      );
      if (ok) count++;
    }
    success = count > 0;
  }

  if (type === "status_notification") {
    const { candidateId, newStatus, recipientEmail, recipientName } = payload;
    const html = `<div style="font-family:Arial,sans-serif;max-width:600px;">
      <h2 style="color:#1e40af;">Candidate Status Update</h2>
      <p>Candidate status has been updated to: <strong style="color:#1e40af;">${newStatus}</strong></p>
      <p><a href="${APP_URL}/candidates/${candidateId}" style="color:#1e40af;">View Details →</a></p>
    </div>`;
    success = await sendBrevoEmail(recipientEmail, recipientName, `Status Update: ${newStatus}`, html);
  }

  return new Response(JSON.stringify({ success }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
