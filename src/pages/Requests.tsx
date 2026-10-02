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
  issued_price: number | null;
};

type ProfileRow = {
  user_id: string;
  full_name: string | null;
  role: Role;
  member_code: string | null;
};

/* ========================================================= */
/* CHANGE THESE PRICES TO YOUR ACTUAL VYRA PRICES            */
/* ========================================================= */

const PASS_PRICES: Record<string, number> = {
  Regular: 800,
  "Early Bird": 600,
  Couple: 1500,
  "Surge Pass": 1200,
};

/* ========================================================= */

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

function getPassPrice(passType: string): number {
  return PASS_PRICES[passType] ?? 0;
}

function formatMoney(value: number): string {
  return `₹${value.toLocaleString("en-IN")}`;
}

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

  const [profiles, setProfiles] = useState<
    Record<string, ProfileRow>
  >({});

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

  const [expandedMember, setExpandedMember] =
    useState<string | null>(null);

  const pdfRef =
    useRef<HTMLDivElement>(null);

  const readerProfile = (
    userId: string
  ): ProfileRow | undefined => {
    return profiles[userId];
  };

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
        generated_at,
        issued_price
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
      setLoading(false);
      return;
    }

    const loadedRequests =
      (data ?? []) as RequestRow[];

    setRequests(loadedRequests);

    /* ------------------------------------------------------- */
    /* Load profiles for Admin member breakdown                */
    /* ------------------------------------------------------- */

    if (
      role === "admin" &&
      loadedRequests.length > 0
    ) {
      const userIds = [
        ...new Set(
          loadedRequests.map(
            (request) =>
              request.submitted_by
          )
        ),
      ];

      const {
        data: profileData,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select(
          `
          user_id,
          full_name,
          role,
          member_code
          `
        )
        .in("user_id", userIds);

      if (profileError) {
        console.error(
          "Profile loading error:",
          profileError
        );
      } else {
        const profileMap: Record<
          string,
          ProfileRow
        > = {};

        (
          (profileData ??
            []) as ProfileRow[]
        ).forEach((profile) => {
          profileMap[profile.user_id] =
            profile;
        });

        setProfiles(profileMap);
      }
    } else {
      setProfiles({});
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
            guest_name:
              guestName.trim(),
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
      /* ----------------------------------------------------- */
      /* 1. Create guest                                      */
      /* ----------------------------------------------------- */

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

      /* ----------------------------------------------------- */
      /* 2. Generate QR                                       */
      /* ----------------------------------------------------- */

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

      /* ----------------------------------------------------- */
      /* 3. Prepare PDF artwork                              */
      /* ----------------------------------------------------- */

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

      /* ----------------------------------------------------- */
      /* 4. Capture pass                                      */
      /* ----------------------------------------------------- */

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

      /* ----------------------------------------------------- */
      /* 5. Create PDF                                        */
      /* ----------------------------------------------------- */

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

      /* ----------------------------------------------------- */
      /* 6. Upload PDF                                        */
      /* ----------------------------------------------------- */

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

      /* ----------------------------------------------------- */
      /* 7. SAVE ISSUED PRICE                                */
      /* ----------------------------------------------------- */

      const issuedPrice =
        getPassPrice(
          request.pass_type
        );

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
          issued_price:
            issuedPrice,
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
  /* ADMIN STATS                                               */
  /* ========================================================= */

  const generatedRequests =
    requests.filter(
      (request) =>
        request.status === "generated"
    );

  const totalPasses =
    generatedRequests.length;

  const totalMoney =
    generatedRequests.reduce(
      (sum, request) =>
        sum +
        Number(
          request.issued_price ?? 0
        ),
      0
    );

  const memberIds = [
    ...new Set(
      generatedRequests.map(
        (request) =>
          request.submitted_by
      )
    ),
  ];

  const memberStats = memberIds.map(
    (memberId) => {
      const memberRequests =
        generatedRequests.filter(
          (request) =>
            request.submitted_by ===
            memberId
        );

      const profile =
        readerProfile(memberId);

      const money =
        memberRequests.reduce(
          (sum, request) =>
            sum +
            Number(
              request.issued_price ?? 0
            ),
          0
        );

      return {
        memberId,
        name:
          profile?.full_name ||
          "Team Member",
        code:
          profile?.member_code ||
          memberId.slice(0, 8),
        requests:
          memberRequests,
        count:
          memberRequests.length,
        money,
      };
    }
  );

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
            {formatDate(event.date)} ·{" "}
            {formatTime(event.time)} ·{" "}
            {venueText(event.venue)}
          </p>
        </div>
      )}

      {!event && (
        <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-5 text-sm text-yellow-300">
          No event is currently available.
        </div>
      )}

      {/* ===================================================== */}
      {/* ADMIN SALES / ISSUANCE                               */}
      {/* ===================================================== */}

      {role === "admin" && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">

          <div className="mb-6">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Admin Only
            </p>

            <h2 className="mt-2 text-xl font-semibold text-white">
              Pass Issuance & Collection
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Track passes generated by each team member and total money collected.
            </p>
          </div>

          {/* TOTAL CARDS */}

          <div className="grid gap-4 md:grid-cols-2">

            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <p className="text-xs uppercase tracking-wider text-slate-500">
                Total Passes Issued
              </p>

              <p className="mt-3 text-4xl font-semibold text-white">
                {totalPasses}
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Successfully generated passes
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <p className="text-xs uppercase tracking-wider text-slate-500">
                Total Money Collected
              </p>

              <p className="mt-3 text-4xl font-semibold text-green-300">
                {formatMoney(totalMoney)}
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Based on generated passes
              </p>
            </div>

          </div>

          {/* MEMBER BREAKDOWN */}

          <div className="mt-6">

            <div className="mb-3">
              <h3 className="text-base font-semibold text-white">
                Member Breakdown
              </h3>

              <p className="mt-1 text-xs text-slate-500">
                Click a member to view their issued passes.
              </p>
            </div>

            {memberStats.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 py-8 text-center text-sm text-slate-500">
                No passes have been issued yet.
              </div>
            ) : (
              <div className="space-y-3">

                {memberStats.map(
                  (member) => {
                    const expanded =
                      expandedMember ===
                      member.memberId;

                    return (
                      <div
                        key={member.memberId}
                        className="overflow-hidden rounded-xl border border-white/10 bg-black/20"
                      >

                        <button
                          type="button"
                          onClick={() =>
                            setExpandedMember(
                              expanded
                                ? null
                                : member.memberId
                            )
                          }
                          className="w-full p-4 text-left hover:bg-white/[0.03]"
                        >

                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

                            <div>
                              <p className="font-medium text-white">
                                {member.name}
                              </p>

                              <p className="mt-1 text-xs text-slate-500">
                                {member.code}
                              </p>
                            </div>

                            <div className="flex items-center gap-8">

                              <div>
                                <p className="text-xs text-slate-500">
                                  PASSES
                                </p>

                                <p className="mt-1 text-lg font-semibold text-white">
                                  {member.count}
                                </p>
                              </div>

                              <div>
                                <p className="text-xs text-slate-500">
                                  COLLECTED
                                </p>

                                <p className="mt-1 text-lg font-semibold text-green-300">
                                  {formatMoney(
                                    member.money
                                  )}
                                </p>
                              </div>

                              <div className="text-slate-500">
                                {expanded
                                  ? "▲"
                                  : "▼"}
                              </div>

                            </div>

                          </div>
                        </button>

                        {/* MEMBER DETAILS */}

                        {expanded && (
                          <div className="border-t border-white/10 p-4">

                            <div className="mb-3 flex items-center justify-between">

                              <div>
                                <p className="text-sm font-semibold text-white">
                                  Issued Passes
                                </p>

                                <p className="text-xs text-slate-500">
                                  {member.count} passes ·{" "}
                                  {formatMoney(
                                    member.money
                                  )}
                                </p>
                              </div>

                            </div>

                            <div className="space-y-2">

                              {member.requests.map(
                                (request) => (
                                  <div
                                    key={request.id}
                                    className="rounded-xl border border-white/5 bg-white/[0.02] p-3"
                                  >

                                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">

                                      <div>
                                        <p className="text-sm font-medium text-white">
                                          {request.guest_name}
                                        </p>

                                        <p className="mt-1 text-xs text-slate-500">
                                          {request.pass_type}
                                          {request.phone
                                            ? ` · ${request.phone}`
                                            : ""}
                                        </p>

                                        {request.guest_id && (
                                          <p className="mt-1 text-[10px] font-mono text-slate-600">
                                            Guest ID:{" "}
                                            {request.guest_id}
                                          </p>
                                        )}
                                      </div>

                                      <div className="text-left md:text-right">

                                        <p className="text-sm font-semibold text-green-300">
                                          {formatMoney(
                                            Number(
                                              request.issued_price ??
                                                getPassPrice(
                                                  request.pass_type
                                                )
                                            )
                                          )}
                                        </p>

                                        <p className="mt-1 text-[10px] text-slate-600">
                                          {request.generated_at
                                            ? new Date(
                                                request.generated_at
                                              ).toLocaleString()
                                            : ""}
                                        </p>

                                      </div>

                                    </div>

                                  </div>
                                )
                              )}

                            </div>

                          </div>
                        )}

                      </div>
                    );
                  }
                )}

                {/* GRAND TOTAL */}

                <div className="mt-4 rounded-xl border border-white/15 bg-white/[0.05] p-5">

                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

                    <div>
                      <p className="text-xs uppercase tracking-wider text-slate-500">
                        Grand Total
                      </p>

                      <p className="mt-1 text-lg font-semibold text-white">
                        All Team Members
                      </p>
                    </div>

                    <div className="flex gap-10">

                      <div>
                        <p className="text-xs text-slate-500">
                          PASSES
                        </p>

                        <p className="mt-1 text-2xl font-semibold text-white">
                          {totalPasses}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500">
                          MONEY
                        </p>

                        <p className="mt-1 text-2xl font-semibold text-green-300">
                          {formatMoney(
                            totalMoney
                          )}
                        </p>
                      </div>

                    </div>

                  </div>

                </div>

              </div>
            )}

          </div>

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
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-slate-600"
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

                      {role === "admin" && (
                        <p className="mt-1 text-xs text-slate-600">
                          Submitted by:{" "}
                          {readerProfile(
                            request.submitted_by
                          )?.full_name ||
                            readerProfile(
                              request.submitted_by
                            )?.member_code ||
                            request.submitted_by.slice(
                              0,
                              8
                            )}
                        </p>
                      )}

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
                      <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">

                        <p className="text-xs text-green-400">
                          Pass generated and delivered to the submitting member.
                        </p>

                        <p className="text-xs font-semibold text-slate-300">
                          {formatMoney(
                            Number(
                              request.issued_price ??
                                getPassPrice(
                                  request.pass_type
                                )
                            )
                          )}
                        </p>

                      </div>
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