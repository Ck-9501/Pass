import QRCode from "qrcode";
import { jsPDF } from "jspdf";
import type { EventRow, Guest } from "./supabase";

/* ============================================================
   SINGLE SOURCE OF TRUTH
   ============================================================ */

export const PASS_BACKGROUND_URL = "/pass-background.jpg";

/* ============================================================
   IDS
   ============================================================ */

const CHARS =
  "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomString(length: number) {
  const bytes = crypto.getRandomValues(
    new Uint8Array(length)
  );

  return Array.from(
    bytes,
    (byte) => CHARS[byte % CHARS.length]
  ).join("");
}

export const newPassId = () =>
  `VYRA-${randomString(8)}`;

export const newToken = () =>
  `VYRA-${crypto.randomUUID()}`;

/* ============================================================
   QR CONTENT
   ============================================================ */

export function getPublicUrl() {
  const configured =
    String(
      import.meta.env.VITE_PUBLIC_URL || ""
    ).trim();

  return (
    configured ||
    window.location.origin
  ).replace(/\/$/, "");
}

export function buildVerifyUrl(
  token: string
) {
  return `${getPublicUrl()}/verify/${encodeURIComponent(
    token
  )}`;
}

/* ============================================================
   QR IMAGE
   ============================================================ */

export async function generateQr(
  token: string
) {
  const value =
    buildVerifyUrl(token);

  return QRCode.toDataURL(
    value,
    {
      type: "image/png",
      width: 1200,
      margin: 4,
      errorCorrectionLevel: "H",
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    }
  );
}

/* Keep compatibility with older code */
export const qrDataUrl = generateQr;

/* ============================================================
   HELPERS
   ============================================================ */

function loadImage(
  src: string
): Promise<HTMLImageElement> {
  return new Promise(
    (resolve, reject) => {
      const img = new Image();

      img.crossOrigin = "anonymous";

      img.onload = () =>
        resolve(img);

      img.onerror = () =>
        reject(
          new Error(
            `Could not load ${src}`
          )
        );

      img.src = src;
    }
  );
}

function formatDate(
  date: string | null
) {
  if (!date) return "TBA";

  const p = date.split("-");

  if (p.length !== 3) {
    return date;
  }

  const [
    year,
    month,
    day,
  ] = p;

  const months = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ];

  return `${day} ${
    months[Number(month) - 1] || month
  } ${year}`;
}

function formatTime(
  time: string | null
) {
  if (!time) return "TBA";

  const p = time.split(":");

  if (p.length < 2) {
    return time;
  }

  let hour =
    Number(p[0]);

  if (Number.isNaN(hour)) {
    return time;
  }

  const minute =
    p[1];

  const suffix =
    hour >= 12 ? "PM" : "AM";

  hour =
    hour % 12 || 12;

  return `${hour}:${minute} ${suffix}`;
}

function centerText(
  pdf: jsPDF,
  text: string,
  x: number,
  y: number
) {
  pdf.text(
    text,
    x,
    y,
    {
      align: "center",
    }
  );
}

function fitFont(
  pdf: jsPDF,
  text: string,
  maxWidth: number,
  startSize: number
) {
  let size =
    startSize;

  pdf.setFontSize(
    size
  );

  while (
    pdf.getTextWidth(text) >
      maxWidth &&
    size > 5
  ) {
    size -= 0.5;
    pdf.setFontSize(
      size
    );
  }

  return size;
}

/* ============================================================
   PDF
   ============================================================ */

export async function downloadPdf(
  guest: Guest,
  event: EventRow
) {
  const pdf =
    new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [100, 160],
      compress: true,
    });

  const GOLD =
    [255, 213, 108];

  const LIGHT_GOLD =
    [255, 228, 160];

  const WHITE =
    [255, 255, 255];

  const IVORY =
    [255, 249, 236];

  const DARK =
    [4, 8, 16];

  /* ==========================================================
     BACKGROUND
     ========================================================== */

  try {
    const bg =
      await loadImage(
        `${PASS_BACKGROUND_URL}?v=${Date.now()}`
      );

    pdf.addImage(
      bg,
      "JPEG",
      0,
      0,
      100,
      160
    );
  } catch {
    pdf.setFillColor(
      DARK[0],
      DARK[1],
      DARK[2]
    );

    pdf.rect(
      0,
      0,
      100,
      160,
      "F"
    );
  }

  /* ==========================================================
     DARK READABILITY AREAS
     ========================================================== */

  pdf.setFillColor(
    DARK[0],
    DARK[1],
    DARK[2]
  );

  pdf.setGState(
    new (pdf as any).GState({
      opacity: 0.72,
    })
  );

  pdf.roundedRect(
    6,
    5,
    88,
    32,
    5,
    5,
    "F"
  );

  pdf.setGState(
    new (pdf as any).GState({
      opacity: 1,
    })
  );

  pdf.setFillColor(
    DARK[0],
    DARK[1],
    DARK[2]
  );

  pdf.setGState(
    new (pdf as any).GState({
      opacity: 0.60,
    })
  );

  pdf.roundedRect(
    7,
    38,
    86,
    36,
    5,
    5,
    "F"
  );

  pdf.setGState(
    new (pdf as any).GState({
      opacity: 1,
    })
  );

  pdf.setFillColor(
    DARK[0],
    DARK[1],
    DARK[2]
  );

  pdf.setGState(
    new (pdf as any).GState({
      opacity: 0.82,
    })
  );

  pdf.roundedRect(
    6,
    75,
    88,
    21,
    4,
    4,
    "F"
  );

  pdf.setGState(
    new (pdf as any).GState({
      opacity: 1,
    })
  );

  /* ==========================================================
     BORDER
     ========================================================== */

  pdf.setDrawColor(
    GOLD[0],
    GOLD[1],
    GOLD[2]
  );

  pdf.setLineWidth(
    0.65
  );

  pdf.roundedRect(
    2.5,
    2.5,
    95,
    155,
    5,
    5,
    "S"
  );

  pdf.setDrawColor(
    LIGHT_GOLD[0],
    LIGHT_GOLD[1],
    LIGHT_GOLD[2]
  );

  pdf.setLineWidth(
    0.18
  );

  pdf.roundedRect(
    4,
    4,
    92,
    152,
    4,
    4,
    "S"
  );

  /* ==========================================================
     VYRA TOP
     ========================================================== */

  pdf.setTextColor(
    IVORY[0],
    IVORY[1],
    IVORY[2]
  );

  pdf.setFont(
    "times",
    "bold"
  );

  pdf.setFontSize(
    28
  );

  centerText(
    pdf,
    "VYRA",
    50,
    23
  );

  pdf.setFont(
    "helvetica",
    "bold"
  );

  pdf.setFontSize(
    4.1
  );

  pdf.setCharSpace(
    2.2
  );

  centerText(
    pdf,
    "ENTERTAINMENT",
    50,
    28.5
  );

  pdf.setCharSpace(
    0
  );

  pdf.setTextColor(
    GOLD[0],
    GOLD[1],
    GOLD[2]
  );

  pdf.setFontSize(
    2.7
  );

  pdf.setCharSpace(
    1.4
  );

  centerText(
    pdf,
    "BEYOND THE ORDINARY",
    50,
    34
  );

  pdf.setCharSpace(
    0
  );

  /* ==========================================================
     ENTRY PASS
     ========================================================== */

  pdf.setDrawColor(
    GOLD[0],
    GOLD[1],
    GOLD[2]
  );

  pdf.setLineWidth(
    0.35
  );

  pdf.roundedRect(
    71,
    7,
    23,
    8,
    4,
    4,
    "S"
  );

  pdf.setTextColor(
    IVORY[0],
    IVORY[1],
    IVORY[2]
  );

  pdf.setFont(
    "helvetica",
    "bold"
  );

  pdf.setFontSize(
    3.6
  );

  pdf.setCharSpace(
    0.7
  );

  centerText(
    pdf,
    "ENTRY PASS",
    82.5,
    12
  );

  pdf.setCharSpace(
    0
  );

  /* ==========================================================
     INVITATION
     ========================================================== */

  pdf.setTextColor(
    LIGHT_GOLD[0],
    LIGHT_GOLD[1],
    LIGHT_GOLD[2]
  );

  pdf.setFont(
    "helvetica",
    "bold"
  );

  pdf.setFontSize(
    4.8
  );

  pdf.setCharSpace(
    1.15
  );

  centerText(
    pdf,
    "YOU ARE INVITED TO",
    50,
    43
  );

  pdf.setCharSpace(
    0
  );

  /* ==========================================================
     EVENT NAME
     ========================================================== */

  let eventName =
    event.name?.trim() ||
    "EVENT";

  eventName =
    eventName.toUpperCase();

  fitFont(
    pdf,
    eventName,
    80,
    19
  );

  pdf.setFont(
    "times",
    "bold"
  );

  pdf.setTextColor(
    WHITE[0],
    WHITE[1],
    WHITE[2]
  );

  centerText(
    pdf,
    eventName,
    50,
    54
  );

  pdf.setDrawColor(
    GOLD[0],
    GOLD[1],
    GOLD[2]
  );

  pdf.setLineWidth(
    0.45
  );

  pdf.line(
    44,
    58,
    56,
    58
  );

  /* ==========================================================
     GUEST
     ========================================================== */

  pdf.setTextColor(
    GOLD[0],
    GOLD[1],
    GOLD[2]
  );

  pdf.setFont(
    "helvetica",
    "bold"
  );

  pdf.setFontSize(
    3.8
  );

  pdf.setCharSpace(
    1.4
  );

  centerText(
    pdf,
    "GUEST",
    50,
    63
  );

  pdf.setCharSpace(
    0
  );

  let guestName =
    guest.name?.trim() ||
    "GUEST";

  guestName =
    guestName.toUpperCase();

  fitFont(
    pdf,
    guestName,
    80,
    16
  );

  pdf.setFont(
    "times",
    "bold"
  );

  pdf.setTextColor(
    IVORY[0],
    IVORY[1],
    IVORY[2]
  );

  centerText(
    pdf,
    guestName,
    50,
    71
  );

  /* ==========================================================
     EVENT INFO
     ========================================================== */

  pdf.setDrawColor(
    GOLD[0],
    GOLD[1],
    GOLD[2]
  );

  pdf.setLineWidth(
    0.30
  );

  pdf.roundedRect(
    6,
    75,
    88,
    21,
    4,
    4,
    "S"
  );

  pdf.setLineWidth(
    0.16
  );

  pdf.line(
    35.7,
    77,
    35.7,
    94
  );

  pdf.line(
    65,
    77,
    65,
    94
  );

  pdf.setTextColor(
    GOLD[0],
    GOLD[1],
    GOLD[2]
  );

  pdf.setFont(
    "helvetica",
    "bold"
  );

  pdf.setFontSize(
    3.2
  );

  pdf.setCharSpace(
    0.7
  );

  centerText(
    pdf,
    "DATE",
    20.8,
    80.5
  );

  centerText(
    pdf,
    "VENUE",
    50.3,
    80.5
  );

  centerText(
    pdf,
    "TIME",
    79.2,
    80.5
  );

  pdf.setCharSpace(
    0
  );

  pdf.setTextColor(
    WHITE[0],
    WHITE[1],
    WHITE[2]
  );

  pdf.setFont(
    "helvetica",
    "bold"
  );

  pdf.setFontSize(
    4.8
  );

  centerText(
    pdf,
    formatDate(event.date),
    20.8,
    88
  );

  const venue =
    event.venue?.trim() ||
    "VENUE TBA";

  fitFont(
    pdf,
    venue.toUpperCase(),
    23,
    4.8
  );

  centerText(
    pdf,
    venue.toUpperCase(),
    50.3,
    88
  );

  pdf.setFontSize(
    4.8
  );

  centerText(
    pdf,
    formatTime(event.time),
    79.2,
    88
  );

  /* ==========================================================
     QR CODE
     ========================================================== */

  const qr =
    await generateQr(
      guest.qr_token
    );

  /*
   * WHITE QR BACKING
   */

  pdf.setFillColor(
    255,
    255,
    255
  );

  pdf.roundedRect(
    32,
    97,
    36,
    36,
    3.5,
    3.5,
    "F"
  );

  /*
   * GOLD QR BORDER
   */

  pdf.setDrawColor(
    GOLD[0],
    GOLD[1],
    GOLD[2]
  );

  pdf.setLineWidth(
    0.65
  );

  pdf.roundedRect(
    32,
    97,
    36,
    36,
    3.5,
    3.5,
    "S"
  );

  /*
   * ACTUAL QR
   *
   * This is now inserted as a PNG data URL.
   */

  pdf.addImage(
    qr,
    "PNG",
    35.5,
    100.5,
    29,
    29,
    undefined,
    "FAST"
  );

  /* ==========================================================
     SCAN LABEL
     ========================================================== */

  pdf.setTextColor(
    GOLD[0],
    GOLD[1],
    GOLD[2]
  );

  pdf.setFont(
    "helvetica",
    "bold"
  );

  pdf.setFontSize(
    3.6
  );

  pdf.setCharSpace(
    1.15
  );

  centerText(
    pdf,
    "SCAN TO ENTER",
    50,
    135
  );

  pdf.setCharSpace(
    0
  );

  /* ==========================================================
     PASS ID
     ========================================================== */

  pdf.setFillColor(
    DARK[0],
    DARK[1],
    DARK[2]
  );

  pdf.setGState(
    new (pdf as any).GState({
      opacity: 0.88,
    })
  );

  pdf.roundedRect(
    27,
    138,
    46,
    11.5,
    3,
    3,
    "F"
  );

  pdf.setGState(
    new (pdf as any).GState({
      opacity: 1,
    })
  );

  pdf.setDrawColor(
    GOLD[0],
    GOLD[1],
    GOLD[2]
  );

  pdf.setLineWidth(
    0.35
  );

  pdf.roundedRect(
    27,
    138,
    46,
    11.5,
    3,
    3,
    "S"
  );

  pdf.setTextColor(
    GOLD[0],
    GOLD[1],
    GOLD[2]
  );

  pdf.setFont(
    "helvetica",
    "bold"
  );

  pdf.setFontSize(
    2.8
  );

  pdf.setCharSpace(
    1.1
  );

  centerText(
    pdf,
    "PASS ID",
    50,
    141.6
  );

  pdf.setCharSpace(
    0
  );

  pdf.setTextColor(
    IVORY[0],
    IVORY[1],
    IVORY[2]
  );

  pdf.setFont(
    "helvetica",
    "bold"
  );

  pdf.setFontSize(
    5.8
  );

  centerText(
    pdf,
    guest.pass_id,
    50,
    146
  );

  /* ==========================================================
     FOOTER
     ========================================================== */

  pdf.setDrawColor(
    GOLD[0],
    GOLD[1],
    GOLD[2]
  );

  pdf.setLineWidth(
    0.18
  );

  pdf.line(
    13,
    151.8,
    37,
    151.8
  );

  pdf.line(
    63,
    151.8,
    87,
    151.8
  );

  pdf.setTextColor(
    GOLD[0],
    GOLD[1],
    GOLD[2]
  );

  pdf.setFont(
    "times",
    "bold"
  );

  pdf.setFontSize(
    6.5
  );

  pdf.setCharSpace(
    1.8
  );

  centerText(
    pdf,
    "VYRA",
    50,
    153.8
  );

  pdf.setFont(
    "helvetica",
    "bold"
  );

  pdf.setFontSize(
    2.5
  );

  pdf.setCharSpace(
    1.2
  );

  centerText(
    pdf,
    "BEYOND THE ORDINARY",
    50,
    156.7
  );

  pdf.setCharSpace(
    0
  );

  /* ==========================================================
     SAVE
     ========================================================== */

  const safeName =
    guest.name
      .replace(
        /[^a-z0-9]+/gi,
        "_"
      )
      .replace(
        /^_+|_+$/g,
        ""
      );

  pdf.save(
    `${safeName}_VYRA_${guest.pass_id}.pdf`
  );
}

/* ============================================================
   WHATSAPP
   ============================================================ */

export const waLink = (
  guest: Guest,
  event: EventRow
) => {
  const phone =
    (guest.phone || "").replace(
      /\D/g,
      ""
    );

  const message =
    `Hey ${guest.name}! 🎉\n` +
    `Here's your pass for ${event.name}.\n` +
    `Please keep this QR pass ready at the entrance.`;

  return `https://wa.me/${phone}?text=${encodeURIComponent(
    message
  )}`;
};