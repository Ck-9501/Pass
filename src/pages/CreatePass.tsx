import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  supabase,
  EventRow,
  Guest,
} from '../lib/supabase';
import {
  newPassId,
  newToken,
  qrDataUrl,
  downloadPdf,
  waLink,
} from '../lib/pass';
import Icon from '../components/Icon';

export default function CreatePass({
  ev,
}: {
  ev: EventRow;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState('Regular');
  const [notes, setNotes] = useState('');

  const [g, setG] = useState<Guest | null>(null);
  const [qr, setQr] = useState('');
  const [busy, setBusy] = useState(false);

  /*
   * Keep the existing pass categories in the system,
   * but DO NOT display the pass type on the actual ticket design.
   */
  const passTypes = [
    'Regular',
    'Early Bird',
    'Couple',
    'Surge Pass',
  ];

  async function gen(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Please enter the guest name.');
      return;
    }

    setBusy(true);

    for (let i = 0; i < 5; i++) {
      const passId = newPassId();
      const token = newToken();

      const {
        data,
        error,
      } = await supabase
        .from('guests')
        .insert({
          event_id: ev.id,
          name: name.trim(),
          phone: phone.trim() || null,
          pass_type: type,
          notes: notes.trim() || null,
          pass_id: passId,
          qr_token: token,
        })
        .select()
        .single();

      if (!error) {
        setG(data);
        setQr(await qrDataUrl(data.qr_token));

        setBusy(false);

        toast.success(
          'Pass generated successfully.'
        );

        return;
      }

      console.error(
        'Create pass error:',
        error
      );

      if (error.code !== '23505') {
        setBusy(false);

        toast.error(
          error.message ||
            'Could not save the pass.'
        );

        return;
      }
    }

    setBusy(false);

    toast.error(
      'Could not create a unique pass. Please retry.'
    );
  }

  async function pdf() {
    if (!g) return;

    try {
      await downloadPdf(g, ev);
    } catch (error) {
      console.error(
        'PDF error:',
        error
      );

      toast.error(
        'PDF could not be generated.'
      );
    }
  }

  async function revoke() {
    if (!g) return;

    const confirmed =
      window.confirm(
        `Revoke ${g.name}'s pass?\n\nThis pass will no longer be valid at the entrance.`
      );

    if (!confirmed) return;

    const {
      data,
      error,
    } = await supabase
      .from('guests')
      .update({
        status: 'revoked',
      })
      .eq('id', g.id)
      .select('id,status')
      .maybeSingle();

    if (error) {
      console.error(
        'Revoke error:',
        error
      );

      toast.error(
        error.message ||
          'Could not revoke the pass.'
      );

      return;
    }

    if (!data) {
      toast.error(
        'Pass was not updated.'
      );

      return;
    }

    setG({
      ...g,
      status: 'revoked',
    });

    toast.success(
      'Pass revoked successfully.'
    );
  }

  /*
   * Converts the database date into a clean display.
   * Example:
   * 2026-10-05 → 05 OCT 2026
   */
  function formatDate(
    value?: string | null
  ) {
    if (!value) return '—';

    const date = new Date(
      `${value}T00:00:00`
    );

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return value;
    }

    return date
      .toLocaleDateString(
        'en-IN',
        {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }
      )
      .toUpperCase();
  }

  /*
   * Converts the database time into:
   * 18:30 → 6:30 PM
   */
  function formatTime(
    value?: string | null
  ) {
    if (!value) return '—';

    const [hours, minutes] =
      value.split(':');

    const h = Number(hours);
    const m = Number(minutes);

    if (
      Number.isNaN(h) ||
      Number.isNaN(m)
    ) {
      return value;
    }

    const date = new Date();

    date.setHours(
      h,
      m,
      0,
      0
    );

    return date.toLocaleTimeString(
      'en-IN',
      {
        hour: 'numeric',
        minute: '2-digit',
      }
    );
  }

  const field =
    'w-full rounded-2xl px-4 py-3.5';

  return (
    <div className="page-in grid gap-6 xl:grid-cols-[.78fr_1.22fr]">

      {/* ==============================
          LEFT — CREATE FORM
      ============================== */}

      <section className="glass rounded-[28px] p-5 md:p-7">

        <div className="mb-7 flex items-start justify-between">

          <div>
            <p className="text-[10px] uppercase tracking-[.34em] text-amber-200/60">
              Guest access
            </p>

            <h2 className="font-display mt-2 text-4xl">
              Create Pass
            </h2>

            <p className="mt-2 text-sm text-zinc-500">
              Create a unique entry pass for your guest.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[.04] p-3 text-amber-200">
            <Icon
              name="ticket"
              size={21}
            />
          </div>

        </div>

        <form
          onSubmit={gen}
          className="space-y-4"
        >

          {/* GUEST NAME */}

          <div>
            <label className="mb-2 block text-[10px] uppercase tracking-[.22em] text-zinc-500">
              Guest name *
            </label>

            <input
              className={field}
              type="text"
              placeholder="e.g. Rahul Sharma"
              value={name}
              onChange={(e) =>
                setName(e.target.value)
              }
            />
          </div>

          {/* PHONE */}

          <div>
            <label className="mb-2 block text-[10px] uppercase tracking-[.22em] text-zinc-500">
              Phone
            </label>

            <input
              className={field}
              type="text"
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(e) =>
                setPhone(e.target.value)
              }
            />
          </div>

          {/* PASS CATEGORY */}

          <div>
            <label className="mb-2 block text-[10px] uppercase tracking-[.22em] text-zinc-500">
              Pass category
            </label>

            <select
              className={field}
              value={type}
              onChange={(e) =>
                setType(
                  e.target.value
                )
              }
            >
              {passTypes.map(
                (passType) => (
                  <option
                    key={passType}
                    value={passType}
                  >
                    {passType}
                  </option>
                )
              )}
            </select>
          </div>

          {/* NOTES */}

          <div>
            <label className="mb-2 block text-[10px] uppercase tracking-[.22em] text-zinc-500">
              Notes
            </label>

            <textarea
              rows={4}
              className={field}
              placeholder="Optional notes"
              value={notes}
              onChange={(e) =>
                setNotes(
                  e.target.value
                )
              }
            />
          </div>

          {/* BUTTON */}

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-300 px-4 py-4 font-semibold text-black shadow-[0_12px_34px_rgba(222,171,86,.14)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy
              ? 'GENERATING…'
              : 'GENERATE PASS'}

            <Icon
              name="chevron"
              size={18}
            />
          </button>

        </form>
      </section>


      {/* ==============================
          RIGHT — PASS PREVIEW
      ============================== */}

      <section className="glass rounded-[28px] p-5 md:p-7">

        <div className="mb-7">

          <p className="text-[10px] uppercase tracking-[.34em] text-amber-200/60">
            Live preview
          </p>

          <h2 className="font-display mt-2 text-4xl">
            Your Guest Pass
          </h2>

        </div>

        {!g ? (

          <div className="grid min-h-[650px] place-items-center rounded-[25px] border border-dashed border-white/[.08] bg-black/10 p-8 text-center">

            <div>

              <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl border border-white/[.08] bg-white/[.025] text-zinc-500">

                <Icon
                  name="spark"
                  size={26}
                />

              </div>

              <p className="text-lg text-zinc-300">
                Pass preview appears here
              </p>

              <p className="mt-2 max-w-xs text-sm text-zinc-600">
                Generate a pass to see the final guest ticket.
              </p>

            </div>

          </div>

        ) : (

          <div className="space-y-4">

            {/* =================================
                ACTUAL DIGITAL PASS
            ================================= */}

            <div className="ticket-card relative mx-auto max-w-[490px] overflow-hidden rounded-[30px] border border-amber-200/20 bg-[radial-gradient(circle_at_50%_0%,rgba(195,143,58,.13),transparent_35%),linear-gradient(180deg,#0b0906,#020304_65%,#080a0d)] p-6 shadow-[0_30px_100px_rgba(0,0,0,.6)] sm:p-8">

              {/* TOP GOLD LINE */}

              <div className="absolute left-8 right-8 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/80 to-transparent" />

              {/* TOP */}

              <div className="relative z-10 flex items-start justify-between gap-4">

                <div>

                  <img
                    src="/vyra-logo.jpg"
                    alt="VYRA Entertainment"
                    className="h-12 w-auto max-w-[170px] object-contain mix-blend-screen"
                  />

                  <p className="mt-1 text-[8px] uppercase tracking-[.35em] text-amber-200/55">
                    Beyond the ordinary
                  </p>
                </div>

                <div className="rounded-full border border-amber-300/20 bg-amber-300/[.04] px-3 py-1.5 text-[8px] uppercase tracking-[.25em] text-amber-200">
                  Entry Pass
                </div>

              </div>


              {/* DECORATIVE ORBIT */}

              <div className="pointer-events-none absolute left-1/2 top-[120px] h-28 w-64 -translate-x-1/2 rotate-[-8deg] rounded-[50%] border border-amber-200/[.08]" />

              <div className="pointer-events-none absolute left-1/2 top-[124px] h-20 w-52 -translate-x-1/2 rotate-[8deg] rounded-[50%] border border-blue-200/[.06]" />


              {/* EVENT NAME */}

              <div className="relative z-10 mt-14 text-center">

                <p className="text-[9px] uppercase tracking-[.38em] text-zinc-600">
                  You are invited to
                </p>

                <h3 className="font-display mt-2 text-4xl leading-none text-white sm:text-5xl">
                  {ev.name}
                </h3>

              </div>


              {/* GUEST */}

              <div className="relative z-10 mt-10">

                <p className="text-[9px] uppercase tracking-[.28em] text-amber-200/55">
                  Guest
                </p>

                <p className="font-display mt-1 break-words text-4xl leading-none text-zinc-100 sm:text-5xl">
                  {g.name}
                </p>

              </div>


              {/* DIVIDER */}

              <div className="relative z-10 my-7 flex items-center gap-3">

                <span className="h-px flex-1 bg-gradient-to-r from-transparent to-amber-200/30" />

                <span className="h-1 w-1 rotate-45 bg-amber-200/60" />

                <span className="h-px flex-1 bg-gradient-to-l from-transparent to-amber-200/30" />

              </div>


              {/* EVENT DETAILS */}

              <div className="relative z-10 grid grid-cols-3 gap-3">

                {/* DATE */}

                <div className="rounded-2xl border border-white/[.06] bg-white/[.018] p-3">

                  <div className="mb-2 text-amber-200/75">
                    <Icon
                      name="calendar"
                      size={17}
                    />
                  </div>

                  <p className="text-[8px] uppercase tracking-[.18em] text-zinc-600">
                    Date
                  </p>

                  <p className="mt-1 text-xs font-medium leading-tight text-zinc-200">
                    {formatDate(
                      ev.date
                    )}
                  </p>

                </div>


                {/* VENUE */}

                <div className="rounded-2xl border border-white/[.06] bg-white/[.018] p-3">

                  <div className="mb-2 text-amber-200/75">
                    <Icon
                      name="pin"
                      size={17}
                    />
                  </div>

                  <p className="text-[8px] uppercase tracking-[.18em] text-zinc-600">
                    Venue
                  </p>

                  <p className="mt-1 break-words text-xs font-medium leading-tight text-zinc-200">
                    {ev.venue || '—'}
                  </p>

                </div>


                {/* TIME */}

                <div className="rounded-2xl border border-white/[.06] bg-white/[.018] p-3">

                  <div className="mb-2 text-amber-200/75">
                    <Icon
                      name="clock"
                      size={17}
                    />
                  </div>

                  <p className="text-[8px] uppercase tracking-[.18em] text-zinc-600">
                    Time
                  </p>

                  <p className="mt-1 text-xs font-medium leading-tight text-zinc-200">
                    {formatTime(
                      ev.time
                    )}
                  </p>

                </div>

              </div>


              {/* QR AREA */}

              <div className="relative z-10 mt-7 rounded-3xl border border-amber-200/15 bg-black/35 p-5">

                <div className="grid place-items-center">

                  <div className="rounded-[22px] border border-amber-300/40 bg-white p-3 shadow-[0_0_45px_rgba(222,171,86,.13)]">

                    <img
                      src={qr}
                      alt="Guest QR code"
                      className="w-44 sm:w-48"
                    />

                  </div>

                  <p className="mt-4 text-[9px] uppercase tracking-[.4em] text-amber-200/65">
                    Scan to enter
                  </p>

                </div>

              </div>


              {/* PASS ID */}

              <div className="relative z-10 mt-6 flex items-end justify-between gap-5">

                <div>

                  <p className="text-[8px] uppercase tracking-[.28em] text-zinc-600">
                    Pass ID
                  </p>

                  <p className="mt-1 font-mono text-xs tracking-wider text-zinc-200 sm:text-sm">
                    {g.pass_id}
                  </p>

                </div>

                <p className="font-display text-lg text-amber-100/45">
                  VYRA
                </p>

              </div>


              {/* TAGLINE */}

              <div className="relative z-10 mt-8 border-t border-white/[.06] pt-5 text-center">

                <p className="text-[9px] uppercase tracking-[.42em] text-amber-200/65">
                  Beyond the ordinary
                </p>

              </div>


              {/* BOTTOM GLOW */}

              <div className="pointer-events-none absolute bottom-[-100px] left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-amber-400/[.07] blur-[80px]" />

            </div>


            {/* ACTIONS */}

            <div className="flex flex-wrap justify-center gap-2">

              <button
                onClick={pdf}
                className="action-btn"
              >
                <Icon
                  name="download"
                  size={16}
                />
                PDF
              </button>

              <a
                href={waLink(g, ev)}
                target="_blank"
                rel="noreferrer"
                className="action-btn"
              >
                <Icon
                  name="whatsapp"
                  size={16}
                />
                WhatsApp
              </a>

              <button
                onClick={() =>
                  navigator.clipboard
                    .writeText(
                      g.pass_id
                    )
                    .then(() =>
                      toast.success(
                        'Pass ID copied.'
                      )
                    )
                    .catch(() =>
                      toast.error(
                        'Could not copy ID.'
                      )
                    )
                }
                className="action-btn"
              >
                <Icon
                  name="copy"
                  size={16}
                />
                Copy ID
              </button>

              {g.status !==
                'revoked' && (
                <button
                  onClick={revoke}
                  className="action-btn danger"
                >
                  Revoke
                </button>
              )}

            </div>

            <p className="text-center text-[11px] text-zinc-600">
              Download the PDF and send it to your guest.
            </p>

          </div>

        )}

      </section>

    </div>
  );
}