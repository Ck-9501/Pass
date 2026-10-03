import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

import { supabase } from "../lib/supabase";
import type { EventRow, Guest } from "../lib/supabase";
import {
  PASS_BACKGROUND_URL,
  generateQr,
  newPassId,
  newToken,
} from "../lib/pass";
import Icon from "../components/Icon";

interface CreatePassProps {
  ev?: EventRow | null;
  events?: EventRow[];
  onSelected?: (event: EventRow) => void;
  role?: string;
  event?: EventRow | null;
}

type GuestRecord = Guest & {
  created_by?: string | null;
  created_by_name?: string | null;
};

/* Must match the current guests.pass_type constraint */
const PASS_TYPES = [
  "Regular",
  "Early Bird",
  "Couple",
  "Surge Pass",
];

const PASS_PRICES: Record<string, number> = {
  Regular: 400,
  "Early Bird": 350,
  Couple: 700,
  "Surge Pass": 600,
};

function getPassPrice(passType: string) {
  return PASS_PRICES[passType] ?? 0;
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/* Wait until the hidden pass has rendered for this guest */
async function waitForPass(
  el: HTMLElement,
  passId: string
) {
  for (let i = 0; i < 60; i++) {
    if (el.textContent?.includes(passId)) {
      return true;
    }

    await sleep(50);
  }

  return false;
}

/* Wait until every image inside the pass has loaded */
async function waitForImages(el: HTMLElement) {
  const imgs = Array.from(
    el.querySelectorAll("img")
  );

  await Promise.all(
    imgs.map((img) => {
      if (
        img.complete &&
        img.naturalWidth > 0
      ) {
        return Promise.resolve();
      }

      return new Promise<void>((resolve) => {
        img.addEventListener(
          "load",
          () => resolve(),
          { once: true }
        );

        img.addEventListener(
          "error",
          () => resolve(),
          { once: true }
        );
      });
    })
  );
}

function formatDate(date: string | null) {
  if (!date) return "TBA";

  const parts = date.split("-");

  if (parts.length !== 3) {
    return date;
  }

  const [year, month, day] = parts;

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

  const monthName =
    months[Number(month) - 1] || month;

  return `${day} ${monthName} ${year}`;
}

function formatTime(time: string | null) {
  if (!time) return "TBA";

  const parts = time.split(":");

  if (parts.length < 2) {
    return time;
  }

  let hour = Number(parts[0]);
  const minute = parts[1];

  if (Number.isNaN(hour)) {
    return time;
  }

  const suffix = hour >= 12 ? "PM" : "AM";

  hour = hour % 12 || 12;

  return `${hour}:${minute} ${suffix}`;
}

function venueText(venue: string | null) {
  return venue?.trim() || "VENUE TBA";
}

/* ========================================================================= */
/* PASS ARTWORK                                                             */
/* ========================================================================= */

interface PassArtworkProps {
  guest: Guest;
  event: EventRow;
  qrDataUrl: string;
  bgVersion: number;
}

function PassArtwork({
  guest,
  event,
  qrDataUrl,
  bgVersion,
}: PassArtworkProps) {
  return (
    <div
      className="vyra-pass-artwork"
      style={{
        position: "relative",
        width: 1024,
        height: 1536,
        overflow: "hidden",
        background: "#050810",
        color: "#ffffff",
        fontFamily:
          "Arial, Helvetica, sans-serif",
      }}
    >
      {/* BACKGROUND */}
      <img
        src={`${PASS_BACKGROUND_URL}?v=${bgVersion}`}
        alt=""
        crossOrigin="anonymous"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center",
          display: "block",
          zIndex: 0,
        }}
      />

      {/* CINEMATIC OVERLAY */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          background:
            "linear-gradient(180deg, rgba(1,5,15,.73) 0%, rgba(2,7,15,.20) 28%, rgba(0,0,0,.08) 52%, rgba(1,5,12,.30) 68%, rgba(0,2,8,.78) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* CENTER GLOW */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          background:
            "radial-gradient(circle at 50% 48%, rgba(255,220,145,.10) 0%, rgba(255,220,145,0) 42%)",
          pointerEvents: "none",
        }}
      />

      {/* GOLD BORDER */}
      <div
        style={{
          position: "absolute",
          inset: 24,
          zIndex: 2,
          border:
            "2px solid rgba(241,203,117,.90)",
          borderRadius: 28,
          boxShadow:
            "0 0 20px rgba(241,203,117,.18), inset 0 0 35px rgba(0,0,0,.14)",
          pointerEvents: "none",
        }}
      />

      {/* INNER BORDER */}
      <div
        style={{
          position: "absolute",
          inset: 37,
          zIndex: 2,
          border:
            "1px solid rgba(255,244,210,.22)",
          borderRadius: 21,
          pointerEvents: "none",
        }}
      />

      {/* TOP BRAND */}
      <div
        style={{
          position: "absolute",
          top: 68,
          left: 70,
          right: 70,
          zIndex: 4,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: 5,
            color: "#f5d98d",
            textShadow:
              "0 2px 8px rgba(0,0,0,.65)",
          }}
        >
          VYRA ENTERTAINMENT
        </div>

        <div
          style={{
            padding: "10px 18px",
            borderRadius: 25,
            border:
              "1px solid rgba(245,213,135,.78)",
            background:
              "rgba(2,7,14,.28)",
            fontSize: 12,
            letterSpacing: 3,
            color: "#fff3d2",
          }}
        >
          ENTRY PASS
        </div>
      </div>

      {/* VYRA */}
      <div
        style={{
          position: "absolute",
          top: 138,
          left: 50,
          right: 50,
          zIndex: 4,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily:
              "Georgia, 'Times New Roman', serif",
            fontSize: 86,
            fontWeight: 500,
            letterSpacing: 7,
            lineHeight: 0.95,
            color: "#fff7e5",
            textShadow:
              "0 3px 12px rgba(0,0,0,.65), 0 0 18px rgba(255,230,170,.18)",
          }}
        >
          VYRA
        </div>

        <div
          style={{
            marginTop: 9,
            fontSize: 17,
            letterSpacing: 10,
            color: "#ffffff",
            textShadow:
              "0 2px 8px rgba(0,0,0,.55)",
          }}
        >
          ENTERTAINMENT
        </div>

        <div
          style={{
            width: 255,
            height: 1,
            margin: "15px auto 11px",
            background:
              "linear-gradient(90deg, transparent, #f1cf7b, transparent)",
          }}
        />

        <div
          style={{
            fontSize: 10,
            letterSpacing: 6,
            color: "#f2d27f",
          }}
        >
          BEYOND THE ORDINARY
        </div>
      </div>

      {/* EVENT TITLE */}
      <div
        style={{
          position: "absolute",
          top: 315,
          left: 55,
          right: 55,
          zIndex: 4,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 15,
            letterSpacing: 7,
            color: "#f6e8c7",
            textShadow:
              "0 2px 9px rgba(0,0,0,.65)",
          }}
        >
          YOU ARE INVITED TO
        </div>

        <div
          style={{
            marginTop: 18,
            fontFamily:
              "Georgia, 'Times New Roman', serif",
            fontSize: 67,
            lineHeight: 1,
            letterSpacing: 1,
            color: "#fff9ec",
            textTransform: "uppercase",
            textShadow:
              "0 4px 17px rgba(0,0,0,.72), 0 0 10px rgba(255,226,170,.10)",
          }}
        >
          {event.name || "EVENT"}
        </div>

        <div
          style={{
            margin: "17px auto 0",
            width: 72,
            height: 2,
            background: "#f3cf78",
            boxShadow:
              "0 0 12px rgba(243,207,120,.50)",
          }}
        />
      </div>

      {/* GUEST */}
      <div
        style={{
          position: "absolute",
          top: 565,
          left: 82,
          right: 82,
          zIndex: 4,
          padding: "17px 20px 21px",
          textAlign: "center",
          borderTop:
            "1px solid rgba(241,203,117,.60)",
          borderBottom:
            "1px solid rgba(241,203,117,.42)",
          background:
            "rgba(2,7,14,.20)",
          borderRadius: 8,
        }}
      >
        <div
          style={{
            fontSize: 12,
            letterSpacing: 6,
            color: "#f2d27f",
          }}
        >
          GUEST
        </div>

        <div
          style={{
            marginTop: 9,
            fontFamily:
              "Georgia, 'Times New Roman', serif",
            fontSize: 49,
            lineHeight: 1.12,
            color: "#fff8e9",
            textShadow:
              "0 3px 13px rgba(0,0,0,.65)",
          }}
        >
          {guest.name}
        </div>
      </div>

      {/* EVENT INFO */}
      <div
        style={{
          position: "absolute",
          left: 70,
          right: 70,
          top: 715,
          zIndex: 4,
          display: "grid",
          gridTemplateColumns:
            "1fr 1.25fr 1fr",
          overflow: "hidden",
          border:
            "1px solid rgba(242,205,123,.68)",
          borderRadius: 22,
          background:
            "rgba(2,7,14,.65)",
          boxShadow:
            "0 15px 32px rgba(0,0,0,.25)",
          backdropFilter: "blur(4px)",
        }}
      >
        {/* DATE */}
        <div
          style={{
            minHeight: 150,
            padding: 20,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center",
            borderRight:
              "1px solid rgba(242,205,123,.32)",
          }}
        >
          <div
            style={{
              color: "#f2d27f",
              marginBottom: 9,
            }}
          >
            <Icon name="calendar" size={22} />
          </div>

          <div
            style={{
              fontSize: 10,
              letterSpacing: 4,
              color: "#f2d27f",
            }}
          >
            DATE
          </div>

          <div
            style={{
              marginTop: 7,
              fontFamily:
                "Georgia, 'Times New Roman', serif",
              fontSize: 20,
              lineHeight: 1.15,
              color: "#ffffff",
            }}
          >
            {formatDate(event.date)}
          </div>
        </div>

        {/* VENUE */}
        <div
          style={{
            minHeight: 150,
            padding: 20,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center",
            borderRight:
              "1px solid rgba(242,205,123,.32)",
          }}
        >
          <div
            style={{
              color: "#f2d27f",
              marginBottom: 9,
            }}
          >
            <Icon name="pin" size={22} />
          </div>

          <div
            style={{
              fontSize: 10,
              letterSpacing: 4,
              color: "#f2d27f",
            }}
          >
            VENUE
          </div>

          <div
            style={{
              marginTop: 7,
              maxWidth: 260,
              fontFamily:
                "Georgia, 'Times New Roman', serif",
              fontSize: 20,
              lineHeight: 1.15,
              color: "#ffffff",
            }}
          >
            {venueText(event.venue)}
          </div>
        </div>

        {/* TIME */}
        <div
          style={{
            minHeight: 150,
            padding: 20,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <div
            style={{
              color: "#f2d27f",
              marginBottom: 9,
            }}
          >
            <Icon name="clock" size={22} />
          </div>

          <div
            style={{
              fontSize: 10,
              letterSpacing: 4,
              color: "#f2d27f",
            }}
          >
            TIME
          </div>

          <div
            style={{
              marginTop: 7,
              fontFamily:
                "Georgia, 'Times New Roman', serif",
              fontSize: 20,
              color: "#ffffff",
            }}
          >
            {formatTime(event.time)}
          </div>
        </div>
      </div>

      {/* QR CODE */}
      <div
        style={{
          position: "absolute",
          top: 910,
          left: 0,
          right: 0,
          zIndex: 4,
          textAlign: "center",
        }}
      >
        <div
          style={{
            boxSizing: "content-box",
            display: "block",
            width: 220,
            height: 220,
            padding: 14,
            margin: "0 auto",
            borderRadius: 19,
            background: "#ffffff",
            border:
              "2px solid rgba(242,205,123,.95)",
            boxShadow:
              "0 0 24px rgba(242,205,123,.30), 0 15px 28px rgba(0,0,0,.28)",
          }}
        >
          {qrDataUrl ? (
            <img
              data-pass-qr="1"
              src={qrDataUrl}
              alt="Entry QR"
              style={{
                width: 220,
                height: 220,
                display: "block",
              }}
            />
          ) : (
            <div
              style={{
                width: 220,
                height: 220,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#111111",
                fontSize: 14,
              }}
            >
              QR ERROR
            </div>
          )}
        </div>

        <div
          style={{
            marginTop: 15,
            fontSize: 12,
            letterSpacing: 6,
            color: "#f2d27f",
            textShadow:
              "0 2px 8px rgba(0,0,0,.65)",
          }}
        >
          SCAN TO ENTER
        </div>
      </div>

      {/* PASS ID */}
      <div
        style={{
          position: "absolute",
          top: 1222,
          left: 0,
          right: 0,
          zIndex: 4,
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-block",
            minWidth: 320,
            padding: "13px 30px 15px",
            borderRadius: 17,
            border:
              "1px solid rgba(242,205,123,.78)",
            background:
              "rgba(2,7,14,.70)",
            boxShadow:
              "0 12px 24px rgba(0,0,0,.22)",
          }}
        >
          <div
            style={{
              fontSize: 9,
              letterSpacing: 5,
              color: "#f2d27f",
            }}
          >
            PASS ID
          </div>

          <div
            style={{
              marginTop: 6,
              fontFamily:
                "Georgia, 'Times New Roman', serif",
              fontSize: 24,
              letterSpacing: 3,
              color: "#fff8e9",
            }}
          >
            {guest.pass_id}
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div
        style={{
          position: "absolute",
          left: 60,
          right: 60,
          bottom: 53,
          zIndex: 4,
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
          }}
        >
          <div
            style={{
              flex: 1,
              maxWidth: 180,
              height: 1,
              background:
                "linear-gradient(90deg, transparent, rgba(242,205,123,.75))",
            }}
          />

          <div
            style={{
              fontFamily:
                "Georgia, 'Times New Roman', serif",
              fontSize: 18,
              letterSpacing: 5,
              color: "#f2d27f",
            }}
          >
            VYRA
          </div>

          <div
            style={{
              flex: 1,
              maxWidth: 180,
              height: 1,
              background:
                "linear-gradient(90deg, rgba(242,205,123,.75), transparent)",
            }}
          />
        </div>

        <div
          style={{
            marginTop: 8,
            fontSize: 9,
            letterSpacing: 6,
            color: "#f2d27f",
          }}
        >
          BEYOND THE ORDINARY
        </div>
      </div>
    </div>
  );
}

/* ========================================================================= */
/* CREATE PASS PAGE                                                         */
/* ========================================================================= */

export default function CreatePass({
  ev = null,
  events = [],
  onSelected = () => {},
  role = "",
  event: legacyEvent = null,
}: CreatePassProps) {
  const initialEvent = ev || legacyEvent;
  const [selectedEventId, setSelectedEventId] =
    useState(initialEvent?.id || "");

  const [name, setName] = useState("");
  const [passType, setPassType] =
    useState("Regular");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [generatedGuest, setGeneratedGuest] =
    useState<Guest | null>(null);

  const [qrDataUrl, setQrDataUrl] =
    useState("");

  const [bgVersion, setBgVersion] =
    useState(() => Date.now());

  const passRef =
    useRef<HTMLDivElement>(null);

  const [isAdmin, setIsAdmin] =
    useState(role.toLowerCase() === "admin");

  const [submissions, setSubmissions] =
    useState<GuestRecord[]>([]);

  const [submissionsLoading, setSubmissionsLoading] =
    useState(true);

  const [deletingId, setDeletingId] =
    useState<string | null>(null);

  const selectedEvent = useMemo(() => {
    return (
      events.find(
        (event) =>
          event.id === selectedEventId
      ) ||
      ev ||
      null
    );
  }, [
    events,
    selectedEventId,
    initialEvent,
  ]);

  const passEvent = useMemo(() => {
    if (!generatedGuest) {
      return selectedEvent;
    }

    return (
      events.find(
        (event) =>
          event.id ===
          generatedGuest.event_id
      ) ||
      selectedEvent
    );
  }, [
    events,
    generatedGuest,
    selectedEvent,
  ]);

  useEffect(() => {
    if (!selectedEventId && initialEvent?.id) {
      setSelectedEventId(initialEvent.id);
    }
  }, [
    initialEvent,
    selectedEventId,
  ]);

  const handleEventChange = (
    eventId: string
  ) => {
    setSelectedEventId(eventId);

    const selected = events.find(
      (event) =>
        event.id === eventId
    );

    if (selected) {
      onSelected(selected);
    }
  };

  const loadSubmissions = async () => {
    setSubmissionsLoading(true);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError) {
        throw new Error(authError.message);
      }

      const user = authData.user;

      if (!user) {
        setIsAdmin(false);
        setSubmissions([]);
        return;
      }

      const metadataRole = String(
        user.user_metadata?.role ||
          user.app_metadata?.role ||
          ""
      ).toLowerCase();

      const admin =
        role.toLowerCase() === "admin" ||
        metadataRole === "admin";

      setIsAdmin(admin);

      /*
       * MEMBER: Submission is a live session list, not a history page.
       * Do not reload old rows from Supabase and do NOT reset the list
       * here (a late role change must never wipe passes generated in this
       * session). Newly generated passes are added locally inside
       * generatePass(), and deleted passes are removed locally inside
       * deleteSubmission(). The list already starts as [].
       */
      if (!admin) {
        return;
      }

      /*
       * ADMIN: keep the existing full team history from the database.
       */
      const { data, error } = await supabase
        .from("guests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      setSubmissions((data || []) as GuestRecord[]);
    } catch (err) {
      console.error("SUBMISSIONS LOAD ERROR:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Could not load submissions."
      );
    } finally {
      setSubmissionsLoading(false);
    }
  };

  useEffect(() => {
    void loadSubmissions();
  }, [role]);

  /*
   * Only admins need a database realtime subscription here.
   * Members keep Submission synchronized directly with the generation and
   * delete actions so a database event cannot wipe their live session list.
   */
  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    const channel = supabase
      .channel(`requests-guests-admin-${role || "admin"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "guests",
        },
        () => {
          void loadSubmissions();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isAdmin, role]);

  const getHeads = (passType: string) =>
    passType === "Couple" ? 2 : 1;

  const formatCreatedAt = (value?: string | null) => {
    if (!value) return "—";

    return new Date(value).toLocaleString([], {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getEventForGuest = (guest: GuestRecord) =>
    events.find((item) => item.id === guest.event_id) ||
    selectedEvent ||
    null;

  const downloadSubmissionPdf = async (guest: GuestRecord) => {
    const eventForPdf = getEventForGuest(guest);

    if (!eventForPdf) {
      setError("The event for this pass could not be found.");
      return;
    }

    try {
      setError("");
      const qr = await generateQr(guest.qr_token);

      if (!qr || !qr.startsWith("data:image/")) {
        throw new Error("QR code generation failed.");
      }

      setBgVersion(Date.now());
      setGeneratedGuest(guest);
      setQrDataUrl(qr);

      await sleep(200);
      await downloadPdf(guest, qr);
    } catch (err) {
      console.error("SUBMISSION DOWNLOAD ERROR:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Could not download the PDF."
      );
    }
  };

  const deleteSubmission = async (guest: GuestRecord) => {
    if (!window.confirm(`Delete the pass for ${guest.name}?`)) {
      return;
    }

    setDeletingId(guest.id);
    setError("");

    try {
      const { error: ledgerDeleteError } = await supabase
        .from("guest_requests")
        .delete()
        .eq("guest_id", guest.id);

      if (ledgerDeleteError) {
        throw new Error(ledgerDeleteError.message);
      }

      const { error: deleteError } = await supabase
        .from("guests")
        .delete()
        .eq("id", guest.id);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      setSubmissions((current) =>
        current.filter((item) => item.id !== guest.id)
      );

      if (generatedGuest?.id === guest.id) {
        setGeneratedGuest(null);
        setQrDataUrl("");
      }

      setSuccess(`Pass deleted for ${guest.name}.`);
    } catch (err) {
      console.error("PASS DELETE ERROR:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Could not delete the pass."
      );
    } finally {
      setDeletingId(null);
    }
  };

  /* --------------------------------------------------------------------- */
  /* DOWNLOAD PDF                                                         */
  /* --------------------------------------------------------------------- */

  const downloadPdf = async (
    guest: Guest | null = generatedGuest,
    qr: string = qrDataUrl
  ) => {
    if (!guest) {
      setError(
        "No pass is available to download."
      );
      return;
    }

    if (!qr) {
      setError(
        "QR code was not generated."
      );
      return;
    }

    /*
     * Give React time to render the newly-created
     * guest and QR into the hidden full-size pass.
     */
    for (
      let i = 0;
      i < 60 && !passRef.current;
      i++
    ) {
      await sleep(50);
    }

    const element = passRef.current;

    if (!element) {
      setError(
        "Pass preview could not be prepared."
      );
      return;
    }

    try {
      const rendered =
        await waitForPass(
          element,
          guest.pass_id
        );

      if (!rendered) {
        throw new Error(
          "Pass did not finish rendering."
        );
      }

      /*
       * Make sure the QR image exists.
       */
      const qrImage =
        element.querySelector(
          'img[data-pass-qr="1"]'
        ) as HTMLImageElement | null;

      if (!qrImage) {
        throw new Error(
          "QR image was not found in the pass."
        );
      }

      /*
       * Wait until the QR image is actually loaded.
       */
      await waitForImages(element);

      if (
        !qrImage.complete ||
        qrImage.naturalWidth === 0
      ) {
        throw new Error(
          "QR image failed to load."
        );
      }

      /*
       * Small rendering delay.
       */
      await sleep(300);

      /*
       * IMPORTANT:
       *
       * We DO NOT hide the QR anymore.
       *
       * The QR that you see in the pass is now
       * directly captured into the PDF canvas.
       */
      const canvas =
        await html2canvas(
          element,
          {
            width: 1024,
            height: 1536,
            scale: 2,
            useCORS: true,
            allowTaint: false,
            backgroundColor:
              "#050810",
            logging: false,
          }
        );

      /*
       * Convert the complete pass artwork
       * including the real QR into an image.
       */
      const image =
        canvas.toDataURL(
          "image/jpeg",
          0.96
        );

      /*
       * Create 2:3 portrait PDF.
       */
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: [288, 432],
        compress: true,
      });

      /*
       * The QR is ALREADY inside this image.
       *
       * No second QR insertion.
       * No hidden QR.
       * No coordinate guessing.
       */
      pdf.addImage(
        image,
        "JPEG",
        0,
        0,
        288,
        432,
        undefined,
        "FAST"
      );

      const safeName =
        guest.name
          .replace(
            /[^a-z0-9]+/gi,
            "-"
          )
          .replace(
            /^-|-$/g,
            ""
          );

      pdf.save(
        `${guest.pass_id}-${safeName}.pdf`
      );

      setSuccess(
        `PDF downloaded for ${guest.name}.`
      );
    } catch (err) {
      console.error(
        "PDF generation error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Could not create the PDF."
      );
    }
  };

  /* --------------------------------------------------------------------- */
  /* GENERATE PASS                                                         */
  /* --------------------------------------------------------------------- */

  const generatePass = async () => {
    setError("");
    setSuccess("");

    const guestName =
      name.trim();

    if (!guestName) {
      setError(
        "Enter the guest name."
      );
      return;
    }

    if (!selectedEvent) {
      setError(
        "Select an event."
      );
      return;
    }

    setLoading(true);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError) {
        throw new Error(authError.message);
      }

      const user = authData.user;

      if (!user) {
        throw new Error(
          "Please sign in before creating a pass."
        );
      }

      const creatorName =
        String(
          user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email ||
            "User"
        ).trim() || "User";

      /*
       * Generate IDs BEFORE inserting.
       *
       * This guarantees the exact qr_token saved
       * in Supabase is the exact token used to
       * generate the QR.
       */
      const passId =
        newPassId();

      const token =
        newToken();

      const { data, error: insertError } =
        await supabase
          .from("guests")
          .insert({
            event_id: selectedEvent.id,
            name: guestName,
            phone: null,
            pass_type: passType,
            pass_id: passId,
            qr_token: token,
            status: "valid",
            notes: null,
            created_by: user.id,
            created_by_name: creatorName,
          } as never)
          .select("*")
          .single();

      if (insertError) {
        throw new Error(
          insertError.message
        );
      }

      const guest =
        data as Guest;

      /*
       * Generate QR from the EXACT token
       * stored in Supabase.
       */
      const qr =
        await generateQr(
          guest.qr_token
        );

      if (
        !qr ||
        !qr.startsWith(
          "data:image/"
        )
      ) {
        throw new Error(
          "QR code generation failed."
        );
      }

      /*
       * Update React state.
       */
      setBgVersion(
        Date.now()
      );

      setGeneratedGuest(
        guest
      );

      setQrDataUrl(
        qr
      );

      setSuccess(
        `Pass created for ${guestName}.`
      );

      setName("");

      /*
       * Sync the Submission section immediately with the newly generated
       * pass. Members keep only the passes generated during this session;
       * admins also get the row instantly while their realtime subscription
       * keeps the full team list synchronized.
       */
      setSubmissions((current) => [
        guest as GuestRecord,
        ...current.filter((item) => item.id !== guest.id),
      ]);

      /*
       * Wait for React to render the new
       * guest + QR before generating PDF.
       */
      await sleep(150);

      /*
       * Generate PDF using the exact QR.
       */
      await downloadPdf(
        guest,
        qr
      );

      /* --------------------------------------------------------- */
      /* MONEY / ISSUANCE LEDGER                                  */
      /* --------------------------------------------------------- */

      const issuedPrice = getPassPrice(guest.pass_type);
      const pdfPath = `${guest.event_id}/${guest.pass_id}/${guest.pass_id}.pdf`;

      const { error: requestError } = await supabase
        .from("guest_requests")
        .insert({
          event_id: guest.event_id,
          guest_name: guest.name,
          phone: null,
          pass_type: guest.pass_type,
          notes: null,
          status: "generated",
          submitted_by: user.id,
          guest_id: guest.id,
          pdf_path: pdfPath,
          generated_at: new Date().toISOString(),
          issued_price: issuedPrice,
          drive_file_id: null,
        });

      if (requestError) {
        console.error("Money ledger save failed:", requestError);
        setError(
          `Pass was created and downloaded, but the money record could not be saved: ${requestError.message}`
        );
        if (isAdmin) {
          await loadSubmissions();
        }
        return;
      }

    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to create pass.";

      console.error(
        "Pass generation error:",
        err
      );

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  /* ========================================================================= */
  /* UI                                                                        */
  /* ========================================================================= */

  return (
    <div
      style={{
        paddingBottom: 45,
      }}
    >
      {/* HEADER */}

      <div
        style={{
          marginBottom: 24,
          display: "flex",
          alignItems: "flex-end",
          justifyContent:
            "space-between",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              marginBottom: 6,
              fontSize: 11,
              color: "var(--text3)",
              letterSpacing: 3,
              textTransform:
                "uppercase",
            }}
          >
            VYRA ENTERTAINMENT
          </div>

          <h1
            style={{
              margin: 0,
              fontFamily:
                "Georgia, 'Times New Roman', serif",
              fontWeight: 500,
              fontSize: 34,
            }}
          >
            Create Guest Pass
          </h1>

          <div
            style={{
              marginTop: 7,
              fontSize: 13,
              color: "var(--text2)",
            }}
          >
            Generate a unique luxury
            entry pass.
          </div>
        </div>
      </div>

      {/* FORM CARD */}

      <div
        className="card"
        style={{
          padding: 22,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(220px, 1.35fr) minmax(180px, 1fr) minmax(180px, 1fr)",
            gap: 16,
          }}
        >
          {/* EVENT */}

          <div>
            <label
              style={{
                display: "block",
                marginBottom: 8,
                fontSize: 11,
                color: "var(--text3)",
                letterSpacing: 1.2,
                textTransform:
                  "uppercase",
              }}
            >
              Event
            </label>

            <select
              value={
                selectedEventId
              }
              onChange={(e) =>
                handleEventChange(
                  e.target.value
                )
              }
              style={{
                width: "100%",
                boxSizing:
                  "border-box",
                padding:
                  "13px 14px",
                borderRadius: 10,
                border:
                  "1px solid var(--hair)",
                background:
                  "var(--panel2)",
                color:
                  "var(--text)",
                outline: "none",
              }}
            >
              <option value="">
                Select event
              </option>

              {events.map(
                (event) => (
                  <option
                    key={event.id}
                    value={event.id}
                  >
                    {event.name}
                  </option>
                )
              )}
            </select>
          </div>

          {/* GUEST NAME */}

          <div>
            <label
              style={{
                display: "block",
                marginBottom: 8,
                fontSize: 11,
                color: "var(--text3)",
                letterSpacing: 1.2,
                textTransform:
                  "uppercase",
              }}
            >
              Guest Name
            </label>

            <input
              value={name}
              onChange={(e) =>
                setName(
                  e.target.value
                )
              }
              onKeyDown={(e) => {
                if (
                  e.key === "Enter"
                ) {
                  generatePass();
                }
              }}
              placeholder="Enter guest name"
              style={{
                width: "100%",
                boxSizing:
                  "border-box",
                padding:
                  "13px 14px",
                borderRadius: 10,
                border:
                  "1px solid var(--hair)",
                background:
                  "var(--panel2)",
                color:
                  "var(--text)",
                outline: "none",
              }}
            />
          </div>

          {/* PASS CATEGORY */}

          <div>
            <label
              style={{
                display: "block",
                marginBottom: 8,
                fontSize: 11,
                color: "var(--text3)",
                letterSpacing: 1.2,
                textTransform:
                  "uppercase",
              }}
            >
              Pass Category
            </label>

            <select
              value={passType}
              onChange={(e) =>
                setPassType(
                  e.target.value
                )
              }
              style={{
                width: "100%",
                boxSizing:
                  "border-box",
                padding:
                  "13px 14px",
                borderRadius: 10,
                border:
                  "1px solid var(--hair)",
                background:
                  "var(--panel2)",
                color:
                  "var(--text)",
                outline: "none",
              }}
            >
              {PASS_TYPES.map(
                (type) => (
                  <option
                    key={type}
                    value={type}
                  >
                    {type} — ₹{getPassPrice(type)}
                    {" · "}
                    {getHeads(type)} {getHeads(type) === 1 ? "Head" : "Heads"}
                  </option>
                )
              )}
            </select>
          </div>
        </div>

        {/* SELECTED EVENT DETAILS */}

        {selectedEvent && (
          <div
            style={{
              marginTop: 18,
              padding: 14,
              display: "flex",
              gap: 22,
              flexWrap: "wrap",
              borderRadius: 12,
              border:
                "1px solid var(--hair)",
              background:
                "rgba(255,255,255,.025)",
              fontSize: 12,
            }}
          >
            <div>
              <span
                style={{
                  color:
                    "var(--text3)",
                }}
              >
                EVENT{" "}
              </span>
              <strong>
                {selectedEvent.name}
              </strong>
            </div>

            <div>
              <span
                style={{
                  color:
                    "var(--text3)",
                }}
              >
                DATE{" "}
              </span>
              <strong>
                {formatDate(
                  selectedEvent.date
                )}
              </strong>
            </div>

            <div>
              <span
                style={{
                  color:
                    "var(--text3)",
                }}
              >
                TIME{" "}
              </span>
              <strong>
                {formatTime(
                  selectedEvent.time
                )}
              </strong>
            </div>

            <div>
              <span
                style={{
                  color:
                    "var(--text3)",
                }}
              >
                VENUE{" "}
              </span>
              <strong>
                {venueText(
                  selectedEvent.venue
                )}
              </strong>
            </div>
          </div>
        )}

        {/* GENERATE BUTTON */}

        <div
          style={{
            marginTop: 20,
            display: "flex",
            justifyContent:
              "flex-end",
          }}
        >
          <button
            className="btn btn-primary"
            onClick={generatePass}
            disabled={loading}
            style={{
              minWidth: 190,
              display: "flex",
              alignItems:
                "center",
              justifyContent:
                "center",
              gap: 9,
            }}
          >
            {loading
              ? "Generating..."
              : "Generate Pass"}
          </button>
        </div>

        {/* ERROR */}

        {error && (
          <div
            style={{
              marginTop: 14,
              padding: 12,
              borderRadius: 10,
              border:
                "1px solid rgba(239,68,68,.25)",
              background:
                "rgba(239,68,68,.08)",
              color: "#ffabab",
              fontSize: 12,
              wordBreak:
                "break-word",
            }}
          >
            {error}
          </div>
        )}

        {/* SUCCESS */}

        {success && (
          <div
            style={{
              marginTop: 14,
              padding: 12,
              borderRadius: 10,
              border:
                "1px solid rgba(34,197,94,.18)",
              background:
                "rgba(34,197,94,.07)",
              color: "#94f5ad",
              fontSize: 12,
            }}
          >
            {success}
          </div>
        )}
      </div>

      {/* GENERATED PASS */}

      {generatedGuest &&
        passEvent && (
          <div
            className="card"
            style={{
              padding: 24,
              textAlign: "center",
            }}
          >
            {/* PREVIEW HEADER */}

            <div
              style={{
                marginBottom: 20,
                display: "flex",
                alignItems:
                  "center",
                justifyContent:
                  "space-between",
                gap: 20,
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  textAlign:
                    "left",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color:
                      "var(--text3)",
                    letterSpacing: 2,
                    textTransform:
                      "uppercase",
                  }}
                >
                  Generated Pass
                </div>

                <div
                  style={{
                    marginTop: 5,
                    fontSize: 15,
                    fontWeight: 700,
                  }}
                >
                  {
                    generatedGuest.name
                  }
                </div>

                <div
                  style={{
                    marginTop: 4,
                    fontSize: 12,
                    color:
                      "var(--text3)",
                  }}
                >
                  {
                    generatedGuest.pass_id
                  }
                </div>
              </div>

              <button
                className="btn"
                onClick={() =>
                  downloadPdf(
                    generatedGuest,
                    qrDataUrl
                  )
                }
                style={{
                  display: "flex",
                  alignItems:
                    "center",
                  gap: 8,
                }}
              >
                <Icon
                  name="download"
                  size={15}
                />
                Download PDF
              </button>
            </div>

            {/* PASS PREVIEW */}

            <div
              style={{
                width: "100%",
                overflow: "auto",
                display: "flex",
                justifyContent:
                  "center",
                paddingBottom: 15,
              }}
            >
              <div
                style={{
                  width: 430,
                  height: 645,
                  overflow: "hidden",
                  borderRadius: 18,
                  boxShadow:
                    "0 25px 75px rgba(0,0,0,.48), 0 0 35px rgba(230,190,92,.10)",
                }}
              >
                <div
                  style={{
                    width: 1024,
                    height: 1536,
                    transform:
                      "scale(0.419921875)",
                    transformOrigin:
                      "top left",
                  }}
                >
                  <PassArtwork
                    guest={
                      generatedGuest
                    }
                    event={
                      passEvent
                    }
                    qrDataUrl={
                      qrDataUrl
                    }
                    bgVersion={
                      bgVersion
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        )}

      {/* ===================================================================== */}
      {/* SUBMISSIONS / ALL TEAM REQUESTS                                     */}
      {/* ===================================================================== */}

      <div
        className="card"
        style={{
          padding: 24,
          marginTop: 24,
        }}
      >
        <div
          style={{
            marginBottom: 18,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                color: "var(--text3)",
                letterSpacing: 2,
                textTransform: "uppercase",
              }}
            >
              {isAdmin ? "Team Activity" : "Your Activity"}
            </div>

            <h2
              style={{
                margin: "5px 0 0",
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontWeight: 500,
                fontSize: 28,
              }}
            >
              {isAdmin ? "All Team Requests" : "Submission"}
            </h2>

            <div
              style={{
                marginTop: 6,
                fontSize: 12,
                color: "var(--text3)",
              }}
            >
              {isAdmin
                ? "All generated passes from the team."
                : "Your generated passes. Download or delete anytime."}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            <div
              style={{
                padding: "8px 12px",
                borderRadius: 999,
                border: "1px solid var(--hair)",
                color: "var(--text2)",
                fontSize: 12,
              }}
            >
              {submissions.length} {submissions.length === 1 ? "Pass" : "Passes"}
            </div>

            {isAdmin && (
              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: 999,
                  border: "1px solid rgba(242,205,123,.22)",
                  color: "#f2d27f",
                  fontSize: 12,
                }}
              >
                ₹{submissions.reduce((sum, item) => sum + getPassPrice(item.pass_type), 0)} Collected
              </div>
            )}
          </div>
        </div>

        {submissionsLoading ? (
          <div
            style={{
              padding: "42px 16px",
              textAlign: "center",
              color: "var(--text3)",
              fontSize: 13,
            }}
          >
            Loading passes…
          </div>
        ) : !submissions.length ? (
          <div
            style={{
              padding: "42px 16px",
              textAlign: "center",
              border: "1px dashed var(--hair)",
              borderRadius: 14,
              color: "var(--text3)",
              fontSize: 13,
            }}
          >
            {isAdmin
              ? "No passes have been generated for this event yet."
              : "You have not generated any passes yet."}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                minWidth: isAdmin ? 920 : 720,
                borderCollapse: "collapse",
                textAlign: "left",
              }}
            >
              <thead>
                <tr>
                  {[
                    "Guest",
                    ...(isAdmin ? ["Event", "Generated By"] : ["Event"]),
                    "Pass Type",
                    ...(isAdmin ? ["Price"] : []),
                    "Heads",
                    "Created",
                    "Actions",
                  ].map((heading) => (
                    <th
                      key={heading}
                      style={{
                        padding: "11px 12px",
                        borderBottom: "1px solid var(--hair)",
                        color: "var(--text3)",
                        fontSize: 9,
                        letterSpacing: 1.5,
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {submissions.map((guest) => (
                  <tr key={guest.id}>
                    <td
                      style={{
                        padding: "15px 12px",
                        borderBottom: "1px solid var(--hair)",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 700,
                          color: "var(--text)",
                          fontSize: 13,
                        }}
                      >
                        {guest.name}
                      </div>
                      <div
                        style={{
                          marginTop: 4,
                          color: "var(--text3)",
                          fontSize: 11,
                        }}
                      >
                        {guest.pass_id}
                      </div>
                    </td>

                    <td
                      style={{
                        padding: "15px 12px",
                        borderBottom: "1px solid var(--hair)",
                        color: "var(--text2)",
                        fontSize: 12,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {getEventForGuest(guest)?.name || "Unknown event"}
                    </td>

                    {isAdmin && (
                      <td
                        style={{
                          padding: "15px 12px",
                          borderBottom: "1px solid var(--hair)",
                          color: "var(--text2)",
                          fontSize: 12,
                        }}
                      >
                        {guest.created_by_name || "Unknown member"}
                      </td>
                    )}

                    <td
                      style={{
                        padding: "15px 12px",
                        borderBottom: "1px solid var(--hair)",
                        color: "var(--text2)",
                        fontSize: 12,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {guest.pass_type}
                    </td>

                    {isAdmin && (
                      <td
                        style={{
                          padding: "15px 12px",
                          borderBottom: "1px solid var(--hair)",
                          color: "var(--text)",
                          fontSize: 12,
                          whiteSpace: "nowrap",
                        }}
                      >
                        ₹{getPassPrice(guest.pass_type)}
                      </td>
                    )}

                    <td
                      style={{
                        padding: "15px 12px",
                        borderBottom: "1px solid var(--hair)",
                        color: "var(--text)",
                        fontSize: 12,
                      }}
                    >
                      {getHeads(guest.pass_type)}
                    </td>

                    <td
                      style={{
                        padding: "15px 12px",
                        borderBottom: "1px solid var(--hair)",
                        color: "var(--text3)",
                        fontSize: 11,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatCreatedAt(guest.created_at)}
                    </td>

                    <td
                      style={{
                        padding: "15px 12px",
                        borderBottom: "1px solid var(--hair)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <button
                          className="btn"
                          onClick={() => downloadSubmissionPdf(guest)}
                          disabled={deletingId === guest.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 7,
                          }}
                        >
                          <Icon name="download" size={14} />
                          Download PDF
                        </button>

                        <button
                          className="btn"
                          onClick={() => deleteSubmission(guest)}
                          disabled={deletingId === guest.id}
                          style={{
                            color: "#ff8f8f",
                            borderColor: "rgba(255,100,100,.22)",
                          }}
                        >
                          {deletingId === guest.id ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* HIDDEN FULL-SIZE PASS USED FOR PDF */}

      <div
        style={{
          position: "fixed",
          left: "-10000px",
          top: 0,
          width: 1024,
          height: 1536,
          overflow: "hidden",
          pointerEvents:
            "none",
          opacity: 1,
        }}
      >
        <div ref={passRef}>
          {generatedGuest &&
            passEvent && (
              <PassArtwork
                guest={
                  generatedGuest
                }
                event={
                  passEvent
                }
                qrDataUrl={
                  qrDataUrl
                }
                bgVersion={
                  bgVersion
                }
              />
            )}
        </div>
      </div>
    </div>
  );
}