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

import type {
  Session,
} from '@supabase/supabase-js';

import {
  supabase,
  EventRow,
} from './lib/supabase';

import Login from './pages/Login';
import Settings from './pages/Settings';
import CreatePass from './pages/CreatePass';
import Guests from './pages/Guests';
import Dashboard from './pages/Dashboard';
import Scanner from './pages/Scanner';
import Requests from './pages/Requests';

import VyraBackground from './components/VyraBackground';
import Icon from './components/Icon';

const SELECTED_EVENT_KEY =
  'partypass:selected-event';

type NavIcon =
  | 'dashboard'
  | 'ticket'
  | 'users'
  | 'scanner'
  | 'settings'
  | 'logout'
  | 'chevron'
  | 'calendar'
  | 'clock'
  | 'pin'
  | 'user'
  | 'check'
  | 'ban'
  | 'search'
  | 'download'
  | 'whatsapp'
  | 'copy'
  | 'spark'
  | 'menu';

type NavItem = {
  to: string;
  icon: NavIcon;
  label: string;
};

const nav: NavItem[] = [
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
    to: '/scanner',
    icon: 'scanner',
    label: 'Scanner',
  },
  {
    to: '/settings',
    icon: 'settings',
    label: 'Event Settings',
  },
];

/* =========================================================
   MEMBER DASHBOARD
========================================================= */

function MemberDashboard({
  ev,
}: {
  ev: EventRow;
}) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadRequests() {
      setLoading(true);

      const {
        data: userData,
      } = await supabase.auth.getUser();

      const userId =
        userData.user?.id;

      if (!userId) {
        if (mounted) {
          setLoading(false);
        }
        return;
      }

      const {
        data,
        error,
      } = await supabase
        .from('guest_requests')
        .select('*')
        .eq('event_id', ev.id)
        .eq('submitted_by', userId)
        .order(
          'created_at',
          {
            ascending: false,
          }
        );

      if (!mounted) {
        return;
      }

      if (error) {
        console.error(
          'Member requests error:',
          error
        );

        setRequests([]);
        setLoading(false);
        return;
      }

      setRequests(data || []);
      setLoading(false);
    }

    void loadRequests();

    return () => {
      mounted = false;
    };
  }, [ev.id]);

  const pendingCount =
    requests.filter(
      (r) => r.status === 'pending'
    ).length;

  const generatedCount =
    requests.filter(
      (r) => r.status === 'generated'
    ).length;

  return (
    <div className="space-y-6">

      <div>
        <p className="text-[10px] uppercase tracking-[.3em] text-amber-200/60">
          Member Dashboard
        </p>

        <h1 className="font-display mt-2 text-3xl sm:text-4xl">
          Welcome to VYRA
        </h1>

        <p className="mt-2 text-sm text-zinc-500">
          Submit guest details and track your passes.
        </p>
      </div>

      {/* STATS */}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">

        <div className="glass rounded-3xl p-5">
          <p className="text-[9px] uppercase tracking-[.25em] text-zinc-500">
            Total
          </p>

          <p className="mt-3 text-3xl font-semibold">
            {requests.length}
          </p>
        </div>

        <div className="glass rounded-3xl p-5">
          <p className="text-[9px] uppercase tracking-[.25em] text-zinc-500">
            Pending
          </p>

          <p className="mt-3 text-3xl font-semibold text-amber-200">
            {pendingCount}
          </p>
        </div>

        <div className="glass col-span-2 rounded-3xl p-5 sm:col-span-1">
          <p className="text-[9px] uppercase tracking-[.25em] text-zinc-500">
            Generated
          </p>

          <p className="mt-3 text-3xl font-semibold text-emerald-300">
            {generatedCount}
          </p>
        </div>

      </div>

      {/* EVENT */}

      <div className="glass rounded-3xl p-6">

        <p className="text-[9px] uppercase tracking-[.3em] text-zinc-500">
          Active Event
        </p>

        <h2 className="mt-2 text-xl font-semibold">
          {ev.name}
        </h2>

        <p className="mt-1 text-sm text-zinc-500">
          Submit guest information using My Requests.
        </p>

      </div>

      {/* RECENT REQUESTS */}

      <div className="glass rounded-3xl p-5">

        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] uppercase tracking-[.3em] text-zinc-500">
              Recent Requests
            </p>

            <h2 className="mt-1 text-lg font-semibold">
              Your submissions
            </h2>
          </div>

          <NavLink
            to="/requests"
            className="rounded-xl border border-amber-300/20 bg-amber-300/5 px-4 py-2 text-xs text-amber-100"
          >
            View All
          </NavLink>
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-zinc-600">
            Loading requests...
          </div>
        ) : requests.length === 0 ? (
          <div className="py-10 text-center">

            <Icon
              name="ticket"
              size={25}
              className="mx-auto text-zinc-700"
            />

            <p className="mt-3 text-sm text-zinc-500">
              No guest requests yet.
            </p>

            <NavLink
              to="/requests"
              className="mt-4 inline-block rounded-xl bg-gradient-to-r from-amber-500 to-amber-300 px-5 py-2.5 text-xs font-semibold text-black"
            >
              Submit Guest
            </NavLink>

          </div>
        ) : (
          <div className="mt-5 space-y-2">

            {requests.slice(0, 5).map(
              (request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between rounded-2xl border border-white/[.06] bg-black/10 p-4"
                >

                  <div>
                    <p className="text-sm font-medium">
                      {request.guest_name}
                    </p>

                    <p className="mt-1 text-[11px] text-zinc-600">
                      {request.pass_type}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-[9px] uppercase tracking-wider ${
                      request.status === 'generated'
                        ? 'bg-emerald-300/10 text-emerald-300'
                        : request.status === 'rejected'
                          ? 'bg-red-300/10 text-red-300'
                          : 'bg-amber-300/10 text-amber-200'
                    }`}
                  >
                    {request.status}
                  </span>

                </div>
              )
            )}

          </div>
        )}

      </div>

    </div>
  );
}

/* =========================================================
   SHELL
========================================================= */

function Shell({
  ev,
  events,
  onSignOut,
  onSaved,
  onSelected,
  online,
}: {
  ev: EventRow;
  events: EventRow[];
  onSignOut: () => void;
  onSaved: (
    event: EventRow
  ) => void;
  onSelected: (
    event: EventRow
  ) => void;
  online: boolean;
}) {
  const [
    role,
    setRole,
  ] = useState<
    'admin' | 'member' | null
  >(null);

  useEffect(() => {
    async function loadRole() {
      const {
        data,
      } = await supabase.auth.getUser();

      const userId =
        data.user?.id;

      if (!userId) {
        setRole('member');
        return;
      }

      const {
        data: profile,
        error,
      } = await supabase
        .from('profiles')
        .select('role')
        .eq(
          'user_id',
          userId
        )
        .maybeSingle();

      if (error) {
        console.error(
          'Profile role error:',
          error
        );

        setRole('member');
        return;
      }

      setRole(
        profile?.role === 'admin'
          ? 'admin'
          : 'member'
      );
    }

    void loadRole();
  }, []);

  const location =
    useLocation();

  const pageTitle =
    location.pathname === '/'
      ? 'Dashboard'
      : location.pathname === '/create'
        ? 'Create Pass'
        : location.pathname === '/guests'
          ? 'Guests'
          : location.pathname === '/scanner'
            ? 'Scanner'
            : location.pathname === '/requests'
              ? 'Requests'
              : 'Event Settings';

  /* =========================================================
     MEMBER NAVIGATION
  ========================================================= */

  const memberNav: NavItem[] = [
    {
      to: '/',
      icon: 'dashboard',
      label: 'Dashboard',
    },
    {
      to: '/requests',
      icon: 'ticket',
      label: 'My Requests',
    },
    {
      to: '/scanner',
      icon: 'scanner',
      label: 'Scanner',
    },
  ];

  /* =========================================================
     ADMIN NAVIGATION
  ========================================================= */

  const adminNav: NavItem[] = [
    ...nav,
    {
      to: '/requests',
      icon: 'users',
      label: 'Requests',
    },
  ];

  const currentNav =
    role === 'member'
      ? memberNav
      : adminNav;

  return (
    <div className="relative z-10 min-h-screen lg:flex">

      {/* SIDEBAR */}

      <aside className="glass fixed inset-x-0 bottom-0 z-30 rounded-none border-x-0 border-b-0 p-2 lg:static lg:flex lg:w-[272px] lg:shrink-0 lg:flex-col lg:border-y-0 lg:border-l-0 lg:p-6">

        <div className="hidden lg:block">

          <img
            src="/vyra-logo.jpg"
            alt="VYRA Entertainment"
            className="mx-auto mb-7 w-full max-w-[205px] mix-blend-screen"
          />

          <div className="mb-7 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        </div>

        <div className="mb-4 hidden items-center gap-2 px-2 text-[10px] uppercase tracking-[.28em] text-zinc-600 lg:flex">

          <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />

          Operations

        </div>

        <nav className="flex flex-1 items-center justify-around gap-1 lg:flex-col lg:items-stretch lg:justify-start lg:gap-2">

          {currentNav.map(
            (item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={
                  item.to === '/'
                }
                className={({
                  isActive,
                }) =>
                  `nav-item group flex items-center justify-center gap-3 rounded-2xl border px-3 py-3 text-xs transition md:px-4 md:py-3.5 lg:justify-start lg:text-sm ${
                    isActive
                      ? 'active border-amber-300/30 bg-amber-300/[.045] text-amber-100'
                      : 'border-transparent text-zinc-400 hover:border-white/[.08] hover:bg-white/[.02] hover:text-zinc-100'
                  }`
                }
              >

                <Icon
                  name={item.icon}
                  size={19}
                />

                <span className="hidden sm:inline">
                  {item.label}
                </span>

              </NavLink>
            )
          )}

        </nav>

        <div className="mt-auto hidden pt-7 lg:block">

          <div className="flex items-center justify-between px-2 text-xs">

            <span
              className={
                online
                  ? 'text-emerald-300'
                  : 'text-red-300'
              }
            >

              <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-current" />

              {online
                ? 'Online'
                : 'Offline'}

            </span>

            <button
              onClick={
                onSignOut
              }
              className="flex items-center gap-2 text-zinc-500 hover:text-zinc-200"
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

        <button
          onClick={
            onSignOut
          }
          className="rounded-xl px-3 py-3 text-zinc-500 lg:hidden"
          aria-label="Sign out"
        >

          <Icon
            name="logout"
            size={18}
          />

        </button>

      </aside>

      {/* MAIN */}

      <main className="min-w-0 flex-1 pb-24 lg:pb-0">

        <div className="mx-auto max-w-[1500px] p-4 sm:p-6 md:p-8 lg:p-10 xl:p-12">

          {/* TOP BAR */}

          <header className="mb-7 flex flex-col gap-4 border-b border-white/[.07] pb-4 sm:flex-row sm:items-center sm:justify-between">

            <div>

              <p className="text-[10px] uppercase tracking-[.34em] text-amber-200/55">
                {pageTitle}
              </p>

              <p className="mt-1 text-xs text-zinc-600">
                Active event ·{' '}
                {ev.name}
              </p>

            </div>

            <div className="flex items-center gap-2">

              <select
                value={ev.id}
                onChange={(e) => {

                  const selected =
                    events.find(
                      (event) =>
                        event.id ===
                        e.target.value
                    );

                  if (
                    selected
                  ) {
                    onSelected(
                      selected
                    );
                  }

                }}
                className="w-auto min-w-[180px] rounded-full px-4 py-2 text-xs"
              >

                {events.map(
                  (event) => (
                    <option
                      key={event.id}
                      value={event.id}
                    >
                      {event.name}
                    </option>
                  )
                )}

              </select>

              <div className="hidden items-center gap-2 rounded-full border border-white/[.08] bg-black/20 px-3 py-2 text-xs text-zinc-400 sm:flex">

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

            </div>

          </header>

          {/* ROUTES */}

          {role === null ? (

            <div className="grid min-h-[400px] place-items-center">

              <div className="text-center">

                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-amber-300" />

                <p className="mt-4 text-[9px] uppercase tracking-[.3em] text-zinc-600">
                  Loading profile
                </p>

              </div>

            </div>

          ) : role === 'member' ? (

            <Routes>

              <Route
                path="/"
                element={
                  <MemberDashboard
                    ev={ev}
                  />
                }
              />

              <Route
                path="/requests"
                element={
                  <Requests
                    ev={ev}
                    events={events}
                    onSelected={onSelected}
                  />
                }
              />

              {/* MEMBER SCANNER */}

              <Route
                path="/scanner"
                element={
                  <Scanner
                    ev={ev}
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

          ) : (

            <Routes>

              {/* ADMIN REQUESTS */}

              <Route
                path="/requests"
                element={
                  <Requests
                    ev={ev}
                    events={events}
                    onSelected={onSelected}
                  />
                }
              />

              <Route
                path="/"
                element={
                  <Dashboard
                    ev={ev}
                  />
                }
              />

              <Route
                path="/create"
                element={
                  <CreatePass
                    ev={ev}
                    events={events}
                    onSelected={
                      onSelected
                    }
                  />
                }
              />

              <Route
                path="/guests"
                element={
                  <Guests
                    ev={ev}
                  />
                }
              />

              {/* ADMIN SCANNER */}

              <Route
                path="/scanner"
                element={
                  <Scanner
                    ev={ev}
                  />
                }
              />

              <Route
                path="/settings"
                element={
                  <Settings
                    ev={ev}
                    events={events}
                    onSaved={
                      onSaved
                    }
                    onSelected={
                      onSelected
                    }
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

          )}

        </div>

      </main>

    </div>
  );
}

/* =========================================================
   APP
========================================================= */

export default function App() {

  const [
    session,
    setSession,
  ] =
    useState<Session | null>(
      null
    );

  const [
    authLoading,
    setAuthLoading,
  ] =
    useState(true);

  const [
    eventsLoading,
    setEventsLoading,
  ] =
    useState(true);

  const [
    events,
    setEvents,
  ] =
    useState<EventRow[]>(
      []
    );

  const [
    ev,
    setEv,
  ] =
    useState<EventRow | null>(
      null
    );

  const [
    loadError,
    setLoadError,
  ] =
    useState<string | null>(
      null
    );

  const [
    online,
    setOnline,
  ] =
    useState(
      navigator.onLine
    );

  /* =====================================================
     AUTH
  ===================================================== */

  useEffect(() => {

    supabase.auth
      .getSession()
      .then(
        ({ data }) => {

          setSession(
            data.session
          );

          setAuthLoading(
            false
          );

        }
      )
      .catch(
        (error) => {

          console.error(
            'Session error:',
            error
          );

          setAuthLoading(
            false
          );

        }
      );

    const {
      data,
    } =
      supabase.auth.onAuthStateChange(
        (
          _,
          nextSession
        ) => {

          setSession(
            nextSession
          );

        }
      );

    const handleOnline =
      () =>
        setOnline(
          true
        );

    const handleOffline =
      () =>
        setOnline(
          false
        );

    window.addEventListener(
      'online',
      handleOnline
    );

    window.addEventListener(
      'offline',
      handleOffline
    );

    return () => {

      data.subscription.unsubscribe();

      window.removeEventListener(
        'online',
        handleOnline
      );

      window.removeEventListener(
        'offline',
        handleOffline
      );

    };

  }, []);

  /* =====================================================
     LOAD EVENTS
  ===================================================== */

  useEffect(() => {

    if (!session) {

      setEvents([]);

      setEv(null);

      setEventsLoading(
        false
      );

      return;

    }

    let mounted = true;

    async function loadEvents() {

      setEventsLoading(
        true
      );

      setLoadError(
        null
      );

      const {
        data,
        error,
      } =
        await supabase
          .from('events')
          .select('*')
          .order(
            'created_at',
            {
              ascending:
                false,
            }
          );

      if (!mounted) {
        return;
      }

      if (error) {

        console.error(
          'Events load error:',
          error
        );

        setLoadError(
          error.message
        );

        setEvents([]);

        setEv(null);

        setEventsLoading(
          false
        );

        return;

      }

      const list =
        (data ||
          []) as EventRow[];

      setEvents(
        list
      );

      if (!list.length) {

        setEv(null);

        setEventsLoading(
          false
        );

        return;

      }

      const savedId =
        window.localStorage.getItem(
          SELECTED_EVENT_KEY
        );

      const savedEvent =
        savedId
          ? list.find(
              (event) =>
                event.id ===
                savedId
            )
          : null;

      const selected =
        savedEvent ||
        list[0];

      setEv(
        selected
      );

      window.localStorage.setItem(
        SELECTED_EVENT_KEY,
        selected.id
      );

      setEventsLoading(
        false
      );

    }

    void loadEvents();

    return () => {
      mounted = false;
    };

  }, [session]);

  /* =====================================================
     SELECT EVENT
  ===================================================== */

  function handleSelected(
    event: EventRow
  ) {

    setEv(
      event
    );

    window.localStorage.setItem(
      SELECTED_EVENT_KEY,
      event.id
    );

  }

  /* =====================================================
     SAVE EVENT
  ===================================================== */

  function handleSaved(
    event: EventRow
  ) {

    setEvents(
      (current) => {

        const exists =
          current.some(
            (item) =>
              item.id ===
              event.id
          );

        if (exists) {

          return current.map(
            (item) =>
              item.id ===
              event.id
                ? event
                : item
          );

        }

        return [
          event,
          ...current,
        ];

      }
    );

    handleSelected(
      event
    );

  }

  /* =====================================================
     LOADING
  ===================================================== */

  if (authLoading) {

    return (
      <div className="relative min-h-screen">

        <VyraBackground />

        <div className="relative z-10 grid min-h-screen place-items-center text-zinc-500">

          Loading PartyPass…

        </div>

      </div>
    );

  }

  /* =====================================================
     LOGIN
  ===================================================== */

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

  /* =====================================================
     EVENTS LOADING
  ===================================================== */

  if (eventsLoading) {

    return (
      <div className="relative min-h-screen">

        <VyraBackground />

        <div className="relative z-10 grid min-h-screen place-items-center">

          <div className="text-center">

            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-amber-300" />

            <p className="mt-4 text-[9px] uppercase tracking-[.3em] text-zinc-600">
              Loading Events
            </p>

          </div>

        </div>

      </div>
    );

  }

  /* =====================================================
     EVENT ERROR
  ===================================================== */

  if (loadError) {

    return (
      <div className="relative min-h-screen">

        <VyraBackground />

        <div className="relative z-10 grid min-h-screen place-items-center p-5">

          <div className="glass max-w-lg rounded-[28px] p-7 text-center">

            <Icon
              name="ban"
              size={25}
              className="mx-auto text-red-300"
            />

            <h2 className="font-display mt-5 text-3xl">
              Couldn't load events
            </h2>

            <p className="mt-3 text-sm text-zinc-500">
              {loadError}
            </p>

            <button
              onClick={() =>
                window.location.reload()
              }
              className="mt-6 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-300 px-6 py-3 font-semibold text-black"
            >
              Reload
            </button>

          </div>

        </div>

      </div>
    );

  }

  /* =====================================================
     NO EVENT
  ===================================================== */

  if (!ev) {

    return (
      <div className="relative min-h-screen">

        <VyraBackground />

        <div className="relative z-10 mx-auto min-h-screen max-w-5xl p-5 md:p-10">

          <Settings
            ev={null}
            events={events}
            onSaved={
              handleSaved
            }
            onSelected={
              handleSelected
            }
          />

        </div>

      </div>
    );

  }

  /* =====================================================
     MAIN APP
  ===================================================== */

  return (
    <div className="relative min-h-screen">

      <VyraBackground />

      <Shell
        ev={ev}
        events={events}
        online={online}
        onSignOut={() =>
          supabase.auth.signOut()
        }
        onSaved={
          handleSaved
        }
        onSelected={
          handleSelected
        }
      />

    </div>
  );
}