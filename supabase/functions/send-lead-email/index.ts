// Supabase Edge Function - Send Lead Email Notification
// Deploy with: supabase functions deploy send-lead-email
//
// Environment variable needed:
//   RESEND_API_KEY - API key from resend.com (free tier: 100 emails/day)
//
// Set it with:
//   supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxx

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RECIPIENT_EMAIL = "shaharsolutions@gmail.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { full_name, email, phone, pension_size } = await req.json();

    // Validate required fields
    if (!full_name || !email || !phone || !pension_size) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" });

    const htmlBody = `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 20px;">
        <div style="background: linear-gradient(135deg, #6366f1, #7c3aed); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">🐾 ליד חדש מפנסיון-נט!</h1>
        </div>
        <div style="background: white; padding: 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
          <h2 style="color: #1e293b; margin-top: 0;">פרטי הליד:</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 15px;">
            <tr>
              <td style="padding: 12px 16px; background: #f1f5f9; font-weight: 700; border-radius: 8px 0 0 0; width: 120px; color: #475569;">👤 שם מלא</td>
              <td style="padding: 12px 16px; background: #f1f5f9; border-radius: 0 8px 0 0; color: #1e293b;">${full_name}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; font-weight: 700; color: #475569;">📧 אימייל</td>
              <td style="padding: 12px 16px; color: #1e293b;"><a href="mailto:${email}" style="color: #6366f1;">${email}</a></td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; background: #f1f5f9; font-weight: 700; color: #475569;">📱 טלפון</td>
              <td style="padding: 12px 16px; background: #f1f5f9; color: #1e293b;"><a href="tel:${phone}" style="color: #6366f1;">${phone}</a></td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; font-weight: 700; border-radius: 0 0 0 8px; color: #475569;">🏠 גודל פנסיון</td>
              <td style="padding: 12px 16px; border-radius: 0 0 8px 0; color: #1e293b;">${pension_size}</td>
            </tr>
          </table>
          <div style="margin-top: 20px; padding: 12px 16px; background: #eff6ff; border-radius: 8px; font-size: 13px; color: #64748b; text-align: center;">
            📅 התקבל ב-${now}
          </div>
        </div>
      </div>
    `;

    // Send via Resend API
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Pension-Net <onboarding@resend.dev>",
        to: [RECIPIENT_EMAIL],
        subject: `🐾 ליד חדש: ${full_name} - ${pension_size}`,
        html: htmlBody,
      }),
    });

    const emailResult = await emailRes.json();

    if (!emailRes.ok) {
      console.error("Resend API error:", emailResult);
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: emailResult }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, id: emailResult.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
