import { useEffect, useState } from 'react';
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';

import { supabase, EventRow } from './lib/supabase';
import Login from './pages/Login';
import Settings from './pages/Settings';
import CreatePass from './pages/CreatePass';
import Guests from './pages/Guests';
import Dashboard from './pages/Dashboard';
import VyraBackground from './components/VyraBackground';
import Icon from './components/Icon';

const nav = [
  ['/','dashboard','Dashboard'],
  ['/create','ticket','Create Pass'],
  ['/guests','users','Guests'],
  ['/settings','settings','Event Settings'],
] as const;

function Shell({
  ev,
  onSignOut,
  onSaved,
  online,
}: {
  ev: EventRow;
  onSignOut: () => void;
  onSaved: (event: EventRow) => void;
  online: boolean;
}) {
  const location = useLocation();

  const pageTitle =
    location.pathname === '/'
      ? 'Dashboard'
      : location.pathname === '/create'
        ? 'Create Pass'
        : location.pathname === '/guests'
          ? 'Guests'
          : 'Event Settings';

  return (
    <div className="min-h-screen lg:flex">

      {/* SIDEBAR */}
      <aside className="glass fixed inset-x-0 bottom-0 z-30 border-x-0 border-b-0 rounded-none p-2 lg:static lg:flex lg:w-[270px] lg:shrink-0 lg:flex-col lg:border-y-0 lg:border-l-0 lg:p-6 lg:rounded-none">

        <div className="sidebar-glow" />

        {/* LOGO */}
        <div className="relative hidden lg:block">
          <img
            src="/vyra-logo.jpg"
            alt="VYRA Entertainment"
            className="mx-auto mb-5 w-full max-w-[190px] mix-blend-screen"
          />

          <div className="mb-8 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>

        {/* SECTION */}
        <div className="relative mb-4 hidden items-center gap-2 px-2 text-[9px] uppercase tracking-[.32em] text-zinc-600 lg:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
          Event Operations
        </div>

        {/* NAV */}
        <nav className="relative flex items-center justify-around gap-1 lg:flex-col lg:items-stretch lg:justify-start lg:gap-2">

          {nav.map(([to, ico, label]) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `nav-item group flex items-center justify-center gap-3 rounded-2xl border px-3 py-3 transition md:px-4 md:py-3.5 lg:justify-start ${
                  isActive
                    ? 'active border-amber-300/20 bg-amber-300/[.045] text-amber-100 shadow-[0_12px_35px_rgba(222,171,86,.06)]'
                    : 'border-transparent text-zinc-500 hover:border-white/[.07] hover:bg-white/[.02] hover:text-zinc-100'
                }`
              }
            >
              <Icon name={ico} size={19} />

              <span className="hidden sm:inline lg:inline">
                {label}
              </span>
            </NavLink>
          ))}

        </nav>

        {/* DESKTOP FOOT */}
        <div className="relative mt-auto hidden pt-8 lg:block">

          <div className="mb-5 h-px bg-gradient-to-r from-transparent via-white/[.08] to-transparent" />

          <div className="flex items-center justify-between px-2 text-xs">

            <span
              className={
                online
                  ? 'text-emerald-300'
                  : 'text-red-300'
              }
            >
              <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-current" />
              {online ? 'Online' : 'Offline'}
            </span>

            <button
              onClick={onSignOut}
              className="flex items-center gap-2 text-zinc-500 transition hover:text-zinc-100"
            >
              <Icon name="logout" size={15} />
              Sign out
            </button>

          </div>

          <p className="mt-6 text-center text-[8px] uppercase tracking-[.35em] text-zinc-700">
            Beyond the ordinary
          </p>
        </div>

        {/* MOBILE */}
        <button
          onClick={onSignOut}
          className="rounded-xl px-3 py-3 text-zinc-600 transition hover:text-zinc-200 lg:hidden"
          aria-label="Sign out"
        >
          <Icon name="logout" size={18} />
        </button>

      </aside>

      {/* MAIN */}
      <main className="min-w-0 flex-1 pb-24 lg:pb-0">

        <div className="mx-auto max-w-[1500px] p-4 sm:p-6 md:p-8 lg:p-10 xl:p-12">

          {/* TOP BAR */}
          <header className="mb-8 flex items-center justify-between gap-4 border-b border-white/[.06] pb-5">

            <div>
              <p className="text-[9px] uppercase tracking-[.34em] text-amber-200/55">
                {pageTitle}
              </p>

              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs text-zinc-600">
                  {ev.name}
                </span>

                <span className="text-zinc-800">•</span>

                <span className="text-[10px] uppercase tracking-[.18em] text-zinc-700">
                  VYRA
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-white/[.07] bg-black/25 px-3 py-2 text-[11px] text-zinc-500">

              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  online
                    ? 'bg-emerald-300'
                    : 'bg-red-300'
                }`}
              />

              {online ? 'Online' : 'Offline'}

            </div>

          </header>

          <Routes>

            <Route
              path="/"
              element={<Dashboard ev={ev} />}
            />

            <Route
              path="/create"
              element={<CreatePass ev={ev} />}
            />

            <Route
              path="/guests"
              element={<Guests ev={ev} />}
            />

            <Route
              path="/settings"
              element={
                <Settings
                  ev={ev}
                  onSaved={onSaved}
                />
              }
            />

            <Route
              path="*"
              element={<Navigate to="/" replace />}
            />

          </Routes>

        </div>
      </main>
    </div>
  );
}

export default function App() {
  const [s, setS] =
    useState<Session | null>(null);

  const [ready, setReady] = useState(false);

  const [ev, setEv] =
    useState<EventRow | null>(null);

  const [online, setOnline] =
    useState(navigator.onLine);

  useEffect(() => {

    supabase.auth
      .getSession()
      .then(({ data }) => {
        setS(data.session);
        setReady(true);
      });

    const { data } =
      supabase.auth.onAuthStateChange(
        (_, session) => {
          setS(session);
        }
      );

    const handleOnline = () =>
      setOnline(true);

    const handleOffline = () =>
      setOnline(false);

    addEventListener(
      'online',
      handleOnline
    );

    addEventListener(
      'offline',
      handleOffline
    );

    return () => {
      data.subscription.unsubscribe();

      removeEventListener(
        'online',
        handleOnline
      );

      removeEventListener(
        'offline',
        handleOffline
      );
    };

  }, []);

  useEffect(() => {

    if (!s) return;

    supabase
      .from('events')
      .select('*')
      .order('created_at')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setEv(data);
      });

  }, [s]);

  if (!ready) {
    return (
      <>
        <VyraBackground />

        <div className="grid min-h-screen place-items-center text-sm text-zinc-600">
          Loading PartyPass…
        </div>
      </>
    );
  }

  if (!s) {
    return (
      <>
        <VyraBackground />
        <Login />
      </>
    );
  }

  if (!ev) {
    return (
      <>
        <VyraBackground />

        <div className="mx-auto min-h-screen max-w-3xl p-5 md:p-10">
          <Settings
            ev={null}
            onSaved={(event) =>
              setEv(event)
            }
          />
        </div>
      </>
    );
  }

  return (
    <>
      <VyraBackground />

      <Shell
        ev={ev}
        online={online}
        onSignOut={() =>
          supabase.auth.signOut()
        }
        onSaved={setEv}
      />
    </>
  );
}