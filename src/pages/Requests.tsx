import {
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

import {
  supabase,
  type EventRow,
} from "../lib/supabase";
import {
  generateQr,
  newPassId,
  newToken,
} from "../lib/pass";
import {
  PassArtwork,
  waitForImages,
  waitForPass,
} from "./CreatePass";

type Role = "member" | "admin";

type RequestRow = {
  id: string;
  event_id: string;
  guest_name: string;
  phone: string | null;
  pass_type: string;
  notes: string | null;
  status: "pending" | "generated" | "rejected";
  created_at: string;
  submitted_by: string;
  guest_id: string | null;
  pdf_path: string | null;
  generated_at: string | null;
};

const PASS_TYPES = [
  "Regular",
  "Early Bird",
  "Couple",
  "Surge Pass",
];

const sleep = (ms: number) =>
  new Promise<void>((resolve) =>
    setTimeout(resolve, ms)
  );

function formatDate(date: string | null) {
  if (!date) return "TBA";

  const parts = date.split("-");

  if (parts.length !== 3) return date;

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

  return `${day} ${
    months[Number(month) - 1] || month
  } ${year}`;
}

function formatTime(time: string | null) {
  if (!time) return "TBA";

  const parts = time.split(":");

  if (parts.length < 2) return time;

  let hour = Number(parts[0]);

  if (Number.isNaN(hour)) return time;

  const minute = parts[1];
  const suffix = hour >= 12 ? "PM" : "AM";

  hour = hour % 12 || 12;

  return `${hour}:${minute} ${suffix}`;
}

function venueText(venue: string | null) {
  return venue?.trim() || "VENUE TBA";
}

export default function Requests({
  role,
  event,
}: {
  role: Role;
  event: EventRow | null;
}) {
  const [requests, setRequests] = useState<RequestRow[]>(
    []
  );

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [generatingId, setGeneratingId] =
    useState<string | null>(null);

  const [guestName, setGuestName] = useState("");
  const [phone, setPhone] = useState("");
  const [passType, setPassType] =
    useState("Regular");
  const [notes, setNotes] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [pdfGuest, setPdfGuest] =
    useState<any>(null);

  const [pdfQr, setPdfQr] = useState("");
  const [pdfEvent, setPdfEvent] =
    useState<EventRow | null>(null);

  const [pdfVersion, setPdfVersion] =
    useState(() => Date.now());

  const pdfRef =
    useRef<HTMLDivElement>(null);

  /* ========================================================= */
  /* LOAD REQUESTS                                             */
  /* ========================================================= */

  const loadRequests = async () => {
    if (!event?.id) {
      setRequests([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    let query = supabase
      .from("guest_requests")
      .select(
        `
        id,
        event_id,
        guest_name,
        phone,
        pass_type,
        notes,
        status,
        created_at,
        submitted_by,
        guest_id,
        pdf_path,
        generated_at
        `
      )
      .eq("event_id", event.id)
      .order("created_at", {
        ascending: false,
      });

    if (role === "member") {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setRequests([]);
        setLoading(false);
        return;
      }

      query = query.eq(
        "submitted_by",
        user.id
      );
    }

    const {
      data,
      error: fetchError,
    } = await query;

    if (fetchError) {
      console.error(fetchError);
      setError(fetchError.message);
      setRequests([]);
    } else {
      setRequests(
        (data ?? []) as RequestRow[]
      );
    }

    setLoading(false);
  };

  useEffect(() => {
    loadRequests();
  }, [event?.id, role]);

  /* ========================================================= */
  /* MEMBER SUBMIT                                             */
  /* ========================================================= */

  const submitRequest = async (
    e: FormEvent
  ) => {
    e.preventDefault();

    setMessage("");
    setError("");

    if (!event?.id) {
      setError(
        "No event is currently selected."
      );
      return;
    }

    if (!guestName.trim()) {
      setError(
        "Guest name is required."
      );
      return;
    }

    setSubmitting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error(
          "You are not logged in."
        );
      }

      const { error: insertError } =
        await supabase
          .from("guest_requests")
          .insert({
            event_id: event.id,
            submitted_by: user.id,
            guest_name: guestName.trim(),
            phone:
              phone.trim() || null,
            pass_type: passType,
            notes:
              notes.trim() || null,
            status: "pending",
          });

      if (insertError) {
        throw new Error(
          insertError.message
        );
      }

      setGuestName("");
      setPhone("");
      setPassType("Regular");
      setNotes("");

      setMessage(
        "Guest request submitted successfully."
      );

      await loadRequests();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to submit guest request."
      );
    } finally {
      setSubmitting(false);
    }
  };

  /* ========================================================= */
  /* GENERATE PDF                                              */
  /* ========================================================= */

  const generatePassForRequest = async (
    request: RequestRow
  ) => {
    if (!event?.id) return;

    setError("");
    setMessage("");
    setGeneratingId(request.id);

    try {
      /*
       * 1. Create the guest using the SAME
       *    ID/token system as CreatePass.
       */

      const passId = newPassId();
      const token = newToken();

      const {
        data: guest,
        error: guestError,
      } = await supabase
        .from("guests")
        .insert({
          event_id: event.id,
          name: request.guest_name,
          phone: request.phone,
          pass_type: request.pass_type,
          pass_id: passId,
          qr_token: token,
          status: "valid",
          notes: request.notes,
        })
        .select("*")
        .single();

      if (guestError) {
        throw new Error(
          guestError.message
        );
      }

      if (!guest) {
        throw new Error(
          "Guest was not created."
        );
      }

      /*
       * 2. Generate QR from EXACT database token.
       */

      const qr = await generateQr(
        guest.qr_token
      );

      if (
        !qr ||
        !qr.startsWith("data:image/")
      ) {
        throw new Error(
          "QR code generation failed."
        );
      }

      /*
       * 3. Put the exact same PassArtwork
       *    used by CreatePass into hidden DOM.
       */

      setPdfVersion(Date.now());
      setPdfGuest(guest);
      setPdfQr(qr);
      setPdfEvent(event);

      await sleep(300);

      for (
        let i = 0;
        i < 60 && !pdfRef.current;
        i++
      ) {
        await sleep(50);
      }

      const element = pdfRef.current;

      if (!element) {
        throw new Error(
          "PDF artwork could not be prepared."
        );
      }

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

      const qrImage =
        element.querySelector(
          'img[data-pass-qr="1"]'
        ) as HTMLImageElement | null;

      if (!qrImage) {
        throw new Error(
          "QR image was not found."
        );
      }

      await waitForImages(element);

      if (
        !qrImage.complete ||
        qrImage.naturalWidth === 0
      ) {
        throw new Error(
          "QR image failed to load."
        );
      }

      await sleep(300);

      /*
       * 4. Capture complete pass.
       */

      const canvas =
        await html2canvas(element, {
          width: 1024,
          height: 1536,
          scale: 2,
          useCORS: true,
          allowTaint: false,
          backgroundColor: "#050810",
          logging: false,
        });

      const image =
        canvas.toDataURL(
          "image/jpeg",
          0.96
        );

      /*
       * 5. Create PDF.
       */

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: [288, 432],
        compress: true,
      });

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

      const blob =
        pdf.output("blob");

      /*
       * 6. Upload PDF to private
       *    Supabase Storage.
       */

      const pdfPath =
        `${event.id}/${request.id}/${guest.pass_id}.pdf`;

      const {
        error: uploadError,
      } = await supabase.storage
        .from("passes")
        .upload(
          pdfPath,
          blob,
          {
            contentType:
              "application/pdf",
            upsert: true,
          }
        );

      if (uploadError) {
        throw new Error(
          `PDF upload failed: ${uploadError.message}`
        );
      }

      /*
       * 7. Mark request as generated.
       */

      const {
        error: updateError,
      } = await supabase
        .from("guest_requests")
        .update({
          status: "generated",
          guest_id: guest.id,
          pdf_path: pdfPath,
          generated_at:
            new Date().toISOString(),
        })
        .eq("id", request.id);

      if (updateError) {
        throw new Error(
          updateError.message
        );
      }

      setMessage(
        `Pass generated successfully for ${request.guest_name}.`
      );

      setPdfGuest(null);
      setPdfQr("");
      setPdfEvent(null);

      await loadRequests();
    } catch (err) {
      console.error(
        "Request generation error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to generate pass."
      );
    } finally {
      setGeneratingId(null);
    }
  };

  /* ========================================================= */
  /* MEMBER DOWNLOAD                                           */
  /* ========================================================= */

  const downloadGeneratedPass = async (
    request: RequestRow
  ) => {
    if (!request.pdf_path) {
      setError(
        "PDF is not available yet."
      );
      return;
    }

    try {
      setError("");

      const {
        data,
        error: signedError,
      } = await supabase.storage
        .from("passes")
        .createSignedUrl(
          request.pdf_path,
          300
        );

      if (signedError) {
        throw new Error(
          signedError.message
        );
      }

      if (!data?.signedUrl) {
        throw new Error(
          "Could not create PDF link."
        );
      }

      window.open(
        data.signedUrl,
        "_blank"
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not download PDF."
      );
    }
  };

  /* ========================================================= */
  /* UI                                                        */
  /* ========================================================= */

  return (
    <div className="space-y-6">

      {/* HEADER */}

      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
          VYRA Entertainment
        </p>

        <h1 className="mt-2 text-3xl font-semibold text-white">
          {role === "admin"
            ? "Guest Requests"
            : "My Requests"}
        </h1>

        <p className="mt-2 text-sm text-slate-400">
          {role === "admin"
            ? "Review guest submissions from your team."
            : "Submit guest details for pass generation."}
        </p>
      </div>

      {/* EVENT */}

      {event && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Current Event
          </p>

          <p className="mt-2 text-lg font-medium text-white">
            {event.name}
          </p>

          <p className="mt-1 text-sm text-slate-400">
            {event.date} · {event.time} ·{" "}
            {event.venue}
          </p>
        </div>
      )}

      {!event && (
        <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-5 text-sm text-yellow-300">
          No event is currently available.
        </div>
      )}

      {/* MEMBER FORM */}

      {role === "member" && (
        <form
          onSubmit={submitRequest}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
        >
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white">
              Submit Guest
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Your request will be sent to the admin for pass generation.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Guest Name *
              </label>

              <input
                value={guestName}
                onChange={(e) =>
                  setGuestName(
                    e.target.value
                  )
                }
                placeholder="Enter guest name"
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-white/30"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Phone
              </label>

              <input
                value={phone}
                onChange={(e) =>
                  setPhone(
                    e.target.value
                  )
                }
                placeholder="Enter phone number"
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-white/30"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Pass Type
              </label>

              <select
                value={passType}
                onChange={(e) =>
                  setPassType(
                    e.target.value
                  )
                }
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none"
              >
                {PASS_TYPES.map(
                  (type) => (
                    <option
                      key={type}
                      value={type}
                      className="bg-black"
                    >
                      {type}
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Notes
              </label>

              <input
                value={notes}
                onChange={(e) =>
                  setNotes(
                    e.target.value
                  )
                }
                placeholder="Optional note"
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-white/30"
              />
            </div>
          </div>

          {error && (
            <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {message && (
            <div className="mt-5 rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-300">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={
              submitting || !event
            }
            className="mt-6 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting
              ? "Submitting..."
              : "Submit Guest"}
          </button>
        </form>
      )}

      {/* GLOBAL MESSAGE */}

      {role === "admin" &&
        (error || message) && (
          <div>
            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            {message && (
              <div className="rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-300">
                {message}
              </div>
            )}
          </div>
        )}

      {/* REQUEST LIST */}

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">

        <div className="mb-5">
          <h2 className="text-lg font-semibold text-white">
            {role === "admin"
              ? "All Team Requests"
              : "Your Submissions"}
          </h2>

          <p className="mt-1 text-sm text-slate-400">
            {requests.length} request
            {requests.length === 1
              ? ""
              : "s"}
          </p>
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-slate-500">
            Loading requests...
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 py-10 text-center">
            <p className="text-sm text-slate-400">
              No guest requests yet.
            </p>
          </div>
        ) : (
          <div className="space-y-3">

            {requests.map(
              (request) => (
                <div
                  key={request.id}
                  className="rounded-xl border border-white/10 bg-black/20 p-4"
                >

                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

                    <div>
                      <p className="font-medium text-white">
                        {request.guest_name}
                      </p>

                      <p className="mt-1 text-sm text-slate-400">
                        {request.pass_type}
                        {request.phone
                          ? ` · ${request.phone}`
                          : ""}
                      </p>

                      <p className="mt-1 text-xs text-slate-600">
                        {new Date(
                          request.created_at
                        ).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">

                      <span
                        className={`w-fit rounded-full border px-3 py-1 text-xs font-medium ${
                          request.status ===
                          "generated"
                            ? "border-green-500/20 bg-green-500/10 text-green-300"
                            : request.status ===
                              "rejected"
                            ? "border-red-500/20 bg-red-500/10 text-red-300"
                            : "border-yellow-500/20 bg-yellow-500/10 text-yellow-300"
                        }`}
                      >
                        {request.status}
                      </span>

                      {/* ADMIN GENERATE */}

                      {role === "admin" &&
                        request.status ===
                          "pending" && (
                          <button
                            onClick={() =>
                              generatePassForRequest(
                                request
                              )
                            }
                            disabled={
                              generatingId ===
                              request.id
                            }
                            className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-slate-200 disabled:opacity-50"
                          >
                            {generatingId ===
                            request.id
                              ? "Generating..."
                              : "Generate"}
                          </button>
                        )}

                      {/* MEMBER DOWNLOAD */}

                      {role === "member" &&
                        request.status ===
                          "generated" &&
                        request.pdf_path && (
                          <button
                            onClick={() =>
                              downloadGeneratedPass(
                                request
                              )
                            }
                            className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-slate-200"
                          >
                            Download PDF
                          </button>
                        )}
                    </div>
                  </div>

                  {request.notes && (
                    <p className="mt-3 border-t border-white/5 pt-3 text-sm text-slate-500">
                      Note: {request.notes}
                    </p>
                  )}

                  {role === "admin" &&
                    request.status ===
                      "generated" && (
                      <p className="mt-3 text-xs text-green-400">
                        Pass generated and delivered to the submitting member.
                      </p>
                    )}
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* ===================================================== */}
      {/* HIDDEN PASS USED FOR PDF                              */}
      {/* ===================================================== */}

      <div
        style={{
          position: "fixed",
          left: "-10000px",
          top: 0,
          width: 1024,
          height: 1536,
          overflow: "hidden",
          pointerEvents: "none",
          opacity: 1,
        }}
      >
        <div ref={pdfRef}>
          {pdfGuest &&
            pdfEvent && (
              <PassArtwork
                guest={pdfGuest}
                event={pdfEvent}
                qrDataUrl={pdfQr}
                bgVersion={pdfVersion}
              />
            )}
        </div>
      </div>
    </div>
  );
}