-- ==============================
-- Send Lead Email via Database Trigger
-- Uses pg_net extension to call Resend API
-- ==============================

-- 1) Enable pg_net extension
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2) Create the trigger function
CREATE OR REPLACE FUNCTION public.notify_new_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    pension_label TEXT;
    email_html TEXT;
    email_subject TEXT;
    request_id BIGINT;
BEGIN
    -- Map pension size to Hebrew label
    pension_label := CASE NEW.pension_size
        WHEN 'small' THEN 'קטן (עד 10 כלבים)'
        WHEN 'medium' THEN 'בינוני (10-30 כלבים)'
        WHEN 'large' THEN 'גדול (30+ כלבים)'
        ELSE NEW.pension_size
    END;

    email_subject := '🐾 ליד חדש: ' || NEW.full_name || ' - ' || pension_label;

    email_html := '
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 20px;">
            <div style="background: linear-gradient(135deg, #6366f1, #7c3aed); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px;">🐾 ליד חדש מפנסיון-נט!</h1>
            </div>
            <div style="background: white; padding: 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                <h2 style="color: #1e293b; margin-top: 0;">פרטי הליד:</h2>
                <table style="width: 100%; border-collapse: collapse; font-size: 15px;">
                    <tr>
                        <td style="padding: 12px 16px; background: #f1f5f9; font-weight: 700; width: 120px; color: #475569;">👤 שם מלא</td>
                        <td style="padding: 12px 16px; background: #f1f5f9; color: #1e293b;">' || NEW.full_name || '</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px 16px; font-weight: 700; color: #475569;">📧 אימייל</td>
                        <td style="padding: 12px 16px; color: #1e293b;"><a href="mailto:' || NEW.email || '" style="color: #6366f1;">' || NEW.email || '</a></td>
                    </tr>
                    <tr>
                        <td style="padding: 12px 16px; background: #f1f5f9; font-weight: 700; color: #475569;">📱 טלפון</td>
                        <td style="padding: 12px 16px; background: #f1f5f9; color: #1e293b;"><a href="tel:' || NEW.phone || '" style="color: #6366f1;">' || NEW.phone || '</a></td>
                    </tr>
                    <tr>
                        <td style="padding: 12px 16px; font-weight: 700; color: #475569;">🏠 גודל פנסיון</td>
                        <td style="padding: 12px 16px; color: #1e293b;">' || pension_label || '</td>
                    </tr>
                </table>
                <div style="margin-top: 20px; padding: 12px 16px; background: #eff6ff; border-radius: 8px; font-size: 13px; color: #64748b; text-align: center;">
                    📅 התקבל ב-' || to_char(NEW.created_at AT TIME ZONE 'Asia/Jerusalem', 'DD/MM/YYYY HH24:MI') || '
                </div>
            </div>
        </div>
    ';

    -- Send via Resend API using pg_net
    SELECT net.http_post(
        url := 'https://api.resend.com/emails',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer re_NkPPW2mw_MSz3NvVEf9Z1hMvuUpDyRqBb'
        ),
        body := jsonb_build_object(
            'from', 'Pension-Net <onboarding@resend.dev>',
            'to', ARRAY['shaharsolutions@gmail.com'],
            'subject', email_subject,
            'html', email_html
        )
    ) INTO request_id;

    RETURN NEW;
END;
$$;

-- 3) Create trigger on leads table
DROP TRIGGER IF EXISTS on_new_lead ON public.leads;
CREATE TRIGGER on_new_lead
    AFTER INSERT ON public.leads
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_new_lead();
