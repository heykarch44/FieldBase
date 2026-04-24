const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, PageBreak } = require("docx");
const fs = require("fs");

const ACCENT = "01696F";    // teal
const INK = "28251D";
const MUTED = "7A7974";
const BORDER = "D4D1CA";
const SURFACE = "F9F8F5";

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { before: opts.before ?? 60, after: opts.after ?? 60, line: 300 },
    alignment: opts.align,
    children: [new TextRun({ text, bold: opts.bold, italics: opts.italics, color: opts.color ?? INK, size: opts.size ?? 22, font: "Calibri" })],
  });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, color: ACCENT, size: 40, font: "Calibri" })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text, bold: true, color: INK, size: 28, font: "Calibri" })],
  });
}

function h3(text) {
  return new Paragraph({
    spacing: { before: 140, after: 60 },
    children: [new TextRun({ text, bold: true, color: ACCENT, size: 22, font: "Calibri" })],
  });
}

function bullet(text) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { before: 40, after: 40, line: 280 },
    children: [new TextRun({ text, color: INK, size: 22, font: "Calibri" })],
  });
}

function cell(text, opts = {}) {
  return new TableCell({
    width: { size: opts.width ?? 2500, type: WidthType.DXA },
    shading: opts.header ? { type: ShadingType.CLEAR, fill: ACCENT } : (opts.alt ? { type: ShadingType.CLEAR, fill: SURFACE } : undefined),
    margins: { top: 120, bottom: 120, left: 140, right: 140 },
    children: [new Paragraph({
      alignment: opts.right ? AlignmentType.RIGHT : AlignmentType.LEFT,
      children: [new TextRun({
        text,
        bold: opts.header || opts.bold,
        color: opts.header ? "FFFFFF" : INK,
        size: 20,
        font: "Calibri",
      })],
    })],
  });
}

function simpleTable(headers, rows, colWidths) {
  const headerRow = new TableRow({
    cantSplit: true,
    children: headers.map((h, i) => cell(h, { header: true, width: colWidths?.[i], right: i > 0 })),
  });
  const bodyRows = rows.map((r, ri) => new TableRow({
    cantSplit: true,
    children: r.map((c, ci) => cell(c, { width: colWidths?.[ci], right: ci > 0, alt: ri % 2 === 1 })),
  }));
  return new Table({
    width: { size: 9000, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
      left: { style: BorderStyle.NONE, size: 0, color: BORDER },
      right: { style: BorderStyle.NONE, size: 0, color: BORDER },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: BORDER },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: BORDER },
    },
    rows: [headerRow, ...bodyRows],
  });
}

const children = [];

// ===== Cover =====
children.push(new Paragraph({
  spacing: { before: 1200, after: 120 },
  children: [new TextRun({ text: "FieldIQ", bold: true, color: ACCENT, size: 56, font: "Calibri" })],
}));
children.push(new Paragraph({
  spacing: { before: 0, after: 60 },
  children: [new TextRun({ text: "Infrastructure Cost Estimate", bold: true, color: INK, size: 36, font: "Calibri" })],
}));
children.push(new Paragraph({
  spacing: { before: 0, after: 480 },
  children: [new TextRun({ text: "10 companies · 5 users each · 5 projects average", color: MUTED, size: 22, font: "Calibri", italics: true })],
}));
children.push(p("Prepared April 24, 2026", { color: MUTED, size: 20 }));

// ===== Summary =====
children.push(h1("At a glance"));
children.push(p("For a workload of 10 customer organizations, 50 total users, and roughly 50 jobsites, FieldIQ's current stack fits inside the entry-level paid tiers of every provider. Two configurations are shown: a lean setup that runs on included quotas, and a comfort setup that buys headroom and dedicated compute for predictable latency."));

children.push(h3("Headline numbers"));
children.push(simpleTable(
  ["Configuration", "Monthly", "Annual", "Per org / mo", "Per user / mo"],
  [
    ["Lean",    "$78.50",  "$942.00",   "$7.85",  "$1.57"],
    ["Comfort", "$258.50", "$3,102.00", "$25.85", "$5.17"],
  ],
  [2800, 1550, 1550, 1550, 1550]
));

children.push(new Paragraph({ spacing: { before: 180 } }));
children.push(p("Both configs assume the current architecture — one shared Supabase project with row-level security (RLS) isolating orgs, one Cloudflare Workers deployment serving the dashboard, and one Expo mobile app shared across all customers."));

// ===== Workload assumptions =====
children.push(h1("Workload assumptions"));
children.push(simpleTable(
  ["Dimension", "Value", "Notes"],
  [
    ["Customer orgs",          "10",          "Multi-tenant via organizations table + RLS"],
    ["Users per org",          "5",           "50 total active users"],
    ["Projects / jobsites avg","5 per org",   "~50 total sites with geofences"],
    ["Service orders / month", "~500",        "10 per site / mo — conservative"],
    ["Clock events / month",   "~6,000",      "~3 enter + 3 exit per user per workday"],
    ["Dashboard page loads",   "~150k / mo",  "5 users × ~100/day × 30 days × 10 orgs"],
    ["Mobile API calls",       "~500k / mo",  "polling sites, orders, session, events"],
    ["Transactional emails",   "~1,000 / mo", "invites, password resets, order notifications"],
    ["Mobile MAUs",            "50",          "Expo tracks distinct installs per month"],
  ],
  [2000, 1500, 5500]
));

// ===== Service-by-service =====

children.push(h1("Service-by-service breakdown"));

// Supabase
children.push(h2("Supabase — database, auth, storage"));
children.push(p("Single Pro project. Every table carries an org_id and RLS policies lock rows to the active org, so one project serves all 10 customers safely."));
children.push(simpleTable(
  ["Included in Pro ($25/mo)", "Your estimated usage", "Headroom"],
  [
    ["8 GB database",                    "<< 1 GB",     "Plenty"],
    ["100k monthly active users",        "50 MAU",      "2000x"],
    ["250 GB egress",                    "~5 GB",       "50x"],
    ["100 GB file storage",              "~1 GB (photos)", "100x"],
    ["2M edge function invocations",     "~0",          "N/A — none used yet"],
    ["$10 compute credit (Micro)",       "Micro is fine for 50 users", "Upgrade to Large ($100 net) only if latency gets mushy"],
    ["Daily backups, 7-day retention",   "Included",    "Good"],
  ],
  [2800, 2500, 3700]
));
children.push(new Paragraph({ spacing: { before: 120 } }));
children.push(p("Verdict: $25/mo is enough. Consider the Large compute add-on (+$100 net of credit) if the dashboard starts feeling slow under load, but you won't need it for a long time at this scale. Source: ", { italics: true, color: MUTED, size: 20 }));
children.push(p("[Supabase Pro pricing – supabase.com/pricing]", { color: MUTED, size: 18, italics: true }));

// Cloudflare
children.push(h2("Cloudflare Workers — dashboard hosting"));
children.push(p("The dashboard (wrk.fldiq.com) runs as a Next.js app on Cloudflare Workers via the OpenNext adapter. The marketing site (fldiq.com) is static and free."));
children.push(simpleTable(
  ["Included in Workers Paid ($5/mo)", "Your estimated usage", "Headroom"],
  [
    ["10M requests / month",             "~1.5M requests",    "6x"],
    ["30M CPU-ms / month",               "~30M (Next.js SSR ~20ms)", "At the line"],
    ["No bandwidth charges",             "unlimited egress",  "Nice"],
    ["Pages builds (unlimited)",         "auto-deploy from main", "Included"],
  ],
  [2800, 2500, 3700]
));
children.push(new Paragraph({ spacing: { before: 120 } }));
children.push(p("Verdict: $5/mo. CPU is the one metric to watch — if SSR pages grow heavier, overage is $0.02 per extra million CPU-ms, which is $2 for every extra 100M ms. Source:", { italics: true, color: MUTED, size: 20 }));
children.push(p("[Cloudflare Workers pricing – developers.cloudflare.com/workers/platform/pricing]", { color: MUTED, size: 18, italics: true }));

// EAS
children.push(h2("Expo EAS — mobile builds and OTA updates"));
children.push(p("EAS Starter covers everything needed for a 50-MAU iOS/Android app. Production ($99) is only worth it when you either exceed 3,000 MAUs or need 2 parallel builds / SSO."));
children.push(simpleTable(
  ["Included in Starter ($19/mo)", "Your estimated usage", "Headroom"],
  [
    ["$45 build credit",                 "~$8-16/mo (2-4 builds)", "~3x"],
    ["3,000 MAU",                        "50 MAU",                  "60x"],
    ["500 GiB OTA bandwidth",            "~1-2 GiB",                "~250x"],
    ["High-priority build queue",        "used every release",      "Good"],
    ["1 build concurrency",              "fine (solo developer)",   "Add $50/mo if you want a 2nd"],
  ],
  [2800, 2500, 3700]
));
children.push(new Paragraph({ spacing: { before: 120 } }));
children.push(p("Verdict: $19/mo. Bump to Production ($99) only when MAU crosses 3,000 or the team grows past a solo builder. Source:", { italics: true, color: MUTED, size: 20 }));
children.push(p("[EAS pricing – expo.dev/pricing]", { color: MUTED, size: 18, italics: true }));

// Resend
children.push(h2("Resend — transactional email"));
children.push(p("Needed for magic-link auth, invites, password resets, order notifications, technician assignments. The Free tier's 100/day cap makes it risky in production — a single busy morning of invites can silently queue or drop."));
children.push(simpleTable(
  ["Included in Pro ($20/mo)", "Your estimated usage", "Headroom"],
  [
    ["50,000 emails / month",            "~1,000 / mo",   "50x"],
    ["No daily cap",                     "safe for spikes", "Good"],
    ["10 sending domains",               "1 used (fldiq.com)", "Room for white-labeling per org later"],
    ["30-day log retention",             "debugging",     "Good"],
  ],
  [2800, 2500, 3700]
));
children.push(new Paragraph({ spacing: { before: 120 } }));
children.push(p("Verdict: $20/mo. Free tier technically fits the volume but the 100/day cap is a production-risk ceiling. Source:", { italics: true, color: MUTED, size: 20 }));
children.push(p("[Resend pricing – resend.com/pricing]", { color: MUTED, size: 18, italics: true }));

// Apple + domain
children.push(h2("Apple Developer Program & domains"));
children.push(simpleTable(
  ["Item", "Cost", "Notes"],
  [
    ["Apple Developer Program",          "$99 / year ($8.25/mo)",  "Required for TestFlight + App Store distribution"],
    ["Google Play Developer",            "$25 once",               "Already paid; no recurring cost"],
    ["fldiq.com domain",                 "~$15 / year ($1.25/mo)", "Already owned via Cloudflare Registrar"],
  ],
  [3000, 2200, 3800]
));

// ===== Totals =====

children.push(h1("Totals"));

children.push(h2("Lean configuration — recommended now"));
children.push(p("This is what you should run on today. Fits your 10×5×5 workload with significant headroom on every axis."));
children.push(simpleTable(
  ["Service", "Tier", "Monthly"],
  [
    ["Supabase",          "Pro",                          "$25.00"],
    ["Cloudflare Workers","Paid",                         "$5.00"],
    ["Expo EAS",          "Starter",                      "$19.00"],
    ["Resend",            "Pro",                          "$20.00"],
    ["Apple Developer",   "$99/yr amortized",             "$8.25"],
    ["Domain",            "Cloudflare Registrar",         "$1.25"],
    ["TOTAL",             "",                             "$78.50"],
  ],
  [3000, 3000, 3000]
));
children.push(new Paragraph({ spacing: { before: 80 } }));
children.push(p("Annual: $942.00"));
children.push(p("Per customer org: $7.85 / month"));
children.push(p("Per end user: $1.57 / month"));

children.push(h2("Comfort configuration — when latency or polish matter"));
children.push(p("Worth the upgrade once you cross ~1,500 MAUs on mobile or the dashboard starts feeling sluggish. Adds dedicated Postgres compute and the EAS Production tier."));
children.push(simpleTable(
  ["Service", "Tier", "Monthly"],
  [
    ["Supabase",          "Pro + Large compute add-on",   "$125.00"],
    ["Cloudflare Workers","Paid",                         "$5.00"],
    ["Expo EAS",          "Production",                   "$99.00"],
    ["Resend",            "Pro",                          "$20.00"],
    ["Apple Developer",   "$99/yr amortized",             "$8.25"],
    ["Domain",            "Cloudflare Registrar",         "$1.25"],
    ["TOTAL",             "",                             "$258.50"],
  ],
  [3000, 3000, 3000]
));
children.push(new Paragraph({ spacing: { before: 80 } }));
children.push(p("Annual: $3,102.00"));
children.push(p("Per customer org: $25.85 / month"));
children.push(p("Per end user: $5.17 / month"));

// ===== Pricing trigger points =====
children.push(h1("When each line item goes up"));
children.push(simpleTable(
  ["Service", "Trigger", "Next cost step"],
  [
    ["Supabase compute",  "Dashboard feels slow or CPU > 80%",           "+$100/mo (Large)"],
    ["Supabase DB size",  "Past 8 GB of row data",                       "+$0.125/GB/mo"],
    ["Supabase auth",     "Past 100k MAUs",                              "+$0.00325/MAU/mo"],
    ["Cloudflare CPU",    "Past 30M CPU-ms/mo",                          "+$0.02/M CPU-ms"],
    ["Cloudflare reqs",   "Past 10M/mo",                                 "+$0.30/M requests"],
    ["EAS MAUs",          "Past 3,000 monthly installs",                 "+$0.005/MAU or jump to Production"],
    ["EAS concurrency",   "Want parallel builds",                        "+$50/mo each"],
    ["Resend volume",     "Past 100k emails/mo (unlikely)",              "Scale plan $90/mo"],
  ],
  [2400, 3400, 3200]
));

// ===== Multi-tenant strategy note =====
children.push(h1("Architecture note — why one project scales to 10+ orgs"));
children.push(p("FieldIQ uses a single Supabase project with a multi-tenant schema. Every row in every table carries an org_id. Row-level security policies evaluate public.active_org_id() on each query, so a user in Org A physically cannot read Org B's rows — even if the client tried. This lets one $25 Supabase bill serve all 10 customers today and all 100 customers at the same price point (as long as MAUs stay under 100k and data stays under 8 GB)."));
children.push(p("Contrast: a project-per-customer model would be $25 × 10 = $250/mo just for Supabase today, with no meaningful isolation benefit."));
children.push(p("Cloudflare Workers serves every org off the same Worker — the dashboard URL is wrk.fldiq.com for everyone, and the logged-in user's org context determines what they see. Same logic as Supabase: one deployment, N customers."));
children.push(p("The mobile app is a single binary on iOS and Android. Branding per-org is possible later via runtime theming without a separate build."));

// ===== Things not in this estimate =====
children.push(h1("Not included"));
children.push(bullet("Your own labor. This is infra only."));
children.push(bullet("Stripe / payment processing fees (2.9% + 30¢ per charge if you bill customers via card)."));
children.push(bullet("App Store or Play Store commission (15–30% on in-app purchases — irrelevant for a B2B SaaS billed outside the app)."));
children.push(bullet("Error monitoring (Sentry, etc.) — Free tier generally covers 50 users."));
children.push(bullet("Marketing tooling (analytics, CRM, etc.)."));
children.push(bullet("Nominatim for geocoding — free under their usage policy at this scale, but consider Google Maps Geocoding or Mapbox ($0.50–$5/1k requests) if volume grows or Nominatim rate-limits you."));

// ===== Footer =====
children.push(new Paragraph({ spacing: { before: 400 } }));
children.push(p("Sources: supabase.com/pricing · developers.cloudflare.com/workers/platform/pricing · expo.dev/pricing · resend.com/pricing · developer.apple.com/programs. Prices verified April 2026.", { color: MUTED, size: 18, italics: true }));

const doc = new Document({
  creator: "FieldIQ",
  title: "FieldIQ Infrastructure Cost Estimate",
  styles: {
    default: {
      document: { run: { font: "Calibri" } },
    },
  },
  sections: [{
    properties: { page: { margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } } },
    children,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("/home/user/workspace/FieldBase/reports/fieldiq-cost-estimate.docx", buf);
  console.log("Wrote /home/user/workspace/FieldBase/reports/fieldiq-cost-estimate.docx", buf.length, "bytes");
});
