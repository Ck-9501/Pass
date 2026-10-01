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
  events: EventRow[];
  onSaved: (event: EventRow) => void;
  onSelected: (event: EventRow) => void;
}

export default function Settings({
  ev,
  events,
  onSaved,
  onSelected,
}: SettingsProps) {
  const [editingId, setEditingId] =
    useState<string | null>(
      ev?.id ?? null
    );

  const [name, setName] =
    useState(
      ev?.name ?? ''
    );

  const [date, setDate] =
    useState(
      ev?.date ?? ''
    );

  const [time, setTime] =
    useState(
      ev?.time ?? ''
    );

  const [venue, setVenue] =
    useState(
      ev?.venue ?? ''
    );

  const [organizer, setOrganizer] =
    useState(
      ev?.organizer ?? ''
    );

  const [saving, setSaving] =
    useState(false);

  const [creating, setCreating] =
    useState(!ev);

  useEffect(() => {
    if (!ev) {
      setEditingId(null);
      setCreating(true);
      setName('');
      setDate('');
      setTime('');
      setVenue('');
      setOrganizer('');
      return;
    }

    setEditingId(ev.id);
    setCreating(false);

    setName(ev.name ?? '');
    setDate(ev.date ?? '');
    setTime(ev.time ?? '');
    setVenue(ev.venue ?? '');
    setOrganizer(
      ev.organizer ?? ''
    );
  }, [ev]);

  function selectEvent(
    event: EventRow
  ) {
    setEditingId(event.id);
    setCreating(false);

    setName(event.name ?? '');
    setDate(event.date ?? '');
    setTime(event.time ?? '');
    setVenue(event.venue ?? '');
    setOrganizer(
      event.organizer ?? ''
    );

    onSelected(event);
  }

  function createNewEvent() {
    setEditingId(null);
    setCreating(true);

    setName('');
    setDate('');
    setTime('');
    setVenue('');
    setOrganizer('');
  }

  async function save(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (!name.trim()) {
      toast.error(
        'Event name is required.'
      );
      return;
    }

    setSaving(true);

    const eventData = {
      name: name.trim(),
      date: date || null,
      time: time || null,
      venue:
        venue.trim() || null,
      organizer:
        organizer.trim() || null,
    };

    let result;

    if (editingId) {
      result = await supabase
        .from('events')
        .update(eventData)
        .eq('id', editingId)
        .select()
        .single();
    } else {
      result = await supabase
        .from('events')
        .insert(eventData)
        .select()
        .single();
    }

    setSaving(false);

    if (result.error) {
      console.error(
        'Event save error:',
        result.error
      );

      toast.error(
        result.error.message ||
          'Could not save event.'
      );

      return;
    }

    const savedEvent =
      result.data as EventRow;

    setEditingId(
      savedEvent.id
    );

    setCreating(false);

    onSaved(savedEvent);
    onSelected(savedEvent);

    toast.success(
      editingId
        ? 'Event updated successfully.'
        : 'New event created successfully.'
    );
  }

  async function deleteEvent(
    event: EventRow
  ) {
    const confirmed =
      window.confirm(
        `Delete "${event.name}"?\n\nThis will permanently delete the event and may affect its guest passes.`
      );

    if (!confirmed) {
      return;
    }

    const {
      data,
      error,
    } = await supabase
      .from('events')
      .delete()
      .eq('id', event.id)
      .select('id')
      .maybeSingle();

    if (error) {
      console.error(
        'Delete event error:',
        error
      );

      toast.error(
        error.message ||
          'Could not delete event.'
      );

      return;
    }

    if (!data) {
      toast.error(
        'Event was not deleted. Check your Supabase DELETE policy.'
      );

      return;
    }

    toast.success(
      'Event deleted.'
    );

    const remaining =
      events.filter(
        (item) =>
          item.id !== event.id
      );

    if (ev?.id === event.id) {

      if (remaining.length) {

        selectEvent(
          remaining[0]
        );

      } else {

        createNewEvent();

      }
    }
  }

  return (
    <div className="page-in space-y-6">

      {/* ==================================
          EVENT LIST
      ================================== */}

      <section className="glass rounded-[28px] p-5 md:p-7">

        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">

          <div>

            <p className="text-[10px] uppercase tracking-[.34em] text-amber-200/60">
              Event Management
            </p>

            <h1 className="font-display mt-2 text-4xl md:text-5xl">
              Your Events
            </h1>

            <p className="mt-2 max-w-xl text-sm text-zinc-500">
              Create, edit and switch between multiple VYRA events.
            </p>

          </div>

          <button
            type="button"
            onClick={createNewEvent}
            className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-300 px-5 py-3.5 font-semibold text-black shadow-[0_12px_35px_rgba(226,177,93,.12)] transition hover:brightness-105"
          >
            <span className="text-xl">
              +
            </span>

            New Event
          </button>

        </div>

        {events.length > 0 ? (

          <div className="mt-7 grid gap-3 md:grid-cols-2 xl:grid-cols-3">

            {events.map(
              (event) => {

                const selected =
                  event.id ===
                  ev?.id;

                return (
                  <div
                    key={event.id}
                    className={`relative rounded-2xl border p-4 transition ${
                      selected
                        ? 'border-amber-300/30 bg-amber-300/[.045] shadow-[0_15px_45px_rgba(222,171,86,.05)]'
                        : 'border-white/[.07] bg-white/[.015] hover:border-white/[.14]'
                    }`}
                  >

                    {/* SELECT */}
                    <button
                      type="button"
                      onClick={() =>
                        selectEvent(
                          event
                        )
                      }
                      className="w-full text-left"
                    >

                      <div className="flex items-start justify-between gap-3">

                        <div>

                          <p className="text-[9px] uppercase tracking-[.2em] text-zinc-600">
                            {selected
                              ? 'Current Event'
                              : 'Event'}
                          </p>

                          <h3 className="font-display mt-1 pr-3 text-2xl text-zinc-100">
                            {event.name}
                          </h3>

                        </div>

                        <div
                          className={`rounded-xl border p-2 ${
                            selected
                              ? 'border-amber-300/20 text-amber-200'
                              : 'border-white/[.07] text-zinc-600'
                          }`}
                        >
                          <Icon
                            name="calendar"
                            size={17}
                          />
                        </div>

                      </div>

                      <div className="mt-5 space-y-2.5 text-xs text-zinc-500">

                        <div className="flex items-center gap-2">
                          <Icon
                            name="calendar"
                            size={13}
                          />
                          {event.date ||
                            'Date not set'}
                        </div>

                        <div className="flex items-center gap-2">
                          <Icon
                            name="clock"
                            size={13}
                          />
                          {event.time ||
                            'Time not set'}
                        </div>

                        <div className="flex items-center gap-2">
                          <Icon
                            name="pin"
                            size={13}
                          />
                          {event.venue ||
                            'Venue not set'}
                        </div>

                      </div>

                    </button>

                    {/* ACTIONS */}

                    <div className="mt-4 flex items-center justify-between border-t border-white/[.06] pt-3">

                      <button
                        type="button"
                        onClick={() =>
                          selectEvent(
                            event
                          )
                        }
                        className="text-[9px] uppercase tracking-[.18em] text-zinc-500 transition hover:text-amber-200"
                      >
                        Edit Event
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          deleteEvent(
                            event
                          )
                        }
                        className="text-[9px] uppercase tracking-[.18em] text-red-300/70 transition hover:text-red-300"
                      >
                        Delete
                      </button>

                    </div>

                  </div>
                );
              }
            )}

          </div>

        ) : (

          <div className="mt-7 rounded-2xl border border-dashed border-white/[.08] p-10 text-center">

            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-white/[.08] text-zinc-600">

              <Icon
                name="calendar"
                size={23}
              />

            </div>

            <p className="mt-4 text-sm text-zinc-400">
              No events yet.
            </p>

            <p className="mt-1 text-xs text-zinc-600">
              Create your first VYRA event.
            </p>

          </div>

        )}

      </section>


      {/* ==================================
          EVENT EDITOR
      ================================== */}

      <section className="glass rounded-[28px] p-5 md:p-7">

        <div className="flex items-start justify-between gap-4 border-b border-white/[.07] pb-6">

          <div>

            <p className="text-[10px] uppercase tracking-[.3em] text-zinc-600">
              {creating
                ? 'Create Event'
                : 'Edit Event'}
            </p>

            <h2 className="font-display mt-1 text-3xl md:text-4xl">
              {creating
                ? 'New Event'
                : name || 'Event Details'}
            </h2>

          </div>

          {!creating &&
            ev && (
              <div className="rounded-full border border-emerald-300/15 bg-emerald-300/[.035] px-3 py-1.5 text-[9px] uppercase tracking-[.2em] text-emerald-300">
                Active
              </div>
            )}

        </div>


        <form
          onSubmit={save}
          className="mt-7 grid gap-5 md:grid-cols-2"
        >

          {/* NAME */}

          <div className="md:col-span-2">

            <label className="mb-2 block text-[10px] uppercase tracking-[.22em] text-zinc-500">
              Party Name *
            </label>

            <input
              type="text"
              value={name}
              onChange={(e) =>
                setName(
                  e.target.value
                )
              }
              placeholder="Paradise Affair"
              className="rounded-2xl px-4 py-3.5"
            />

          </div>


          {/* DATE */}

          <div>

            <label className="mb-2 block text-[10px] uppercase tracking-[.22em] text-zinc-500">
              Date
            </label>

            <input
              type="date"
              value={date}
              onChange={(e) =>
                setDate(
                  e.target.value
                )
              }
              className="rounded-2xl px-4 py-3.5"
            />

          </div>


          {/* TIME */}

          <div>

            <label className="mb-2 block text-[10px] uppercase tracking-[.22em] text-zinc-500">
              Time
            </label>

            <input
              type="time"
              value={time}
              onChange={(e) =>
                setTime(
                  e.target.value
                )
              }
              className="rounded-2xl px-4 py-3.5"
            />

          </div>


          {/* VENUE */}

          <div>

            <label className="mb-2 block text-[10px] uppercase tracking-[.22em] text-zinc-500">
              Venue
            </label>

            <input
              type="text"
              value={venue}
              onChange={(e) =>
                setVenue(
                  e.target.value
                )
              }
              placeholder="1522 Kammanahalli"
              className="rounded-2xl px-4 py-3.5"
            />

          </div>


          {/* ORGANIZER */}

          <div>

            <label className="mb-2 block text-[10px] uppercase tracking-[.22em] text-zinc-500">
              Organizer
            </label>

            <input
              type="text"
              value={organizer}
              onChange={(e) =>
                setOrganizer(
                  e.target.value
                )
              }
              placeholder="VYRA Entertainment"
              className="rounded-2xl px-4 py-3.5"
            />

          </div>


          {/* FOOT ACTIONS */}

          <div className="md:col-span-2">

            <div className="mt-3 flex flex-col gap-4 border-t border-white/[.06] pt-6 sm:flex-row sm:items-center sm:justify-between">

              <div>

                <p className="text-xs text-zinc-500">
                  Each event has its own guests, passes and check-ins.
                </p>

                <p className="mt-1 text-[9px] uppercase tracking-[.2em] text-zinc-700">
                  Beyond the Ordinary
                </p>

              </div>

              <div className="flex gap-2">

                {creating &&
                  ev && (
                    <button
                      type="button"
                      onClick={() =>
                        selectEvent(
                          ev
                        )
                      }
                      className="action-btn"
                    >
                      Cancel
                    </button>
                  )}

                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-300 px-6 py-3.5 font-semibold text-black shadow-[0_12px_35px_rgba(226,177,93,.12)] transition hover:brightness-105 disabled:opacity-50"
                >

                  {saving
                    ? 'SAVING…'
                    : creating
                      ? 'CREATE EVENT'
                      : 'SAVE CHANGES'}

                  <Icon
                    name="check"
                    size={17}
                  />

                </button>

              </div>

            </div>

          </div>

        </form>

      </section>

    </div>
  );
}