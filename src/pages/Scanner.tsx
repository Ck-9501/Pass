import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import toast from "react-hot-toast";

import { supabase, EventRow } from "../lib/supabase";

interface ScannerProps {
  ev: EventRow;
}

type ScanResult = "valid" | "already" | "revoked" | "invalid" | null;

interface GuestRow {
  id: string;
  event_id: string;
  name: string;
  pass_id: string;
  qr_token: string;
  status: "valid" | "checked_in" | "revoked";
  checked_in_at: string | null;
}

interface ScanRecord {
  id: number;
  result: Exclude<ScanResult, null>;
  name: string;
  passId: string;
  time: string;
}

function extractToken(value: string): string {
  const raw = value.trim();

  if (!raw) return "";

  // QR can contain:
  // https://pass-navy-two.vercel.app/verify/TOKEN
  // OR just TOKEN
  try {
    const url = new URL(raw);
    const parts = url.pathname.split("/").filter(Boolean);

    if (parts.length > 0) {
      return decodeURIComponent(parts[parts.length - 1]).trim();
    }
  } catch {
    // Not a URL, so use the raw value.
  }

  return raw;
}

function resultLabel(result: ScanResult): string {
  switch (result) {
    case "valid":
      return "VALID — ENTRY APPROVED";
    case "already":
      return "ALREADY CHECKED IN";
    case "revoked":
      return "PASS REVOKED";
    case "invalid":
      return "INVALID PASS";
    default:
      return "";
  }
}

export default function Scanner({ ev }: ScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const runningRef = useRef(false);
  const processingRef = useRef(false);
  const lastTokenRef = useRef("");

  const [running, setRunning] = useState(false);
  const [manual, setManual] = useState("");
  const [result, setResult] = useState<ScanResult>(null);
  const [resultName, setResultName] = useState("");
  const [resultPassId, setResultPassId] = useState("");
  const [error, setError] = useState("");
  const [records, setRecords] = useState<ScanRecord[]>([]);

  const readerId = "partypass-qr-reader";

  useEffect(() => {
    return () => {
      const scanner = scannerRef.current;

      if (!scanner) return;

      if (runningRef.current) {
        scanner
          .stop()
          .catch(() => {})
          .finally(() => {
            try {
              scanner.clear();
            } catch {}
          });
      } else {
        try {
          scanner.clear();
        } catch {}
      }
    };
  }, []);

  function addRecord(
    scanResult: Exclude<ScanResult, null>,
    name = "",
    passId = ""
  ) {
    const record: ScanRecord = {
      id: Date.now(),
      result: scanResult,
      name,
      passId,
      time: new Date().toLocaleTimeString(),
    };

    setRecords((old) => [record, ...old].slice(0, 10));
  }

  async function processValue(value: string) {
    if (processingRef.current) return;

    const token = extractToken(value);

    if (!token) {
      setResult("invalid");
      setError("QR code does not contain a valid token.");
      return;
    }

    if (lastTokenRef.current === token) {
      return;
    }

    processingRef.current = true;
    lastTokenRef.current = token;

    setError("");
    setResult(null);
    setResultName("");
    setResultPassId("");

    try {
      /*
       * STEP 1
       * Find the guest ONLY by QR token.
       *
       * IMPORTANT:
       * We do NOT compare the token against the currently selected event.
       * A genuine QR should not become "invalid" because the scanner
       * happened to have another event selected.
       */

      const { data: guest, error: lookupError } = await supabase
        .from("guests")
        .select(
          "id,event_id,name,pass_id,qr_token,status,checked_in_at"
        )
        .eq("qr_token", token)
        .maybeSingle();

      if (lookupError) {
        console.error("Guest lookup error:", lookupError);
        throw new Error(
          `Supabase lookup failed: ${lookupError.message}`
        );
      }

      /*
       * No matching token = fake/invalid QR.
       */
      if (!guest) {
        setResult("invalid");
        setError(
          "This QR token was not found in the Supabase guest list."
        );

        addRecord("invalid");

        toast.error("Invalid pass.");

        window.setTimeout(() => {
          lastTokenRef.current = "";
        }, 1800);

        return;
      }

      const typedGuest = guest as GuestRow;

      /*
       * STEP 2
       * Check current status.
       */

      if (typedGuest.status === "revoked") {
        setResult("revoked");
        setResultName(typedGuest.name || "");
        setResultPassId(typedGuest.pass_id || "");

        addRecord(
          "revoked",
          typedGuest.name,
          typedGuest.pass_id
        );

        setError("This pass has been revoked.");
        toast.error("Pass revoked.");

        window.setTimeout(() => {
          lastTokenRef.current = "";
        }, 1800);

        return;
      }

      if (typedGuest.status === "checked_in") {
        setResult("already");
        setResultName(typedGuest.name || "");
        setResultPassId(typedGuest.pass_id || "");

        addRecord(
          "already",
          typedGuest.name,
          typedGuest.pass_id
        );

        setError(
          typedGuest.checked_in_at
            ? `Checked in at ${new Date(
                typedGuest.checked_in_at
              ).toLocaleTimeString()}`
            : "This pass has already been used."
        );

        toast.error("Already checked in.");

        window.setTimeout(() => {
          lastTokenRef.current = "";
        }, 1800);

        return;
      }

      /*
       * STEP 3
       * It is a valid unused pass.
       *
       * Change:
       * valid -> checked_in
       */

      const { error: updateError } = await supabase
        .from("guests")
        .update({
          status: "checked_in",
          checked_in_at: new Date().toISOString(),
        })
        .eq("id", typedGuest.id)
        .eq("qr_token", token)
        .eq("status", "valid");

      if (updateError) {
        console.error("Guest update error:", updateError);

        throw new Error(
          `Could not check in guest: ${updateError.message}`
        );
      }

      /*
       * STEP 4
       * Read the row again to confirm that the database actually changed.
       */

      const { data: verifiedGuest, error: verifyError } =
        await supabase
          .from("guests")
          .select(
            "id,event_id,name,pass_id,qr_token,status,checked_in_at"
          )
          .eq("id", typedGuest.id)
          .maybeSingle();

      if (verifyError) {
        console.error("Verification lookup error:", verifyError);
        throw new Error(
          `Check-in succeeded but verification failed: ${verifyError.message}`
        );
      }

      if (!verifiedGuest) {
        throw new Error(
          "Guest was found initially, but could not be read after check-in."
        );
      }

      const finalGuest = verifiedGuest as GuestRow;

      /*
       * STEP 5
       * Final result.
       */

      if (finalGuest.status === "checked_in") {
        setResult("valid");
        setResultName(finalGuest.name || "");
        setResultPassId(finalGuest.pass_id || "");

        addRecord(
          "valid",
          finalGuest.name,
          finalGuest.pass_id
        );

        setError("");
        toast.success("ENTRY APPROVED");

        window.setTimeout(() => {
          lastTokenRef.current = "";
        }, 1800);

        return;
      }

      if (finalGuest.status === "revoked") {
        setResult("revoked");
        setResultName(finalGuest.name || "");
        setResultPassId(finalGuest.pass_id || "");

        addRecord(
          "revoked",
          finalGuest.name,
          finalGuest.pass_id
        );

        setError("This pass has been revoked.");
        toast.error("Pass revoked.");

        window.setTimeout(() => {
          lastTokenRef.current = "";
        }, 1800);

        return;
      }

      setResult("invalid");
      setError(
        `Unexpected pass status: ${finalGuest.status}`
      );

      addRecord(
        "invalid",
        finalGuest.name,
        finalGuest.pass_id
      );

      window.setTimeout(() => {
        lastTokenRef.current = "";
      }, 1800);
    } catch (err) {
      console.error("Scanner error:", err);

      setResult("invalid");
      setError(
        err instanceof Error
          ? err.message
          : "Unable to validate this pass."
      );

      addRecord("invalid");

      toast.error("Scanner validation failed.");

      window.setTimeout(() => {
        lastTokenRef.current = "";
      }, 1800);
    } finally {
      processingRef.current = false;
    }
  }

  async function startScanner() {
    setError("");
    setResult(null);

    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(readerId);
      }

      if (runningRef.current) return;

      await scannerRef.current.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: {
            width: 260,
            height: 260,
          },
          aspectRatio: 1,
          disableFlip: false,
        },
        async (decodedText) => {
          await processValue(decodedText);
        },
        () => {
          // Normal QR frame miss — ignore.
        }
      );

      runningRef.current = true;
      setRunning(true);
    } catch (err) {
      console.error("Camera start error:", err);

      runningRef.current = false;
      setRunning(false);

      setError(
        err instanceof Error
          ? err.message
          : "Could not start the camera."
      );
    }
  }

  async function stopScanner() {
    const scanner = scannerRef.current;

    if (!scanner) return;

    try {
      if (runningRef.current) {
        await scanner.stop();
      }
    } catch (err) {
      console.warn("Scanner stop warning:", err);
    }

    runningRef.current = false;
    setRunning(false);

    try {
      scanner.clear();
    } catch {}
  }

  async function manualCheck() {
    const value = manual.trim();

    if (!value) {
      setError("Enter a QR URL or token.");
      return;
    }

    await processValue(value);
  }

  const resultColor =
    result === "valid"
      ? "#86efac"
      : result === "already"
        ? "#fcd34d"
        : "#fca5a5";

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div
        style={{
          marginBottom: 20,
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: "var(--text3)",
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          VYRA ENTRY CONTROL
        </div>

        <h1
          style={{
            margin: "7px 0 0",
            fontSize: 30,
            fontWeight: 800,
          }}
        >
          Scan Guest Pass
        </h1>

        <div
          style={{
            marginTop: 7,
            fontSize: 13,
            color: "var(--text2)",
          }}
        >
          {ev?.name || "Event"}{" "}
          {ev?.date ? `• ${ev.date}` : ""}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "minmax(320px, 1fr) minmax(320px, 1fr)",
          gap: 20,
        }}
      >
        {/* CAMERA */}

        <div
          className="card"
          style={{
            padding: 20,
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "var(--text3)",
              letterSpacing: 1.5,
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            Camera Scanner
          </div>

          <div
            id={readerId}
            style={{
              width: "100%",
              minHeight: 320,
              borderRadius: 16,
              overflow: "hidden",
              background: "#000",
            }}
          />

          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 14,
            }}
          >
            {!running ? (
              <button
                className="btn"
                onClick={startScanner}
                style={{
                  width: "100%",
                }}
              >
                START CAMERA
              </button>
            ) : (
              <button
                className="btn"
                onClick={stopScanner}
                style={{
                  width: "100%",
                }}
              >
                STOP CAMERA
              </button>
            )}
          </div>
        </div>

        {/* RESULT */}

        <div
          className="card"
          style={{
            padding: 20,
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "var(--text3)",
              letterSpacing: 1.5,
              textTransform: "uppercase",
            }}
          >
            Latest Scan
          </div>

          <div
            style={{
              marginTop: 15,
              minHeight: 180,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              textAlign: "center",
              borderRadius: 18,
              border:
                result === "valid"
                  ? "1px solid rgba(34,197,94,.35)"
                  : result === "revoked" ||
                      result === "invalid"
                    ? "1px solid rgba(239,68,68,.35)"
                    : "1px solid rgba(255,255,255,.08)",
              background:
                result === "valid"
                  ? "rgba(34,197,94,.07)"
                  : result === "revoked" ||
                      result === "invalid"
                    ? "rgba(239,68,68,.07)"
                    : "rgba(255,255,255,.025)",
              padding: 20,
              boxSizing: "border-box",
            }}
          >
            {!result && (
              <>
                <div
                  style={{
                    fontSize: 15,
                    color: "var(--text2)",
                  }}
                >
                  Waiting for QR...
                </div>

                <div
                  style={{
                    marginTop: 7,
                    fontSize: 12,
                    color: "var(--text3)",
                  }}
                >
                  Scan a VYRA guest pass
                </div>
              </>
            )}

            {result && (
              <>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: resultColor,
                  }}
                >
                  {resultLabel(result)}
                </div>

                {resultName && (
                  <div
                    style={{
                      marginTop: 12,
                      fontFamily: "Georgia, serif",
                      fontSize: 24,
                      fontWeight: 700,
                    }}
                  >
                    {resultName}
                  </div>
                )}

                {resultPassId && (
                  <div
                    style={{
                      marginTop: 7,
                      fontFamily: "monospace",
                      fontSize: 12,
                      color: "var(--text3)",
                    }}
                  >
                    {resultPassId}
                  </div>
                )}
              </>
            )}
          </div>

          {error && (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 10,
                background: "rgba(239,68,68,.08)",
                border: "1px solid rgba(239,68,68,.22)",
                color: "#fca5a5",
                fontSize: 12,
                wordBreak: "break-word",
              }}
            >
              {error}
            </div>
          )}

          {/* MANUAL */}

          <div
            style={{
              marginTop: 20,
              paddingTop: 18,
              borderTop:
                "1px solid rgba(255,255,255,.08)",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              Manual Validation
            </div>

            <input
              value={manual}
              onChange={(e) =>
                setManual(e.target.value)
              }
              placeholder="Paste QR URL or token"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "12px 13px",
                borderRadius: 10,
                border: "1px solid var(--hair)",
                background: "var(--panel2)",
                color: "var(--text)",
                outline: "none",
              }}
            />

            <button
              className="btn"
              onClick={manualCheck}
              style={{
                width: "100%",
                marginTop: 9,
              }}
            >
              VALIDATE
            </button>
          </div>
        </div>
      </div>

      {/* RECENT SCANS */}

      <div
        className="card"
        style={{
          marginTop: 20,
          padding: 20,
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            marginBottom: 15,
          }}
        >
          Recent Scans
        </div>

        {records.length === 0 ? (
          <div
            style={{
              padding: 25,
              textAlign: "center",
              color: "var(--text3)",
              fontSize: 12,
            }}
          >
            No scans yet.
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 9,
            }}
          >
            {records.map((record) => (
              <div
                key={record.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 13px",
                  borderRadius: 10,
                  border: "1px solid var(--hair)",
                  background:
                    "rgba(255,255,255,.02)",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    {record.name || "Unknown guest"}
                  </div>

                  {record.passId && (
                    <div
                      style={{
                        marginTop: 3,
                        fontSize: 11,
                        fontFamily: "monospace",
                        color: "var(--text3)",
                      }}
                    >
                      {record.passId}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    textAlign: "right",
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: 1,
                      color:
                        record.result === "valid"
                          ? "#86efac"
                          : record.result === "already"
                            ? "#fcd34d"
                            : "#fca5a5",
                    }}
                  >
                    {record.result.toUpperCase()}
                  </div>

                  <div
                    style={{
                      marginTop: 3,
                      fontSize: 10,
                      color: "var(--text3)",
                    }}
                  >
                    {record.time}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}