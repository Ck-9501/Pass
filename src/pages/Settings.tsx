import {
  useEffect,
  useState,
} from 'react';

import toast from 'react-hot-toast';

import {
  supabase,
  EventRow,
} from '../lib/supabase';

import Icon from '../components/Icon';

interface SettingsProps {
  ev: EventRow | null;
  onSaved: (event: EventRow) => void;
}

export default function Settings({
  ev,
  onSaved,
}: SettingsProps) {

  const [name, setName] =
    useState(ev?.name ?? '');

  const [date, setDate] =
    useState(ev?.date ?? '');

  const [time, setTime] =
    useState(ev?.time ?? '');

  const [venue, setVenue] =
    useState(ev?.venue ?? '');

  const [organizer, setOrganizer] =
    useState(ev?.organizer ?? '');

  const [saving, setSaving] =
    useState(false);

  useEffect(() => {

    setName(ev?.name ?? '');
    setDate(ev?.date ?? '');
    setTime(ev?.time ?? '');
    setVenue(ev?.venue ?? '');
    setOrganizer(
      ev?.organizer ?? ''
    );

  }, [ev]);

  async function save(
    e: React.FormEvent<HTMLFormElement>
  ) {

    e.preventDefault();

    if (!name.trim()) {
      toast.error(
        'Party name is required.'
      );
      return;
    }

    setSaving(true);

    const row = {
      name: name.trim(),
      date: date || null,
      time: time || null,
      venue: venue.trim() || null,
      organizer:
        organizer.trim() || null,
    };

    const query = ev
      ? supabase
          .from('events')
          .update(row)
          .eq('id', ev.id)
      : supabase
          .from('events')
          .insert(row);

    const {
      data,
      error,
    } = await query
      .select()
      .single();

    setSaving(false);

    if (error) {

      console.error(error);

      toast.error(
        error.message ||
          'Could not save event.'
      );

      return;
    }

    onSaved(data);

    toast.success(
      'Event saved successfully.'
    );

  }

  const field =
    'rounded-2xl px-4 py-3.5';

  return (
    <div className="page-in max-w-5xl">

      <div className="glass rounded-[28px] p-5 sm:p-7 md:p-8">

        {/* HEADER */}

        <div className="flex items-start justify-between gap-5 border-b border-white/[.07] pb-7">

          <div>

            <p className="text-[9px] uppercase tracking-[.34em] text-amber-200/60">
              Event Configuration
            </p>

            <h2 className="font-display mt-2 text-4xl sm:text-5xl">
              Event Settings
            </h2>

            <p className="mt-2 max-w-xl text-sm text-zinc-500">
              These details appear throughout your dashboard and guest passes.
            </p>

          </div>

          <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[.04] p-3 text-amber-200">
            <Icon
              name="settings"
              size={21}
            />
          </div>

        </div>

        {/* FORM */}

        <form
          onSubmit={save}
          className="mt-8 grid gap-5 md:grid-cols-2"
        >

          {/* PARTY NAME */}

          <div className="md:col-span-2">

            <label className="mb-2 block text-[9px] uppercase tracking-[.23em] text-zinc-500">
              Party Name *
            </label>

            <input
              className={field}
              value={name}
              onChange={(e) =>
                setName(
                  e.target.value
                )
              }
              placeholder="Paradise Affair"
            />

          </div>

          {/* DATE */}

          <div>

            <label className="mb-2 block text-[9px] uppercase tracking-[.23em] text-zinc-500">
              Date
            </label>

            <input
              type="date"
              className={field}
              value={date}
              onChange={(e) =>
                setDate(
                  e.target.value
                )
              }
            />

          </div>

          {/* TIME */}

          <div>

            <label className="mb-2 block text-[9px] uppercase tracking-[.23em] text-zinc-500">
              Time
            </label>

            <input
              type="time"
              className={field}
              value={time}
              onChange={(e) =>
                setTime(
                  e.target.value
                )
              }
            />

          </div>

          {/* VENUE */}

          <div>

            <label className="mb-2 block text-[9px] uppercase tracking-[.23em] text-zinc-500">
              Venue
            </label>

            <input
              className={field}
              value={venue}
              onChange={(e) =>
                setVenue(
                  e.target.value
                )
              }
              placeholder="1522 Kammanahalli"
            />

          </div>

          {/* ORGANIZER */}

          <div>

            <label className="mb-2 block text-[9px] uppercase tracking-[.23em] text-zinc-500">
              Organizer
            </label>

            <input
              className={field}
              value={organizer}
              onChange={(e) =>
                setOrganizer(
                  e.target.value
                )
              }
              placeholder="VYRA Entertainment"
            />

          </div>

          {/* SAVE */}

          <div className="md:col-span-2">

            <div className="mt-3 flex flex-col gap-4 border-t border-white/[.06] pt-6 sm:flex-row sm:items-center sm:justify-between">

              <div>

                <p className="text-xs text-zinc-500">
                  Event information is used dynamically in new guest passes.
                </p>

                <p className="mt-1 text-[10px] uppercase tracking-[.18em] text-zinc-700">
                  Beyond the Ordinary
                </p>

              </div>

              <button
                type="submit"
                disabled={saving}
                className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-300 px-6 py-3.5 font-semibold text-black shadow-[0_12px_35px_rgba(226,177,93,.13)] transition hover:brightness-105 disabled:opacity-50"
              >
                {saving
                  ? 'SAVING…'
                  : 'SAVE EVENT'}

                <Icon
                  name="check"
                  size={17}
                />
              </button>

            </div>

          </div>

        </form>

      </div>

    </div>
  );
}