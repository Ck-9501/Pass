import {
  useState,
} from 'react';

import toast from 'react-hot-toast';

import {
  supabase,
} from '../lib/supabase';

import Icon from '../components/Icon';

export default function Login() {

  const [email, setEmail] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [loading, setLoading] =
    useState(false);

  async function signIn(
    e: React.FormEvent<HTMLFormElement>
  ) {

    e.preventDefault();

    if (
      !email.trim() ||
      !password
    ) {
      toast.error(
        'Enter your email and password.'
      );
      return;
    }

    setLoading(true);

    const { error } =
      await supabase.auth.signInWithPassword(
        {
          email: email.trim(),
          password,
        }
      );

    setLoading(false);

    if (error) {
      toast.error(
        'Incorrect email or password.'
      );
    }

  }

  return (
    <div className="relative grid min-h-screen place-items-center p-5">

      <div className="w-full max-w-[440px]">

        {/* LOGO */}

        <div className="mb-8 text-center">

          <img
            src="/vyra-logo.jpg"
            alt="VYRA Entertainment"
            className="mx-auto w-[235px] mix-blend-screen"
          />

          <p className="mt-4 text-[9px] uppercase tracking-[.45em] text-amber-200/50">
            Beyond the ordinary
          </p>

        </div>

        {/* CARD */}

        <form
          onSubmit={signIn}
          className="glass page-in rounded-[30px] p-6 sm:p-8"
        >

          <div className="flex items-start justify-between gap-4">

            <div>

              <p className="text-[9px] uppercase tracking-[.34em] text-zinc-600">
                Private access
              </p>

              <h1 className="font-display mt-2 text-4xl sm:text-5xl">
                PartyPass
              </h1>

              <p className="mt-2 text-sm text-zinc-500">
                Event management for VYRA Entertainment.
              </p>

            </div>

            <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[.035] p-3 text-amber-200">
              <Icon
                name="spark"
                size={21}
              />
            </div>

          </div>

          <div className="my-7 h-px bg-gradient-to-r from-transparent via-white/[.08] to-transparent" />

          {/* EMAIL */}

          <div className="space-y-5">

            <div>

              <label className="mb-2 block text-[9px] uppercase tracking-[.24em] text-zinc-500">
                Email
              </label>

              <input
                required
                type="email"
                value={email}
                onChange={(e) =>
                  setEmail(
                    e.target.value
                  )
                }
                placeholder="admin@vyra.com"
                className="rounded-2xl px-4 py-3.5"
              />

            </div>

            {/* PASSWORD */}

            <div>

              <label className="mb-2 block text-[9px] uppercase tracking-[.24em] text-zinc-500">
                Password
              </label>

              <input
                required
                type="password"
                value={password}
                onChange={(e) =>
                  setPassword(
                    e.target.value
                  )
                }
                placeholder="••••••••"
                className="rounded-2xl px-4 py-3.5"
              />

            </div>

            {/* LOGIN */}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-300 px-4 py-4 font-semibold text-black shadow-[0_12px_40px_rgba(226,177,93,.12)] transition hover:brightness-105 disabled:opacity-50"
            >
              {loading
                ? 'SIGNING IN…'
                : 'SIGN IN'}

              <Icon
                name="chevron"
                size={17}
              />
            </button>

          </div>

          {/* FOOT */}

          <div className="mt-7 flex items-center gap-3">

            <span className="h-px flex-1 bg-white/[.07]" />

            <span className="text-[8px] uppercase tracking-[.34em] text-zinc-700">
              Authorized Access
            </span>

            <span className="h-px flex-1 bg-white/[.07]" />

          </div>

        </form>

      </div>

    </div>
  );
}