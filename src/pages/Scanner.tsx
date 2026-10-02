import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import toast from "react-hot-toast";

import { supabase, EventRow } from "../lib/supabase";

interface ScannerProps {
  ev: EventRow;
}

type ScanResult = "valid" | "already" | "revoked" | "invalid" | null;

interface CheckInResponse {
  success?: boolean;
  result?: "valid" | "already" | "revoked" | "invalid" | "unauthorized";
  message?: string;
  guest_name?: string;
  pass_id?: string;
  pass_type?: string;

  // Supports the current database response.
  status?: string;
  checked_in_at?: string | null;
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

  try {
    const url = new URL(raw);
    const parts = url.pathname.split("/").filter(Boolean);

    if (parts.length > 0) {
      return decodeURIComponent(parts[parts.length - 1]).trim();
    }
  } catch {
    // Not a URL. Use the raw value.
  }

  return raw;
}

function resultLabel(result: ScanResult): string {
  switch (result) {
    case "valid":
      return "✓ CHECK-IN SUCCESSFUL";
    case "already":
      return "⚠ ALREADY CHECKED IN";
    case "revoked":
      return "✕ PASS REVOKED";
    case "invalid":
      return "✕ INVALID QR / PASS ID";
    default:
      return "";
  }
}

function cameraErrorMessage(err: unknown): string {
  const name =
    err && typeof err === "object" && "name" in err
      ? String((err as { name: unknown }).name)
      : "";

  const text = err instanceof Error ? err.message : String(err ?? "");

  if (
    name === "NotAllowedError" ||
    /permission|denied|notallowed/i.test(text)
  ) {
    return "Camera permission was denied. Allow camera access in your browser settings, or use Enter Pass ID below.";
  }

  if (
    name === "NotFoundError" ||
    /no camera|not found|requested device/i.test(text)
  ) {
    return "No camera was found on this device. Use Enter Pass ID below.";
  }

  if (
    name === "NotReadableError" ||
    /not readable|in use/i.test(text)
  ) {
    return "The camera is being used by another app. Close it and try again.";
  }

  return text || "Could not start the camera. Use Enter Pass ID below.";
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
  const [resultPassType, setResultPassType] = useState("");
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

  function releaseToken() {
    window.setTimeout(() => {
      lastTokenRef.current = "";
    }, 1800);
  }

  async function processValue(value: string) {
    if (processingRef.current) return;

    const token = extractToken(value);

    if (!token) {
      setResult("invalid");
      setError("Invalid QR / Pass ID.");
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
    setResultPassType("");

    try {
      const { data, error: rpcError } = await supabase.rpc("pp_check_in", {
        p_token: token,
      });

      if (rpcError) {
        console.error("pp_check_in RPC error:", rpcError);
        throw new Error(`Could not check in guest: ${rpcError.message}`);
      }

      const res = data as CheckInResponse | null;

      if (!res || typeof res !== "object") {
        throw new Error("Unexpected response from the check-in service.");
      }

      const name = res.guest_name || "";
      const passId = res.pass_id || "";
      const passType = res.pass_type || "";

      setResultName(name);
      setResultPassId(passId);
      setResultPassType(passType);

      /*
       * IMPORTANT:
       *
       * Your current database can return:
       *
       * status: "CHECKED_IN"
       *
       * instead of:
       *
       * result: "valid"
       *
       * Treat CHECKED_IN as a successful first check-in.
       */

      const databaseStatus = String(res.status || "").toUpperCase();
      const databaseResult = String(res.result || "").toLowerCase();

      if (
        databaseResult === "valid" ||
        databaseStatus === "CHECKED_IN"
      ) {
        setResult("valid");
        setError("");
        addRecord("valid", name, passId);

        toast.success("Check-in successful");

        releaseToken();
        return;
      }

      if (
        databaseResult === "already" ||
        databaseStatus === "ALREADY_CHECKED_IN"
      ) {
        setResult("already");

        setError(
          res.checked_in_at
            ? `This pass has already been checked in (${new Date(
                res.checked_in_at
              ).toLocaleTimeString()}).`
            : res.message || "This pass has already been checked in."
        );

        addRecord("already", name, passId);
        toast.error("Already checked in.");

        releaseToken();
        return;
      }

      if (
        databaseResult === "revoked" ||
        databaseStatus === "REVOKED" ||
        databaseStatus === "REVOKED_PASS"
      ) {
        setResult("revoked");
        setError(res.message || "This pass has been revoked.");

        addRecord("revoked", name, passId);
        toast.error("Pass revoked.");

        releaseToken();
        return;
      }

      if (
        databaseResult === "unauthorized" ||
        databaseStatus === "UNAUTHORIZED"
      ) {
        setResult("invalid");
        setError("You must be logged in to scan passes.");

        addRecord("invalid");
        toast.error("Not logged in.");

        releaseToken();
        return;
      }

      if (
        databaseResult === "invalid" ||
        databaseStatus === "INVALID"
      ) {
        setResult("invalid");
        setError(res.message || "Invalid QR / Pass ID.");

        addRecord("invalid");
        toast.error("Invalid QR / Pass ID.");

        releaseToken();
        return;
      }

      // Unknown response
      console.error("Unknown check-in response:", res);

      throw new Error(
        res.message ||
          `Unexpected pass status: ${res.status || res.result || "UNKNOWN"}`
      );
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

      releaseToken();
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
      setError(cameraErrorMessage(err));
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
      setError("Enter a Pass ID (e.g. VYRA-ABC123) or QR link.");
      return;
    }

    await processValue(value);
    setManual("");
  }

  const resultColor =
    result === "valid"
      ? "#86efac"
      : result === "already"
        ? "#fcd34d"
        : "#fca5a5";

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
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
          Scanner
        </h1>

        <div
          style={{
            marginTop: 7,
            fontSize: 13,
            color: "var(--text2)",
          }}
        >
          {ev?.name || "Event"} {ev?.date ? `• ${ev.date}` : ""}
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

        <div className="card" style={{ padding: 20 }}>
          <div
            style={{
              fontSize: 12,
              color: "var(--text3)",
              letterSpacing: 1.5,
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            Scan Guest QR
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
                style={{ width: "100%" }}
              >
                START CAMERA
              </button>
            ) : (
              <button
                className="btn"
                onClick={stopScanner}
                style={{ width: "100%" }}
              >
                STOP CAMERA
              </button>
            )}
          </div>
        </div>

        {/* RESULT */}

        <div className="card" style={{ padding: 20 }}>
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
              border:
                result === "valid"
                  ? "1px solid rgba(34,197,94,.35)"
                  : result === "already"
                    ? "1px solid rgba(252,211,77,.35)"
                    : result === "revoked" || result === "invalid"
                      ? "1px solid rgba(239,68,68,.35)"
                      : "1px solid rgba(255,255,255,.08)",
              background:
                result === "valid"
                  ? "rgba(34,197,94,.07)"
                  : result === "already"
                    ? "rgba(252,211,77,.07)"
                    : result === "revoked" || result === "invalid"
                      ? "rgba(239,68,68,.07)"
                      : "rgba(255,255,255,.025)",
              borderRadius: 18,
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

                {resultPassType && (
                  <div
                    style={{
                      marginTop: 5,
                      fontSize: 12,
                      color: "var(--text2)",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                    }}
                  >
                    {resultPassType}
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
              borderTop: "1px solid rgba(255,255,255,.08)",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              Enter Pass ID
            </div>

            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") manualCheck();
              }}
              placeholder="e.g. VYRA-ABC123"
              autoCapitalize="characters"
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
                  background: "rgba(255,255,255,.02)",
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

                <div style={{ textAlign: "right" }}>
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