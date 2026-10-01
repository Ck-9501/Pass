import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { supabase, EventRow, Guest } from '../lib/supabase';
import Icon from '../components/Icon';

export default function Dashboard({
  ev,
}: {
  ev: EventRow;
}) {
  const [rows, setRows] =
    useState<Guest[]>([]);

  const [counts, setCounts] =
    useState({
      total: 0,
      checked: 0,
      revoked: 0,
    });

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      const [
        recent,
        total,
        checked,
        revoked,
      ] = await Promise.all([
        supabase
          .from('guests')
          .select('*')
          .eq('event_id', ev.id)
          .order('created_at', {
            ascending: false,
          })
          .limit(6),

        supabase
          .from('guests')
          .select('id', {
            count: 'exact',
            head: true,
          })
          .eq('event_id', ev.id),

        supabase
          .from('guests')
          .select('id', {
            count: 'exact',
            head: true,
          })
          .eq('event_id', ev.id)
          .eq('status', 'checked_in'),

        supabase
          .from('guests')
          .select('id', {
            count: 'exact',
            head: true,
          })
          .eq('event_id', ev.id)
          .eq('status', 'revoked'),
      ]);

      if (!alive) return;

      if (
        recent.error ||
        total.error ||
        checked.error ||
        revoked.error
      ) {
        toast.error(
          'Could not load dashboard data.'
        );
      }

      setRows(
        (recent.data as Guest[]) || []
      );

      setCounts({
        total: total.count || 0,
        checked: checked.count || 0,
        revoked: revoked.count || 0,
      });

      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [ev.id]);

  const notArrived = Math.max(
    counts.total -
      counts.checked -
      counts.revoked,
    0
  );

  const stats = [
    {
      label: 'TOTAL GUESTS',
      value: counts.total,
      icon: 'users',
      accent: 'text-amber-200',
    },
    {
      label: 'CHECKED IN',
      value: counts.checked,
      icon: 'check',
      accent: 'text-emerald-300',
    },
    {
      label: 'NOT ARRIVED',
      value: notArrived,
      icon: 'clock',
      accent: 'text-amber-100',
    },
    {
      label: 'REVOKED',
      value: counts.revoked,
      icon: 'ban',
      accent: 'text-red-300',
    },
  ] as const;

  const time = (date: string) =>
    new Date(date).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });

  const statusText = (status: Guest['status']) => {
    if (status === 'checked_in') {
      return 'Checked in';
    }

    if (status === 'revoked') {
      return 'Revoked';
    }

    return 'Not arrived';
  };

  const statusClass =
    (status: Guest['status']) => {
      if (status === 'checked_in') {
        return 'text-emerald-300';
      }

      if (status === 'revoked') {
        return 'text-red-300';
      }

      return 'text-amber-200';
    };

  return (
    <div className="page-in space-y-7">

      {/* HERO */}
      <section className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">

        <div className="relative px-1 py-3 md:py-5">

          <p className="hero-kicker">
            Command center
          </p>

          <h1 className="hero-title font-display mt-3 max-w-4xl text-5xl leading-[.94] text-white sm:text-6xl xl:text-7xl">
            Welcome Back,
            <br />
            <span className="text-zinc-300">
              VYRA Entertainment
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-[10px] uppercase tracking-[.27em] text-zinc-600 sm:text-xs">
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

        {/* EVENT */}
        <div className="event-card glass rounded-[28px] p-5 md:p-6">

          <div className="flex items-start justify-between">

            <div>
              <p className="text-[9px] uppercase tracking-[.3em] text-zinc-600">
                Current event
              </p>

              <h2 className="font-display mt-2 text-4xl text-zinc-100">
                {ev.name}
              </h2>
            </div>

            <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[.045] p-3 text-amber-200">
              <Icon
                name="calendar"
                size={20}
              />
            </div>

          </div>

          <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-5">

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

          <div className="mt-6 h-px bg-gradient-to-r from-amber-300/30 via-white/[.05] to-transparent" />

        </div>
      </section>

      {/* STATS */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

        {stats.map((stat) => (
          <div
            key={stat.label}
            className="stat-card glass rounded-[24px] p-5"
          >

            <div className={`mb-7 ${stat.accent}`}>
              <Icon
                name={stat.icon}
                size={23}
              />
            </div>

            <p className="text-[9px] uppercase tracking-[.25em] text-zinc-600">
              {stat.label}
            </p>

            <p className="mt-2 text-4xl font-medium tracking-tight text-white">
              {stat.value}
            </p>

            <div className="mt-5 h-px w-1/2 bg-gradient-to-r from-current to-transparent opacity-50" />

          </div>
        ))}

      </section>

      {/* LOWER */}
      <section className="grid gap-5 xl:grid-cols-[1.4fr_.8fr]">

        {/* RECENT */}
        <div className="glass rounded-[26px] p-5 md:p-6">

          <div className="mb-5 flex items-end justify-between gap-4">

            <div>
              <p className="text-[9px] uppercase tracking-[.3em] text-zinc-600">
                Guest activity
              </p>

              <h3 className="font-display mt-1 text-3xl">
                Recent Guests
              </h3>
            </div>

            <Link
              to="/guests"
              className="rounded-full border border-white/[.07] px-3 py-2 text-[10px] uppercase tracking-[.15em] text-zinc-500 transition hover:border-amber-300/20 hover:text-amber-200"
            >
              View all
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

              <table className="w-full min-w-[560px] text-left">

                <thead className="text-[9px] uppercase tracking-[.18em] text-zinc-600">
                  <tr>
                    <th className="px-3 py-3">
                      Guest
                    </th>

                    <th className="px-3 py-3">
                      Type
                    </th>

                    <th className="px-3 py-3">
                      Status
                    </th>

                    <th className="px-3 py-3">
                      Check-in
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((guest) => (
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

                      <td className="px-3 py-4">

                        <span
                          className={`inline-flex items-center gap-2 text-xs ${statusClass(guest.status)}`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {statusText(
                            guest.status
                          )}
                        </span>

                      </td>

                      <td className="px-3 py-4 text-xs text-zinc-600">
                        {guest.checked_in_at
                          ? time(
                              guest.checked_in_at
                            )
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>

              </table>

            </div>
          )}

        </div>

        {/* QUICK ACTIONS */}
        <div className="glass rounded-[26px] p-5 md:p-6">

          <div className="mb-5">
            <p className="text-[9px] uppercase tracking-[.3em] text-zinc-600">
              Shortcuts
            </p>

            <h3 className="font-display mt-1 text-3xl">
              Quick Actions
            </h3>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">

            <Link
              to="/create"
              className="quick-card rounded-2xl border border-amber-300/10 bg-amber-300/[.025] p-4"
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
                  className="text-zinc-700"
                />
              </div>

              <p className="mt-7 text-sm font-medium">
                Create Pass
              </p>

              <p className="mt-1 text-xs text-zinc-600">
                Generate a new guest entry pass
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

              <p className="mt-7 text-sm font-medium">
                View Guests
              </p>

              <p className="mt-1 text-xs text-zinc-600">
                Search and manage guest passes
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

              <p className="mt-7 text-sm font-medium">
                Event Settings
              </p>

              <p className="mt-1 text-xs text-zinc-600">
                Update event information
              </p>
            </Link>

          </div>
        </div>

      </section>

      {/* FOOT */}
      <div className="flex items-center gap-4 pb-4 pt-2 text-[9px] uppercase tracking-[.42em] text-zinc-700">
        <span className="h-px flex-1 bg-gradient-to-r from-transparent to-amber-300/20" />
        BEYOND THE ORDINARY
        <span className="h-px flex-1 bg-gradient-to-l from-transparent to-amber-300/20" />
      </div>

    </div>
  );
}