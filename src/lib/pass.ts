import QRCode from "qrcode";
import { jsPDF } from "jspdf";
import type { EventRow, Guest } from "./supabase";

/* ========================================================================= */
/* BACKGROUND                                                                */
/* ========================================================================= */

export const PASS_BACKGROUND_URL =
  "/pass-background.jpg";

function getBackgroundUrl() {
  return `${PASS_BACKGROUND_URL}?v=${Date.now()}`;
}

/* ========================================================================= */
/* PASS ID / TOKEN                                                           */
/* ========================================================================= */

const CHARS =
  "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomChars(length: number) {
  const bytes = crypto.getRandomValues(
    new Uint8Array(length)
  );

  return Array.from(
    bytes,
    (byte) =>
      CHARS[byte % CHARS.length]
  ).join("");
}

export const newPassId = () =>
  `VYRA-${randomChars(8)}`;

export const newToken = () =>
  Array.from(
    crypto.getRandomValues(
      new Uint8Array(24)
    ),
    (byte) =>
      byte
        .toString(16)
        .padStart(2, "0")
  ).join("");

/* ========================================================================= */
/* QR                                                                        */
/* ========================================================================= */

export const verifyUrl = (
  token: string
) =>
  `${import.meta.env.VITE_PUBLIC_URL || location.origin}/verify/${token}`;

export async function createQr(
  token: string
) {
  return QRCode.toDataURL(
    verifyUrl(token),
    {
      width: 800,
      margin: 1,
      errorCorrectionLevel: "H",
      color: {
        dark: "#101010",
        light: "#FFFFFF",
      },
    }
  );
}

export const qrDataUrl = (
  token: string
) => createQr(token);

/* ========================================================================= */
/* IMAGE LOADER                                                              */
/* ========================================================================= */

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
            `Unable to load pass background: ${src}`
          )
        );

      img.src = src;
    }
  );
}

/* ========================================================================= */
/* HELPERS                                                                   */
/* ========================================================================= */

function formatDate(
  date: string | null
) {
  if (!date) return "TBA";

  const parts =
    date.split("-");

  if (parts.length !== 3) {
    return date;
  }

  const [
    year,
    month,
    day,
  ] = parts;

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

  const parts =
    time.split(":");

  if (parts.length < 2) {
    return time;
  }

  let hour =
    Number(parts[0]);

  if (Number.isNaN(hour)) {
    return time;
  }

  const minute =
    parts[1];

  const suffix =
    hour >= 12 ? "PM" : "AM";

  hour =
    hour % 12 || 12;

  return `${hour}:${minute} ${suffix}`;
}

function fitFont(
  pdf: jsPDF,
  text: string,
  maxWidth: number,
  startSize: number
) {
  let size =
    startSize;

  pdf.setFontSize(size);

  while (
    pdf.getTextWidth(text) >
      maxWidth &&
    size > 6
  ) {
    size -= 0.5;
    pdf.setFontSize(size);
  }

  return size;
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

/* ========================================================================= */
/* DOWNLOAD PASS                                                             */
/* ========================================================================= */

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

  /* ======================================================================= */
  /* COLORS                                                                  */
  /* ======================================================================= */

  const GOLD = [
    255,
    213,
    108,
  ];

  const LIGHT_GOLD = [
    255,
    229,
    164,
  ];

  const IVORY = [
    255,
    251,
    242,
  ];

  const WHITE = [
    255,
    255,
    255,
  ];

  const DARK = [
    3,
    7,
    15,
  ];

  /* ======================================================================= */
  /* BACKGROUND IMAGE                                                        */
  /* ======================================================================= */

  try {
    const background =
      await loadImage(
        getBackgroundUrl()
      );

    pdf.addImage(
      background,
      "JPEG",
      0,
      0,
      100,
      160
    );
  } catch (error) {
    console.error(
      "Unable to load pass background:",
      error
    );

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

  /* ======================================================================= */
  /* TOP CINEMATIC DARK PANEL                                                */
  /* ======================================================================= */

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

  /* ======================================================================= */
  /* MIDDLE TEXT PANEL                                                       */
  /* ======================================================================= */

  pdf.setFillColor(
    DARK[0],
    DARK[1],
    DARK[2]
  );

  pdf.setGState(
    new (pdf as any).GState({
      opacity: 0.58,
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

  /* ======================================================================= */
  /* EVENT INFORMATION PANEL                                                 */
  /* ======================================================================= */

  pdf.setFillColor(
    DARK[0],
    DARK[1],
    DARK[2]
  );

  pdf.setGState(
    new (pdf as any).GState({
      opacity: 0.76,
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

  /* ======================================================================= */
  /* LOWER PANEL                                                             */
  /* ======================================================================= */

  pdf.setFillColor(
    DARK[0],
    DARK[1],
    DARK[2]
  );

  pdf.setGState(
    new (pdf as any).GState({
      opacity: 0.74,
    })
  );

  pdf.roundedRect(
    7,
    117,
    86,
    39,
    5,
    5,
    "F"
  );

  pdf.setGState(
    new (pdf as any).GState({
      opacity: 1,
    })
  );

  /* ======================================================================= */
  /* GOLD BORDER                                                              */
  /* ======================================================================= */

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

  /* ======================================================================= */
  /* TOP BRAND                                                                */
  /* ======================================================================= */

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
    5.1
  );

  pdf.setCharSpace(
    1.0
  );

  centerText(
    pdf,
    "VYRA ENTERTAINMENT",
    50,
    11.5
  );

  pdf.setCharSpace(
    0
  );

  /* ======================================================================= */
  /* ENTRY PASS                                                               */
  /* ======================================================================= */

  pdf.setDrawColor(
    GOLD[0],
    GOLD[1],
    GOLD[2]
  );

  pdf.setLineWidth(
    0.35
  );

  pdf.roundedRect(
    71.5,
    7,
    22,
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
    3.7
  );

  pdf.setCharSpace(
    0.6
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

  /* ======================================================================= */
  /* VYRA                                                                      */
  /* ======================================================================= */

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
    29
  );

  centerText(
    pdf,
    "VYRA",
    50,
    24
  );

  pdf.setFont(
    "helvetica",
    "bold"
  );

  pdf.setFontSize(
    4.3
  );

  pdf.setCharSpace(
    2.5
  );

  centerText(
    pdf,
    "ENTERTAINMENT",
    50,
    29.2
  );

  pdf.setCharSpace(
    0
  );

  pdf.setDrawColor(
    GOLD[0],
    GOLD[1],
    GOLD[2]
  );

  pdf.setLineWidth(
    0.25
  );

  pdf.line(
    34,
    31.7,
    66,
    31.7
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
    1.5
  );

  centerText(
    pdf,
    "BEYOND THE ORDINARY",
    50,
    35
  );

  pdf.setCharSpace(
    0
  );

  /* ======================================================================= */
  /* INVITATION                                                               */
  /* ======================================================================= */

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
    4.7
  );

  pdf.setCharSpace(
    1.2
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

  /* ======================================================================= */
  /* EVENT TITLE                                                              */
  /* ======================================================================= */

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
    44.5,
    58,
    55.5,
    58
  );

  /* ======================================================================= */
  /* GUEST LABEL                                                              */
  /* ======================================================================= */

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
    1.5
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

  /* ======================================================================= */
  /* GUEST NAME                                                               */
  /* ======================================================================= */

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

  /* ======================================================================= */
  /* EVENT INFO FRAME                                                         */
  /* ======================================================================= */

  pdf.setDrawColor(
    GOLD[0],
    GOLD[1],
    GOLD[2]
  );

  pdf.setLineWidth(
    0.3
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

  /* Vertical separators */

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

  /* ======================================================================= */
  /* EVENT LABELS                                                             */
  /* ======================================================================= */

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
    0.8
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

  /* ======================================================================= */
  /* EVENT VALUES                                                             */
  /* ======================================================================= */

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
    4.9
  );

  centerText(
    pdf,
    formatDate(
      event.date
    ),
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
    4.9
  );

  centerText(
    pdf,
    venue.toUpperCase(),
    50.3,
    88
  );

  pdf.setFontSize(
    4.9
  );

  centerText(
    pdf,
    formatTime(
      event.time
    ),
    79.2,
    88
  );

  /* ======================================================================= */
  /* QR CODE                                                                  */
  /* ======================================================================= */

  const qr =
    await createQr(
      guest.qr_token
    );

  pdf.setFillColor(
    255,
    255,
    255
  );

  pdf.roundedRect(
    32.5,
    97,
    35,
    35,
    3.5,
    3.5,
    "F"
  );

  pdf.setDrawColor(
    GOLD[0],
    GOLD[1],
    GOLD[2]
  );

  pdf.setLineWidth(
    0.6
  );

  pdf.roundedRect(
    32.5,
    97,
    35,
    35,
    3.5,
    3.5,
    "S"
  );

  pdf.addImage(
    qr,
    "PNG",
    36,
    100.5,
    28,
    28
  );

  /* ======================================================================= */
  /* SCAN TEXT                                                                */
  /* ======================================================================= */

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

  /* ======================================================================= */
  /* PASS ID                                                                  */
  /* ======================================================================= */

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

  /* ======================================================================= */
  /* FOOTER                                                                   */
  /* ======================================================================= */

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

  /* ======================================================================= */
  /* DOWNLOAD                                                                 */
  /* ======================================================================= */

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

/* ========================================================================= */
/* WHATSAPP                                                                  */
/* ========================================================================= */

export const waLink = (
  guest: Guest,
  event: EventRow
) => {
  const phone =
    (guest.phone || "")
      .replace(/\D/g, "");

  const message =
    `Hey ${guest.name}! 🎉\n` +
    `Here's your pass for ${event.name}.\n` +
    `Please keep this QR pass ready at the entrance.`;

  return `https://wa.me/${phone}?text=${encodeURIComponent(
    message
  )}`;
};