export const prerender = false;

import type { APIContext } from 'astro';
import { resolveSource } from '../../lib/attribution';

/** Trim to a sane length so a crafted POST can't bloat the table. */
function clip(value: unknown, max: number): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed ? trimmed.slice(0, max) : null;
}

const GOAL_LABELS: Record<string, string> = {
	launch: 'Launch a new affiliate program',
	audit: 'Audit / improve an existing program',
	incrementality: 'Measure incrementality',
	partners: 'Recruit better partners',
	platform: 'Migrate to or optimize Impact.com',
	avvio: 'Avviare un nuovo programma di affiliazione',
	audit_it: 'Audit / migliorare un programma esistente',
	incrementalita: "Misurare l'incrementalità",
	partner: 'Reclutare partner migliori',
	piattaforma: 'Migrare su o ottimizzare Impact.com',
	other: 'Something else',
	altro: 'Altro',
};

export async function POST({ request, locals }: APIContext) {
	const env = (locals as any).runtime?.env ?? {};
	const apiKey: string | undefined = env.RESEND_API_KEY ?? import.meta.env.RESEND_API_KEY;
	const db: D1Database | undefined = env.DB;

	let formData: FormData;
	try {
		formData = await request.formData();
	} catch {
		return Response.redirect(new URL('/contact?error=true', request.url), 303);
	}

	const locale = (formData.get('locale') as string) || 'en';
	const redirectBase = locale === 'it' ? '/it/contact' : '/contact';
	const origin = new URL(request.url).origin;

	// Collect fields — support both EN and IT field names
	const firstName =
		(formData.get('first-name') as string) || (formData.get('nome') as string) || '';
	const lastName =
		(formData.get('last-name') as string) || (formData.get('cognome') as string) || '';
	const email = (formData.get('email') as string) || '';
	const company =
		(formData.get('company') as string) || (formData.get('azienda') as string) || '';
	const goalRaw =
		(formData.get('goal') as string) || (formData.get('obiettivo') as string) || '';
	const message =
		(formData.get('message') as string) || (formData.get('messaggio') as string) || '';

	const goalLabel = GOAL_LABELS[goalRaw] || goalRaw;
	const fullName = `${firstName} ${lastName}`.trim();

	// Lead source. The hidden fields are filled in on the contact page from
	// document.referrer and the query string — read only, nothing is stored on
	// the visitor's device. Country comes from Cloudflare's edge headers.
	const referrer = clip(formData.get('referrer'), 500);
	const landingPath = clip(formData.get('landing_path'), 500);
	const utmSource = clip(formData.get('utm_source'), 120);
	const utmMedium = clip(formData.get('utm_medium'), 120);
	const utmCampaign = clip(formData.get('utm_campaign'), 120);
	const utmContent = clip(formData.get('utm_content'), 120);
	const utmTerm = clip(formData.get('utm_term'), 120);
	const country = clip(request.headers.get('cf-ipcountry'), 8);

	const attribution = resolveSource(referrer, utmSource, utmMedium);

	// Shown in the notification email so the source is visible without a query.
	const sourceSummary = [
		attribution.sourceLabel,
		utmCampaign ? `campaign: ${utmCampaign}` : null,
		landingPath && landingPath !== '/contact' && landingPath !== '/it/contact'
			? `landed on ${landingPath}`
			: null,
		country,
	]
		.filter(Boolean)
		.join(' · ');

	if (!firstName || !email) {
		return Response.redirect(new URL(`${redirectBase}?error=true`, origin), 303);
	}

	if (!apiKey) {
		// No API key configured — redirect with error
		console.error('[contact] RESEND_API_KEY is not set');
		return Response.redirect(new URL(`${redirectBase}?error=true`, origin), 303);
	}

	const html = `
<div style="font-family: Inter, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
  <div style="background: #0a1228; padding: 32px 32px 24px; border-radius: 12px 12px 0 0;">
    <p style="color: #60a5fa; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 8px;">New Contact Form Submission</p>
    <h1 style="color: #ffffff; font-size: 22px; font-weight: 700; margin: 0;">Message from ${fullName}</h1>
  </div>
  <div style="background: #f9fafb; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; width: 130px;">
          <span style="font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Name</span>
        </td>
        <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
          <span style="font-size: 14px; color: #111827; font-weight: 500;">${fullName}</span>
        </td>
      </tr>
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
          <span style="font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Email</span>
        </td>
        <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
          <a href="mailto:${email}" style="font-size: 14px; color: #2563eb; text-decoration: none;">${email}</a>
        </td>
      </tr>
      ${company ? `
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
          <span style="font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Company</span>
        </td>
        <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
          <span style="font-size: 14px; color: #111827;">${company}</span>
        </td>
      </tr>` : ''}
      ${goalLabel ? `
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
          <span style="font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Goal</span>
        </td>
        <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
          <span style="font-size: 14px; color: #111827;">${goalLabel}</span>
        </td>
      </tr>` : ''}
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
          <span style="font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Source</span>
        </td>
        <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
          <span style="font-size: 14px; color: #111827;">${sourceSummary}</span>
          ${attribution.sourceKind === 'ai_assistant' ? `
          <span style="display: inline-block; margin-left: 8px; background: #ede9fe; color: #5b21b6; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.05em;">AI referral</span>` : ''}
        </td>
      </tr>
    </table>
    ${message ? `
    <div style="margin-top: 24px;">
      <p style="font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 10px;">Message</p>
      <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px;">
        <p style="font-size: 14px; color: #374151; line-height: 1.6; margin: 0; white-space: pre-wrap;">${message}</p>
      </div>
    </div>` : ''}
    <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      <a href="mailto:${email}" style="display: inline-block; background: #2563eb; color: #ffffff; font-size: 13px; font-weight: 600; padding: 10px 20px; border-radius: 8px; text-decoration: none;">Reply to ${firstName}</a>
    </div>
  </div>
  <p style="font-size: 11px; color: #9ca3af; text-align: center; margin-top: 20px;">Sent via stratagem.agency contact form</p>
</div>`;

	try {
		const res = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				from: 'Stratagem Website <website@notifications.stratagem.agency>',
				to: ['contact@stratagem.agency'],
				reply_to: email,
				subject: `New message from ${fullName}${company ? ` — ${company}` : ''}`,
				html,
			}),
		});

		if (!res.ok) {
			const body = await res.text();
			console.error('[contact] Resend error', res.status, body);
			return Response.redirect(new URL(`${redirectBase}?error=true`, origin), 303);
		}
	} catch (err) {
		console.error('[contact] fetch failed', err);
		return Response.redirect(new URL(`${redirectBase}?error=true`, origin), 303);
	}

	// Save to D1
	if (db) {
		try {
			await db.prepare(
				`INSERT INTO contact_submissions
				   (first_name, last_name, email, company, goal, message, locale, submitted_at,
				    referrer, referrer_host, source_label, source_kind, landing_path,
				    utm_source, utm_medium, utm_campaign, utm_content, utm_term, country)
				 VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			).bind(
				firstName,
				lastName,
				email,
				company || null,
				goalRaw || null,
				message || null,
				locale,
				referrer,
				attribution.referrerHost,
				attribution.sourceLabel,
				attribution.sourceKind,
				landingPath,
				utmSource,
				utmMedium,
				utmCampaign,
				utmContent,
				utmTerm,
				country
			).run();
		} catch (err) {
			console.error('[contact] D1 insert failed', err);
		}
	}

	return Response.redirect(new URL(`${redirectBase}?success=true`, origin), 303);
}
