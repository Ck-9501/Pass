import {
  useEffect,
  useRef,
  useState,
} from 'react';

import toast from 'react-hot-toast';

import {
  Html5Qrcode,
} from 'html5-qrcode';

import {
  supabase,
  EventRow,
} from '../lib/supabase';

import Icon from '../components/Icon';

type ScanResult = {
  result:
    | 'valid'
    | 'already'
    | 'invalid'
    | 'revoked';

  name?: string;
  pass_id?: string;
  pass_type?: string;
  at?: string;
};

type ScanLog =
  ScanResult & {
    id: string;
    scannedAt: string;
  };

function extractToken(
  value: string
): string {
  const raw =
    value.trim();

  try {
    const url =
      new URL(raw);

    const parts =
      url.pathname
        .split('/')
        .filter(Boolean);

    const verifyIndex =
      parts.findIndex(
        (part) =>
          part.toLowerCase() ===
          'verify'
      );

    if (
      verifyIndex >= 0 &&
      parts[verifyIndex + 1]
    ) {
      return decodeURIComponent(
        parts[verifyIndex + 1]
      );
    }
  } catch {
    // Raw token.
  }

  return raw;
}

export default function Scanner({
  ev,
}: {
  ev: EventRow;
}) {
  const scannerRef =
    useRef<Html5Qrcode | null>(
      null
    );

  const activeRef =
    useRef(false);

  const processingRef =
    useRef(false);

  const lastTokenRef =
    useRef('');

  const lastScanRef =
    useRef(0);

  const [
    cameraReady,
    setCameraReady,
  ] =
    useState(false);

  const [
    starting,
    setStarting,
  ] =
    useState(true);

  const [
    result,
    setResult,
  ] =
    useState<ScanResult | null>(
      null
    );

  const [
    manualToken,
    setManualToken,
  ] =
    useState('');

  const [
    logs,
    setLogs,
  ] =
    useState<ScanLog[]>([]);

  useEffect(() => {

    let mounted = true;

    const scanner =
      new Html5Qrcode(
        'partypass-qr-reader'
      );

    scannerRef.current =
      scanner;

    async function startScanner() {

      try {

        setStarting(true);

        await scanner.start(
          {
            facingMode:
              'environment',
          },
          {
            fps: 10,
            qrbox: {
              width: 250,
              height: 250,
            },
            aspectRatio: 1,
          },
          async (
            decodedText
          ) => {

            if (
              !mounted ||
              processingRef.current
            ) {
              return;
            }

            const token =
              extractToken(
                decodedText
              );

            if (!token) {
              return;
            }

            const now =
              Date.now();

            if (
              token ===
                lastTokenRef.current &&
              now -
                lastScanRef.current <
                3500
            ) {
              return;
            }

            lastTokenRef.current =
              token;

            lastScanRef.current =
              now;

            processingRef.current =
              true;

            await validateToken(
              token
            );

            window.setTimeout(
              () => {
                processingRef.current =
                  false;
              },
              1200
            );

          },
          () => {
            // Normal QR decode miss.
          }
        );

        activeRef.current =
          true;

        if (mounted) {

          setCameraReady(
            true
          );

          setStarting(
            false
          );

        }

      } catch (error) {

        console.error(
          'Camera start error:',
          error
        );

        if (mounted) {

          setStarting(
            false
          );

          toast.error(
            'Camera could not start. Allow camera access or use manual validation.'
          );

        }

      }
    }

    async function validateToken(
      token: string
    ) {

      try {

        const {
          data,
          error,
        } =
          await supabase.rpc(
            'check_in',
            {
              p_token:
                token,

              p_device:
                navigator.userAgent.slice(
                  0,
                  120
                ),
            }
          );

        if (error) {

          console.error(
            'Check-in error:',
            error
          );

          const invalidResult: ScanResult = {
            result:
              'invalid',
          };

          setResult(
            invalidResult
          );

          toast.error(
            error.message ||
              'Could not validate pass.'
          );

          return;
        }

        const scan =
          data as ScanResult;

        setResult(
          scan
        );

        const log: ScanLog = {
          ...scan,
          id:
            `${Date.now()}-${Math.random()}`,
          scannedAt:
            new Date().toISOString(),
        };

        setLogs(
          (current) =>
            [
              log,
              ...current,
            ].slice(
              0,
              10
            )
        );

        if (
          scan.result ===
          'valid'
        ) {

          toast.success(
            `${scan.name || 'Guest'} checked in successfully.`
          );

        } else if (
          scan.result ===
          'already'
        ) {

          toast.error(
            'Already checked in.'
          );

        } else if (
          scan.result ===
          'revoked'
        ) {

          toast.error(
            'This pass has been revoked.'
          );

        } else {

          toast.error(
            'Invalid pass.'
          );

        }

      } catch (error) {

        console.error(
          'Validation error:',
          error
        );

        setResult({
          result:
            'invalid',
        });

        toast.error(
          'Could not validate the pass.'
        );

      }
    }

    void startScanner();

    return () => {

      mounted = false;

      if (activeRef.current) {

        activeRef.current =
          false;

        scanner
          .stop()
          .catch(
            () => undefined
          );

      }

      /*
       * IMPORTANT:
       * Html5Qrcode.clear() returns void.
       * Therefore DO NOT use .catch() here.
       */
      try {
        scanner.clear();
      } catch (error) {
        console.error(
          'Scanner clear error:',
          error
        );
      }

      scannerRef.current =
        null;

    };

  }, [ev.id]);

  async function stopCamera() {

    if (
      !scannerRef.current ||
      !activeRef.current
    ) {
      return;
    }

    try {

      await scannerRef.current.stop();

      activeRef.current =
        false;

      setCameraReady(
        false
      );

    } catch (error) {

      console.error(
        'Stop camera error:',
        error
      );

    }
  }

  async function manualCheck(
    e: React.FormEvent<HTMLFormElement>
  ) {

    e.preventDefault();

    const token =
      extractToken(
        manualToken
      );

    if (!token) {

      toast.error(
        'Enter a QR token or URL.'
      );

      return;
    }

    processingRef.current =
      true;

    try {

      const {
        data,
        error,
      } =
        await supabase.rpc(
          'check_in',
          {
            p_token:
              token,

            p_device:
              `manual-${navigator.userAgent.slice(
                0,
                100
              )}`,
          }
        );

      if (error) {

        console.error(
          'Manual check-in error:',
          error
        );

        setResult({
          result:
            'invalid',
        });

        toast.error(
          error.message ||
            'Could not validate pass.'
        );

        return;
      }

      const scan =
        data as ScanResult;

      setResult(
        scan
      );

      setLogs(
        (current) =>
          [
            {
              ...scan,
              id:
                `${Date.now()}-${Math.random()}`,
              scannedAt:
                new Date().toISOString(),
            },
            ...current,
          ].slice(
            0,
            10
          )
      );

      if (
        scan.result ===
        'valid'
      ) {

        toast.success(
          `${scan.name || 'Guest'} checked in successfully.`
        );

      } else if (
        scan.result ===
        'already'
      ) {

        toast.error(
          'Already checked in.'
        );

      } else if (
        scan.result ===
        'revoked'
      ) {

        toast.error(
          'This pass has been revoked.'
        );

      } else {

        toast.error(
          'Invalid pass.'
        );

      }

    } finally {

      setManualToken('');

      window.setTimeout(
        () => {
          processingRef.current =
            false;
        },
        1000
      );

    }
  }

  const resultConfig = {
    valid: {
      title:
        'CHECK-IN APPROVED',
      subtitle:
        'Guest admitted successfully',
      color:
        'text-emerald-300',
      border:
        'border-emerald-300/25',
      bg:
        'bg-emerald-300/[.05]',
      icon:
        'check',
    },

    already: {
      title:
        'ALREADY CHECKED IN',
      subtitle:
        'This pass has already been used',
      color:
        'text-amber-200',
      border:
        'border-amber-300/25',
      bg:
        'bg-amber-300/[.05]',
      icon:
        'clock',
    },

    invalid: {
      title:
        'INVALID PASS',
      subtitle:
        'No valid guest pass was found',
      color:
        'text-red-300',
      border:
        'border-red-300/25',
      bg:
        'bg-red-300/[.05]',
      icon:
        'ban',
    },

    revoked: {
      title:
        'PASS REVOKED',
      subtitle:
        'This pass cannot be used',
      color:
        'text-red-300',
      border:
        'border-red-300/25',
      bg:
        'bg-red-300/[.05]',
      icon:
        'ban',
    },
  } as const;

  return (
    <div className="page-in space-y-6">

      {/* SCANNER */}

      <section className="grid gap-5 xl:grid-cols-[1fr_.82fr]">

        <div className="glass rounded-[28px] p-5 md:p-7">

          <div className="flex items-start justify-between gap-4">

            <div>

              <p className="text-[10px] uppercase tracking-[.34em] text-amber-200/60">
                Entrance Control
              </p>

              <h1 className="font-display mt-2 text-4xl md:text-5xl">
                QR Scanner
              </h1>

              <p className="mt-2 text-sm text-zinc-500">
                Scan passes for{' '}
                <span className="text-zinc-300">
                  {ev.name}
                </span>
              </p>

            </div>

            <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[.04] p-3 text-amber-200">

              <Icon
                name="scanner"
                size={22}
              />

            </div>

          </div>

          <div className="mt-6 overflow-hidden rounded-[25px] border border-white/[.08] bg-black">

            <div className="relative aspect-square max-h-[520px] w-full">

              <div
                id="partypass-qr-reader"
                className="h-full w-full [&>video]:h-full [&>video]:w-full [&>video]:object-cover"
              />

              <div className="pointer-events-none absolute left-1/2 top-1/2 h-[65%] w-[65%] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-amber-200/45 shadow-[0_0_50px_rgba(226,177,93,.08)]" />

              <div className="pointer-events-none absolute left-1/2 top-[18%] h-px w-[55%] -translate-x-1/2 bg-gradient-to-r from-transparent via-amber-200 to-transparent" />

            </div>

          </div>

          <div className="mt-4 flex items-center justify-between gap-3">

            <div className="flex items-center gap-2 text-xs text-zinc-500">

              <span
                className={`h-2 w-2 rounded-full ${
                  cameraReady
                    ? 'bg-emerald-300'
                    : 'bg-amber-300'
                }`}
              />

              {cameraReady
                ? 'Camera active'
                : starting
                  ? 'Starting camera…'
                  : 'Camera paused'}

            </div>

            {cameraReady && (
              <button
                type="button"
                onClick={() =>
                  void stopCamera()
                }
                className="action-btn"
              >
                Pause Camera
              </button>
            )}

          </div>

        </div>

        {/* RESULT */}

        <div className="space-y-5">

          <div className="glass rounded-[28px] p-5 md:p-7">

            <p className="text-[10px] uppercase tracking-[.3em] text-zinc-600">
              Scan Result
            </p>

            {!result ? (

              <div className="mt-5 rounded-[24px] border border-dashed border-white/[.08] p-10 text-center">

                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-white/[.08] text-zinc-600">

                  <Icon
                    name="scanner"
                    size={27}
                  />

                </div>

                <p className="mt-5 text-sm text-zinc-400">
                  Waiting for a pass…
                </p>

                <p className="mt-2 text-xs text-zinc-600">
                  Point the camera at a guest QR.
                </p>

              </div>

            ) : (

              (() => {

                const ui =
                  resultConfig[
                    result.result
                  ];

                return (
                  <div
                    className={`mt-5 rounded-[24px] border ${ui.border} ${ui.bg} p-6`}
                  >

                    <div
                      className={`mx-auto grid h-16 w-16 place-items-center rounded-full border ${ui.border} ${ui.color}`}
                    >

                      <Icon
                        name={ui.icon}
                        size={28}
                      />

                    </div>

                    <p
                      className={`mt-5 text-center text-sm font-semibold tracking-[.17em] ${ui.color}`}
                    >
                      {ui.title}
                    </p>

                    <p className="mt-2 text-center text-sm text-zinc-500">
                      {ui.subtitle}
                    </p>

                    {result.name && (
                      <div className="mt-6 text-center">

                        <p className="font-display text-4xl text-white">
                          {result.name}
                        </p>

                        <p className="mt-2 font-mono text-xs text-zinc-600">
                          {result.pass_id ||
                            '—'}
                        </p>

                      </div>
                    )}

                    {result.at && (
                      <p className="mt-5 text-center text-[10px] uppercase tracking-[.2em] text-zinc-700">
                        {new Date(
                          result.at
                        ).toLocaleString()}
                      </p>
                    )}

                  </div>
                );

              })()

            )}

          </div>

          {/* MANUAL */}

          <div className="glass rounded-[28px] p-5 md:p-7">

            <p className="text-[10px] uppercase tracking-[.3em] text-zinc-600">
              Manual Validation
            </p>

            <p className="mt-2 text-xs text-zinc-600">
              Paste a QR token if camera scanning is unavailable.
            </p>

            <form
              onSubmit={
                manualCheck
              }
              className="mt-4 flex gap-2"
            >

              <input
                value={
                  manualToken
                }
                onChange={(e) =>
                  setManualToken(
                    e.target.value
                  )
                }
                placeholder="Paste QR token or URL"
                className="min-w-0 rounded-2xl px-4 py-3"
              />

              <button
                type="submit"
                className="shrink-0 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-300 px-5 font-semibold text-black"
              >
                Check
              </button>

            </form>

          </div>

        </div>

      </section>

      {/* RECENT SCANS */}

      <section className="glass rounded-[28px] p-5 md:p-7">

        <div className="flex items-end justify-between">

          <div>

            <p className="text-[10px] uppercase tracking-[.3em] text-zinc-600">
              Live Activity
            </p>

            <h2 className="font-display mt-1 text-3xl">
              Recent Scans
            </h2>

          </div>

          <span className="text-[10px] uppercase tracking-[.2em] text-zinc-700">
            {logs.length} shown
          </span>

        </div>

        <div className="mt-5 overflow-x-auto">

          <table className="w-full min-w-[700px] text-left">

            <thead className="border-y border-white/[.07] text-[9px] uppercase tracking-[.18em] text-zinc-600">

              <tr>

                <th className="px-4 py-3.5">
                  Guest
                </th>

                <th className="px-4 py-3.5">
                  Pass ID
                </th>

                <th className="px-4 py-3.5">
                  Result
                </th>

                <th className="px-4 py-3.5">
                  Time
                </th>

              </tr>

            </thead>

            <tbody>

              {!logs.length ? (

                <tr>

                  <td
                    colSpan={4}
                    className="px-4 py-12 text-center text-zinc-700"
                  >
                    No scans yet.
                  </td>

                </tr>

              ) : (

                logs.map(
                  (log) => {

                    const color =
                      log.result ===
                      'valid'
                        ? 'text-emerald-300'
                        : log.result ===
                            'already'
                          ? 'text-amber-200'
                          : 'text-red-300';

                    const label =
                      log.result ===
                      'valid'
                        ? 'Approved'
                        : log.result ===
                            'already'
                          ? 'Already Checked In'
                          : log.result ===
                              'revoked'
                            ? 'Revoked'
                            : 'Invalid';

                    return (
                      <tr
                        key={log.id}
                        className="border-t border-white/[.055]"
                      >

                        <td className="px-4 py-4 text-sm text-zinc-200">
                          {log.name ||
                            'Unknown'}
                        </td>

                        <td className="px-4 py-4 font-mono text-xs text-zinc-500">
                          {log.pass_id ||
                            '—'}
                        </td>

                        <td
                          className={`px-4 py-4 text-xs ${color}`}
                        >

                          <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-current" />

                          {label}

                        </td>

                        <td className="px-4 py-4 text-xs text-zinc-600">
                          {new Date(
                            log.scannedAt
                          ).toLocaleTimeString(
                            [],
                            {
                              hour:
                                'numeric',
                              minute:
                                '2-digit',
                            }
                          )}
                        </td>

                      </tr>
                    );

                  }
                )

              )}

            </tbody>

          </table>

        </div>

      </section>

    </div>
  );
}