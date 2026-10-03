import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

import {
  supabase,
  EventRow,
  Guest,
} from '../lib/supabase';

import Icon from '../components/Icon';

export default function Dashboard({
  ev,
}: {
  ev: EventRow;
}) {
  type AdminGuest = Guest & {
    created_by_name?: string | null;
  };

  const [rows, setRows] =
    useState<AdminGuest[]>([]);

  const [totalHeads, setTotalHeads] =
    useState(0);

  const [loading, setLoading] =
    useState(true);

  const getHeadCount = (passType: string | null | undefined) =>
    passType === "Couple" ? 2 : 1;

  const loadDashboard = useCallback(async () => {
    const { data, error } = await supabase
      .from('guests')
      .select('*')
      .eq('event_id', ev.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Could not load dashboard data.');
      return;
    }

    const guests = (data as AdminGuest[]) || [];

    setRows(guests);
    setTotalHeads(
      guests.reduce(
        (sum, guest) => sum + getHeadCount(guest.pass_type),
        0
      )
    );
  }, [ev.id]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!mounted) return;
      setLoading(true);
      await loadDashboard();
      if (mounted) setLoading(false);
    })();

    const channel = supabase
      .channel(`dashboard-guests-${ev.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'guests',
          filter: `event_id=eq.${ev.id}`,
        },
        () => {
          void loadDashboard();
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [ev.id, loadDashboard]);

  const counts = {
    total: rows.length,
    checked: rows.filter((g) => g.status === 'checked_in').length,
    revoked: rows.filter((g) => g.status === 'revoked').length,
  };

  const notArrived = Math.max(
    counts.total -
      counts.checked -
      counts.revoked,
    0
  );

  const stats = [
    {
      label: 'TOTAL PASSES',
      value: counts.total,
      icon: 'ticket' as const,
      color: 'text-amber-200',
    },
    {
      label: 'TOTAL HEADS',
      value: totalHeads,
      icon: 'users' as const,
      color: 'text-blue-200',
    },
    {
      label: 'CHECKED IN',
      value: counts.checked,
      icon: 'check' as const,
      color: 'text-emerald-300',
    },
    {
      label: 'REVOKED',
      value: counts.revoked,
      icon: 'ban' as const,
      color: 'text-red-300',
    },
  ];

  const getStatus = (
    status: Guest['status']
  ) => {

    if (status === 'checked_in') {
      return {
        label: 'Checked In',
        className: 'text-emerald-300',
      };
    }

    if (status === 'revoked') {
      return {
        label: 'Revoked',
        className: 'text-red-300',
      };
    }

    return {
      label: 'Not Arrived',
      className: 'text-amber-200',
    };

  };

  const formatTime = (
    value: string
  ) =>
    new Date(value).toLocaleTimeString(
      [],
      {
        hour: 'numeric',
        minute: '2-digit',
      }
    );

  return (
    <div className="page-in space-y-7">

      {/* ==================================
          HERO
      ================================== */}

      <section className="grid gap-5 xl:grid-cols-[1.18fr_.82fr]">

        <div className="relative pt-2 md:pt-5">

          <p className="text-[10px] uppercase tracking-[.34em] text-amber-200/60">
            Command Center
          </p>

          <h1 className="hero-title font-display mt-3 text-5xl leading-[.92] text-white sm:text-6xl xl:text-[4.8rem]">

            Welcome Back,

            <br />

            <span className="text-zinc-300">
              VYRA Entertainment
            </span>

          </h1>

          <p className="mt-6 max-w-2xl text-[10px] uppercase tracking-[.28em] text-zinc-600 sm:text-xs">

            Manage your event

            <span className="mx-2 text-amber-300/50">
              •
            </span>

            Create guest passes

            <span className="mx-2 text-amber-300/50">
              •
            </span>

            Track check-ins

          </p>

        </div>

        {/* CURRENT EVENT */}

        <div className="event-card glass rounded-[26px] p-5 md:p-6">

          <div className="flex items-start justify-between gap-4">

            <div>

              <p className="text-[9px] uppercase tracking-[.3em] text-zinc-600">
                Current Event
              </p>

              <h2 className="font-display mt-2 text-4xl text-zinc-100">
                {ev.name}
              </h2>

            </div>

            <div className="rounded-full border border-amber-300/15 bg-amber-300/[.04] p-2.5 text-amber-200">
              <Icon
                name="calendar"
                size={18}
              />
            </div>

          </div>

          <div className="mt-6 grid grid-cols-2 gap-5">

            <div>
              <p className="text-[9px] uppercase tracking-[.18em] text-zinc-600">
                Date
              </p>

              <p className="mt-1.5 text-sm text-zinc-200">
                {ev.date || '—'}
              </p>
            </div>

            <div>
              <p className="text-[9px] uppercase tracking-[.18em] text-zinc-600">
                Time
              </p>

              <p className="mt-1.5 text-sm text-zinc-200">
                {ev.time || '—'}
              </p>
            </div>

            <div>
              <p className="text-[9px] uppercase tracking-[.18em] text-zinc-600">
                Venue
              </p>

              <p className="mt-1.5 text-sm text-zinc-200">
                {ev.venue || '—'}
              </p>
            </div>

            <div>
              <p className="text-[9px] uppercase tracking-[.18em] text-zinc-600">
                Organizer
              </p>

              <p className="mt-1.5 text-sm text-zinc-200">
                {ev.organizer || '—'}
              </p>
            </div>

          </div>

          <div className="mt-6 h-px bg-gradient-to-r from-amber-300/30 via-white/[.06] to-transparent" />

        </div>

      </section>

      {/* ==================================
          STATS
      ================================== */}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

        {stats.map((stat) => (
          <div
            key={stat.label}
            className="stat-card glass rounded-[24px] p-5"
          >

            <div
              className={`mb-7 ${stat.color}`}
            >
              <Icon
                name={stat.icon}
                size={23}
              />
            </div>

            <p className="text-[9px] uppercase tracking-[.25em] text-zinc-600">
              {stat.label}
            </p>

            <p className="mt-2 text-4xl text-white">
              {stat.value}
            </p>

            <div className="mt-6 h-px w-[52%] bg-gradient-to-r from-current to-transparent opacity-50" />

          </div>
        ))}

      </section>

      {/* ==================================
          RECENT + ACTIONS
      ================================== */}

      <section className="grid gap-5 xl:grid-cols-[1.42fr_.8fr]">

        {/* RECENT */}

        <div className="glass rounded-[24px] p-5 md:p-6">

          <div className="mb-5 flex items-center justify-between">

            <div>

              <p className="text-[9px] uppercase tracking-[.28em] text-zinc-600">
                Guest Activity
              </p>

              <h3 className="font-display mt-1 text-3xl">
                Recent Guests
              </h3>

            </div>

            <Link
              to="/guests"
              className="text-xs text-zinc-400 transition hover:text-amber-200"
            >
              View all →
            </Link>

          </div>

          {loading ? (

            <div className="py-12 text-center text-sm text-zinc-600">
              Loading guests…
            </div>

          ) : !rows.length ? (

            <div className="rounded-2xl border border-dashed border-white/[.07] py-12 text-center text-sm text-zinc-600">
              No guest passes yet.
            </div>

          ) : (

            <div className="overflow-x-auto">

              <table className="w-full min-w-[980px] text-left">

                <thead className="text-[9px] uppercase tracking-[.2em] text-zinc-600">

                  <tr>
                    <th className="px-3 py-3">Name</th>
                    <th className="px-3 py-3">Pass Type</th>
                    <th className="px-3 py-3">Heads</th>
                    <th className="px-3 py-3">Generated By</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Check-in Time</th>
                    <th className="px-3 py-3">Action</th>
                  </tr>

                </thead>

                <tbody>

                  {rows.map((guest) => {

                    const info =
                      getStatus(
                        guest.status
                      );

                    return (
                      <tr
                        key={guest.id}
                        className="border-t border-white/[.055] transition hover:bg-white/[.015]"
                      >

                        <td className="px-3 py-4 text-sm text-zinc-100">
                          {guest.name}
                        </td>

                        <td className="px-3 py-4 text-xs text-zinc-500">
                          {guest.pass_type}
                        </td>

                        <td className="px-3 py-4 text-xs text-zinc-300">
                          {getHeadCount(guest.pass_type)}
                        </td>

                        <td className="px-3 py-4 text-xs text-zinc-400">
                          {guest.created_by_name || 'Unknown'}
                        </td>

                        <td className="px-3 py-4">

                          <span
                            className={`inline-flex items-center gap-2 text-xs ${info.className}`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />

                            {info.label}
                          </span>

                        </td>

                        <td className="px-3 py-4 text-xs text-zinc-600">
                          {guest.checked_in_at
                            ? formatTime(guest.checked_in_at)
                            : '—'}
                        </td>

                        <td className="px-3 py-4">
                          <button
                            type="button"
                            onClick={async () => {
                              if (!window.confirm(`Delete pass for ${guest.name}?`)) return;

                              const { error: deleteError } = await supabase
                                .from('guests')
                                .delete()
                                .eq('id', guest.id);

                              if (deleteError) {
                                toast.error(deleteError.message);
                                return;
                              }

                              toast.success('Pass deleted.');
                              await loadDashboard();
                            }}
                            className="rounded-xl border border-red-400/15 px-3 py-2 text-xs text-red-300 transition hover:bg-red-400/[.06]"
                          >
                            Delete
                          </button>
                        </td>

                      </tr>
                    );

                  })}

                </tbody>

              </table>

            </div>

          )}

        </div>

        {/* QUICK ACTIONS */}

        <div className="glass rounded-[24px] p-5 md:p-6">

          <p className="text-[9px] uppercase tracking-[.28em] text-zinc-600">
            Operations
          </p>

          <h3 className="font-display mt-1 text-3xl">
            Quick Actions
          </h3>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">

            <Link
              to="/create"
              className="quick-card rounded-2xl border border-amber-300/15 bg-amber-300/[.025] p-4"
            >

              <div className="flex items-center justify-between">

                <span className="text-amber-200">
                  <Icon
                    name="ticket"
                    size={21}
                  />
                </span>

                <Icon
                  name="chevron"
                  size={17}
                  className="text-zinc-700 transition group-hover:translate-x-1"
                />

              </div>

              <p className="mt-7 text-sm font-medium text-white">
                Create Pass
              </p>

              <p className="mt-1 text-xs text-zinc-600">
                Generate a new guest pass
              </p>

            </Link>

            <Link
              to="/guests"
              className="quick-card rounded-2xl border border-white/[.07] p-4"
            >

              <div className="flex items-center justify-between">

                <span className="text-zinc-300">
                  <Icon
                    name="users"
                    size={21}
                  />
                </span>

                <Icon
                  name="chevron"
                  size={17}
                  className="text-zinc-700"
                />

              </div>

              <p className="mt-7 text-sm font-medium text-white">
                View Guests
              </p>

              <p className="mt-1 text-xs text-zinc-600">
                Manage your guest list
              </p>

            </Link>

            <Link
              to="/settings"
              className="quick-card rounded-2xl border border-white/[.07] p-4"
            >

              <div className="flex items-center justify-between">

                <span className="text-zinc-300">
                  <Icon
                    name="settings"
                    size={21}
                  />
                </span>

                <Icon
                  name="chevron"
                  size={17}
                  className="text-zinc-700"
                />

              </div>

              <p className="mt-7 text-sm font-medium text-white">
                Settings
              </p>

              <p className="mt-1 text-xs text-zinc-600">
                Update event details
              </p>

            </Link>

          </div>

        </div>

      </section>

      {/* FOOTER */}

      <div className="flex items-center gap-4 pb-3 pt-1">

        <span className="h-px flex-1 bg-gradient-to-r from-transparent to-amber-300/20" />

        <span className="text-[9px] uppercase tracking-[.42em] text-zinc-700">
          Beyond the Ordinary
        </span>

        <span className="h-px flex-1 bg-gradient-to-l from-transparent to-amber-300/20" />

      </div>

    </div>
  );
}