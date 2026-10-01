import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase, EventRow, Guest } from '../lib/supabase';
import { downloadPdf, qrDataUrl } from '../lib/pass';
import Icon from '../components/Icon';

const PASS_TYPES = [
  'Regular',
  'Early Bird',
  'Couple',
  'Surge Pass',
] as const;

export default function Guests({ ev }: { ev: EventRow }) {
  const [rows, setRows] = useState<Guest[]>([]);
  const [q, setQ] = useState('');
  const [st, setSt] = useState('');
  const [ty, setTy] = useState('');
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [view, setView] = useState<{
    g: Guest;
    qr: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from('guests')
      .select('*')
      .eq('event_id', ev.id)
      .order('created_at', {
        ascending: false,
      })
      .limit(500);

    if (st) {
      query = query.eq('status', st);
    }

    if (ty) {
      query = query.eq('pass_type', ty);
    }

    if (q.trim()) {
      const term = q.trim();

      query = query.or(
        `name.ilike.%${term}%,pass_id.ilike.%${term}%`
      );
    }

    const { data, error } = await query;

    setLoading(false);

    if (error) {
      console.error('Guest load error:', error);
      toast.error(
        error.message || 'Could not load guests.'
      );
      return;
    }

    setRows((data || []) as Guest[]);
  }, [ev.id, q, st, ty]);

  useEffect(() => {
    void load();
  }, [load]);

  async function deleteGuest(g: Guest) {
    const confirmed = window.confirm(
      `Delete ${g.name}'s pass?\n\nThis will permanently remove the guest and pass from the database.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(g.id);

    try {
      const { data, error } = await supabase
        .from('guests')
        .delete()
        .eq('id', g.id)
        .eq('event_id', ev.id)
        .select('id')
        .maybeSingle();

      if (error) {
        console.error('Delete error:', error);

        toast.error(
          error.message || 'Could not delete this guest.'
        );

        return;
      }

      if (!data) {
        toast.error(
          'Guest was not deleted. Your Supabase DELETE policy may be blocking it.'
        );

        return;
      }

      setRows((current) =>
        current.filter((row) => row.id !== g.id)
      );

      if (view?.g.id === g.id) {
        setView(null);
      }

      toast.success(
        `${g.name}'s pass was deleted.`
      );
    } catch (error) {
      console.error(
        'Unexpected delete error:',
        error
      );

      toast.error(
        'Something went wrong while deleting the pass.'
      );
    } finally {
      setDeletingId(null);
    }
  }

  const control =
    'rounded-2xl px-4 py-3';

  const status = (s: Guest['status']) => {
    if (s === 'checked_in') {
      return [
        'text-emerald-300',
        'bg-emerald-300/10',
        'Checked in',
      ];
    }

    if (s === 'revoked') {
      return [
        'text-red-300',
        'bg-red-300/10',
        'Revoked',
      ];
    }

    return [
      'text-amber-200',
      'bg-amber-200/10',
      'Valid',
    ];
  };

  return (
    <div className="page-in">

      <div className="glass rounded-[28px] p-5 md:p-7">

        {/* HEADER */}
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">

          <div>
            <p className="text-[10px] uppercase tracking-[.34em] text-amber-200/60">
              Guest directory
            </p>

            <h2 className="font-display mt-2 text-4xl">
              Guests
            </h2>

            <p className="mt-2 text-sm text-zinc-500">
              Manage every guest pass for this event.
            </p>
          </div>

          {/* FILTERS */}
          <div className="flex flex-col gap-2 sm:flex-row">

            <div className="relative">
              <Icon
                name="search"
                size={17}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600"
              />

              <input
                className={`${control} w-full pl-11 sm:w-64`}
                placeholder="Search name or pass ID"
                value={q}
                onChange={(e) =>
                  setQ(e.target.value)
                }
              />
            </div>

            <select
              className={control}
              value={st}
              onChange={(e) =>
                setSt(e.target.value)
              }
            >
              <option value="">
                All statuses
              </option>

              <option value="valid">
                Valid
              </option>

              <option value="checked_in">
                Checked in
              </option>

              <option value="revoked">
                Revoked
              </option>
            </select>

            <select
              className={control}
              value={ty}
              onChange={(e) =>
                setTy(e.target.value)
              }
            >
              <option value="">
                All types
              </option>

              {PASS_TYPES.map((passType) => (
                <option
                  key={passType}
                  value={passType}
                >
                  {passType}
                </option>
              ))}
            </select>

          </div>
        </div>

        {/* TABLE */}
        <div className="mt-7 overflow-x-auto">

          <table className="w-full min-w-[920px] text-left text-sm">

            <thead className="border-y border-white/[.07] text-[10px] uppercase tracking-[.18em] text-zinc-500">

              <tr>
                <th className="px-4 py-3.5">
                  Guest
                </th>

                <th className="px-4 py-3.5">
                  Pass ID
                </th>

                <th className="px-4 py-3.5">
                  Type
                </th>

                <th className="px-4 py-3.5">
                  Status
                </th>

                <th className="px-4 py-3.5">
                  Created
                </th>

                <th className="px-4 py-3.5">
                  Checked in
                </th>

                <th className="px-4 py-3.5">
                  Actions
                </th>
              </tr>

            </thead>

            <tbody>

              {loading && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-zinc-600"
                  >
                    Loading guests…
                  </td>
                </tr>
              )}

              {!loading && !rows.length && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-zinc-600"
                  >
                    No guests found.
                  </td>
                </tr>
              )}

              {!loading &&
                rows.map((g) => {
                  const [
                    tone,
                    bg,
                    label,
                  ] = status(g.status);

                  return (
                    <tr
                      key={g.id}
                      className="border-b border-white/[.06] transition hover:bg-white/[.015]"
                    >

                      {/* NAME */}
                      <td className="px-4 py-4">
                        <p className="font-medium text-zinc-100">
                          {g.name}
                        </p>

                        {g.phone && (
                          <p className="mt-1 text-xs text-zinc-600">
                            {g.phone}
                          </p>
                        )}
                      </td>

                      {/* PASS ID */}
                      <td className="px-4 py-4 font-mono text-xs text-zinc-300">
                        {g.pass_id}
                      </td>

                      {/* TYPE */}
                      <td className="px-4 py-4 text-zinc-400">
                        {g.pass_type}
                      </td>

                      {/* STATUS */}
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[.14em] ${tone} ${bg}`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {label}
                        </span>
                      </td>

                      {/* CREATED */}
                      <td className="px-4 py-4 text-xs text-zinc-500">
                        {new Date(
                          g.created_at
                        ).toLocaleString()}
                      </td>

                      {/* CHECKED IN */}
                      <td className="px-4 py-4 text-xs text-zinc-500">
                        {g.checked_in_at
                          ? new Date(
                              g.checked_in_at
                            ).toLocaleTimeString(
                              [],
                              {
                                hour: 'numeric',
                                minute: '2-digit',
                              }
                            )
                          : '—'}
                      </td>

                      {/* ACTIONS */}
                      <td className="px-4 py-4">

                        <div className="flex items-center gap-2">

                          <button
                            className="table-btn"
                            onClick={async () => {
                              try {
                                const qr =
                                  await qrDataUrl(
                                    g.qr_token
                                  );

                                setView({
                                  g,
                                  qr,
                                });
                              } catch (error) {
                                console.error(
                                  'QR error:',
                                  error
                                );

                                toast.error(
                                  'Could not generate QR.'
                                );
                              }
                            }}
                          >
                            View
                          </button>

                          <button
                            className="table-btn"
                            onClick={() =>
                              downloadPdf(
                                g,
                                ev
                              ).catch(
                                (error) => {
                                  console.error(
                                    'PDF error:',
                                    error
                                  );

                                  toast.error(
                                    'PDF failed.'
                                  );
                                }
                              )
                            }
                          >
                            PDF
                          </button>

                          {/* DELETE */}
                          <button
                            disabled={
                              deletingId === g.id
                            }
                            className="table-btn border-red-400/10 text-red-300 hover:border-red-400/30 hover:bg-red-400/5 disabled:opacity-50"
                            onClick={() =>
                              void deleteGuest(g)
                            }
                          >
                            {deletingId === g.id
                              ? 'Deleting…'
                              : 'Delete'}
                          </button>

                        </div>

                      </td>

                    </tr>
                  );
                })}

            </tbody>

          </table>

        </div>

      </div>

      {/* VIEW MODAL */}
      {view && (
        <div
          onClick={() => setView(null)}
          className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) =>
              e.stopPropagation()
            }
            className="glass max-w-sm rounded-[28px] p-6 text-center"
          >

            <div className="mb-4 flex items-center justify-between">

              <div>
                <p className="text-[10px] uppercase tracking-[.25em] text-zinc-500">
                  Guest pass
                </p>

                <p className="font-display mt-1 text-3xl">
                  {view.g.name}
                </p>
              </div>

              <button
                onClick={() => setView(null)}
                className="text-zinc-500 hover:text-white"
              >
                ✕
              </button>

            </div>

            <p className="font-mono text-xs text-zinc-500">
              {view.g.pass_id}
            </p>

            <div className="mt-5 rounded-3xl bg-white p-3">
              <img
                src={view.qr}
                className="w-56"
                alt="QR"
              />
            </div>

          </div>
        </div>
      )}

    </div>
  );
}