import {
  useEffect,
  useState,
} from 'react';

import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';

import type { Session } from '@supabase/supabase-js';

import {
  supabase,
  EventRow,
} from './lib/supabase';

import Login from './pages/Login';
import Settings from './pages/Settings';
import CreatePass from './pages/CreatePass';
import Guests from './pages/Guests';
import Dashboard from './pages/Dashboard';

import VyraBackground from './components/VyraBackground';
import Icon from './components/Icon';

const nav = [
  {
    to: '/',
    icon: 'dashboard',
    label: 'Dashboard',
  },
  {
    to: '/create',
    icon: 'ticket',
    label: 'Create Pass',
  },
  {
    to: '/guests',
    icon: 'users',
    label: 'Guests',
  },
  {
    to: '/settings',
    icon: 'settings',
    label: 'Event Settings',
  },
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
    <div className="relative z-10 min-h-screen lg:flex">

      {/* ==================================
          SIDEBAR
      ================================== */}

      <aside
        className="
          glass
          fixed
          inset-x-0
          bottom-0
          z-30
          rounded-none
          border-x-0
          border-b-0
          p-2

          lg:static
          lg:flex
          lg:w-[280px]
          lg:shrink-0
          lg:flex-col
          lg:border-y-0
          lg:border-l-0
          lg:p-6
        "
      >

        {/* LOGO */}

        <div className="hidden lg:block">

          <div className="flex justify-center">

            <img
              src="/vyra-logo.jpg"
              alt="VYRA Entertainment"
              className="
                w-[205px]
                object-contain
                mix-blend-screen
              "
            />

          </div>

          <div className="my-7 h-px bg-gradient-to-r from-transparent via-white/[.09] to-transparent" />

        </div>

        {/* LABEL */}

        <div className="mb-4 hidden items-center gap-2 px-2 text-[9px] uppercase tracking-[.3em] text-zinc-600 lg:flex">

          <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />

          Event Operations

        </div>

        {/* NAV */}

        <nav className="flex items-center justify-around gap-1 lg:flex-col lg:items-stretch lg:justify-start lg:gap-2">

          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `nav-item group flex items-center justify-center gap-3 rounded-2xl border px-3 py-3 transition md:px-4 md:py-3.5 lg:justify-start ${
                  isActive
                    ? 'active border-amber-300/25 bg-amber-300/[.045] text-amber-100'
                    : 'border-transparent text-zinc-500 hover:border-white/[.07] hover:bg-white/[.02] hover:text-zinc-100'
                }`
              }
            >

              <Icon
                name={item.icon}
                size={19}
              />

              <span className="hidden sm:inline lg:inline">
                {item.label}
              </span>

            </NavLink>
          ))}

        </nav>

        {/* DESKTOP FOOTER */}

        <div className="mt-auto hidden lg:block">

          <div className="my-7 h-px bg-gradient-to-r from-transparent via-white/[.08] to-transparent" />

          <div className="flex items-center justify-between px-2">

            <div
              className={`flex items-center gap-2 text-xs ${
                online
                  ? 'text-emerald-300'
                  : 'text-red-300'
              }`}
            >

              <span className="h-1.5 w-1.5 rounded-full bg-current" />

              {online
                ? 'Online'
                : 'Offline'}

            </div>

            <button
              onClick={onSignOut}
              className="flex items-center gap-2 text-xs text-zinc-500 transition hover:text-zinc-100"
            >

              <Icon
                name="logout"
                size={15}
              />

              Sign out

            </button>

          </div>

          <p className="mt-8 text-center text-[8px] uppercase tracking-[.38em] text-zinc-700">
            Beyond the ordinary
          </p>

        </div>

        {/* MOBILE SIGN OUT */}

        <button
          onClick={onSignOut}
          className="rounded-xl px-3 py-3 text-zinc-500 lg:hidden"
          aria-label="Sign out"
        >
          <Icon
            name="logout"
            size={18}
          />
        </button>

      </aside>

      {/* ==================================
          MAIN CONTENT
      ================================== */}

      <main
        className="
          relative
          z-10
          min-w-0
          flex-1
          pb-24
          lg:pb-0
        "
      >

        <div className="mx-auto max-w-[1500px] p-4 sm:p-6 md:p-8 lg:p-10 xl:p-11">

          {/* TOP BAR */}

          <header className="mb-8 flex items-center justify-between gap-4 border-b border-white/[.06] pb-5">

            <div>

              <p className="text-[9px] uppercase tracking-[.34em] text-amber-200/55">
                {pageTitle}
              </p>

              <p className="mt-1 text-xs text-zinc-600">
                {ev.name}
              </p>

            </div>

            <div className="flex items-center gap-3">

              <div className="hidden items-center gap-2 rounded-full border border-white/[.07] bg-black/30 px-3 py-2 text-[11px] text-zinc-500 sm:flex">

                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    online
                      ? 'bg-emerald-300'
                      : 'bg-red-300'
                  }`}
                />

                {online
                  ? 'Online'
                  : 'Offline'}

              </div>

              <div className="hidden h-9 w-9 items-center justify-center rounded-full border border-white/[.08] bg-black/30 text-sm text-zinc-300 sm:flex">
                V
              </div>

            </div>

          </header>

          {/* ROUTES */}

          <Routes>

            <Route
              path="/"
              element={
                <Dashboard ev={ev} />
              }
            />

            <Route
              path="/create"
              element={
                <CreatePass ev={ev} />
              }
            />

            <Route
              path="/guests"
              element={
                <Guests ev={ev} />
              }
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
              element={
                <Navigate
                  to="/"
                  replace
                />
              }
            />

          </Routes>

        </div>

      </main>

    </div>
  );
}

export default function App() {

  const [session, setSession] =
    useState<Session | null>(null);

  const [ready, setReady] =
    useState(false);

  const [event, setEvent] =
    useState<EventRow | null>(null);

  const [online, setOnline] =
    useState(
      navigator.onLine
    );

  useEffect(() => {

    supabase.auth
      .getSession()
      .then(({ data }) => {

        setSession(
          data.session
        );

        setReady(true);

      });

    const {
      data,
    } =
      supabase.auth.onAuthStateChange(
        (_, nextSession) => {

          setSession(
            nextSession
          );

        }
      );

    const onlineHandler =
      () => setOnline(true);

    const offlineHandler =
      () => setOnline(false);

    window.addEventListener(
      'online',
      onlineHandler
    );

    window.addEventListener(
      'offline',
      offlineHandler
    );

    return () => {

      data.subscription.unsubscribe();

      window.removeEventListener(
        'online',
        onlineHandler
      );

      window.removeEventListener(
        'offline',
        offlineHandler
      );

    };

  }, []);

  useEffect(() => {

    if (!session) {
      setEvent(null);
      return;
    }

    supabase
      .from('events')
      .select('*')
      .order('created_at')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {

        setEvent(data);

      });

  }, [session]);

  if (!ready) {

    return (
      <div className="relative min-h-screen">

        <VyraBackground />

        <div className="relative z-10 grid min-h-screen place-items-center text-sm text-zinc-600">
          Loading PartyPass…
        </div>

      </div>
    );

  }

  if (!session) {

    return (
      <div className="relative min-h-screen">

        <VyraBackground />

        <div className="relative z-10">
          <Login />
        </div>

      </div>
    );

  }

  if (!event) {

    return (
      <div className="relative min-h-screen">

        <VyraBackground />

        <div className="relative z-10 mx-auto min-h-screen max-w-3xl p-5 md:p-10">

          <Settings
            ev={null}
            onSaved={(savedEvent) =>
              setEvent(savedEvent)
            }
          />

        </div>

      </div>
    );

  }

  return (
    <div className="relative min-h-screen">

      {/* BACKGROUND FIRST */}

      <VyraBackground />

      {/* UI ABOVE BACKGROUND */}

      <Shell
        ev={event}
        online={online}
        onSignOut={() =>
          supabase.auth.signOut()
        }
        onSaved={setEvent}
      />

    </div>
  );
}