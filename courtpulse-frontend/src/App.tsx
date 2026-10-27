import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowDownRight, ArrowUpRight, Award, Bell, CalendarDays, Check, ChevronDown,
  CircleHelp, Clock3, Command, Compass, Flag, Gauge, LayoutDashboard, Menu, Plus,
  Radio, RefreshCw, Search, Settings2, ShieldCheck, Trophy, Users, Wifi, X, Zap,
  Play, Pause, RotateCcw, UserRound, Swords, ChartNoAxesCombined
} from "lucide-react";
import { api, rows, item, displayName, idOf, API_BASE } from "./api";

type Player = { id: string; name?: string; fullName?: string; firstName?: string; lastName?: string; email?: string; phone?: string; ranking?: number; createdAt?: string };
type Tournament = { id: string; name?: string; title?: string; location?: string; status?: string; startDate?: string; endDate?: string; createdAt?: string; participants?: any[]; _count?: { participants?: number; matches?: number } };
type Match = { id: string; status: string; version: number; bestOf: number; playerOneId: string; playerTwoId: string; playerOne?: Player; playerTwo?: Player; tournament?: Tournament; scoreState?: any; createdAt?: string; winnerId?: string };
type View = "Overview" | "Live scoring" | "Matches" | "Tournaments" | "Players";

const nav = [
  { label: "Overview" as View, icon: LayoutDashboard, group: "WORKSPACE" },
  { label: "Live scoring" as View, icon: Radio, group: "WORKSPACE" },
  { label: "Matches" as View, icon: Swords, group: "MANAGE" },
  { label: "Tournaments" as View, icon: Trophy, group: "MANAGE" },
  { label: "Players" as View, icon: Users, group: "MANAGE" },
];

function initials(name: string) { return name.split(/\s+/).map(s => s[0]).join("").slice(0, 2).toUpperCase() || "CP"; }
function dateLabel(value?: string) { if (!value) return "Date not set"; const d = new Date(value); return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
function scoreOf(match: Match) {
  const s = match.scoreState;
  const games = s?.games || [];
  const points = s?.points || [0, 0];
  return { games, points, gamesWon: s?.gamesWon || [0, 0] };
}
function statusClass(status?: string) { return (status || "scheduled").toLowerCase(); }

export default function App() {
  const [view, setView] = useState<View>("Overview");
  const [players, setPlayers] = useState<Player[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiOnline, setApiOnline] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState<"player" | "tournament" | "match" | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null);
  const [mobileNav, setMobileNav] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const health = await api<any>("/api/health");
      setApiOnline(health?.status === "ok" || !!health);
    } catch { setApiOnline(false); }
    const [p, t, m] = await Promise.allSettled([
      api<any>("/api/players"), api<any>("/api/tournaments"), api<any>("/api/matches")
    ]);
    if (p.status === "fulfilled") setPlayers(rows<Player>(p.value));
    if (t.status === "fulfilled") setTournaments(rows<Tournament>(t.value));
    if (m.status === "fulfilled") setMatches(rows<Match>(m.value));
    setLoading(false);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(null), 4200); return () => window.clearTimeout(timer); }, [notice]);

  const liveMatches = useMemo(() => matches.filter(m => ["LIVE", "PAUSED"].includes((m.status || "").toUpperCase())), [matches]);
  const completedMatches = useMemo(() => matches.filter(m => (m.status || "").toUpperCase() === "COMPLETED"), [matches]);
  const filteredPlayers = players.filter(p => displayName(p).toLowerCase().includes(search.toLowerCase()) || (p.email || "").toLowerCase().includes(search.toLowerCase()));
  const filteredTournaments = tournaments.filter(t => displayName(t).toLowerCase().includes(search.toLowerCase()));
  const filteredMatches = matches.filter(m => `${displayName(m.playerOne)} ${displayName(m.playerTwo)} ${displayName(m.tournament)} ${m.status}`.toLowerCase().includes(search.toLowerCase()));
  const chosenMatch = matches.find(m => m.id === selectedMatch) || liveMatches[0] || matches[0];

  async function action(path: string, method = "POST", body?: any, success = "Updated successfully") {
    try {
      await api(path, { method, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
      setNotice({ kind: "success", text: success });
      await refresh();
    } catch (e) { setNotice({ kind: "error", text: e instanceof Error ? e.message : "Something went wrong" }); }
  }
  async function createRecord(kind: "player" | "tournament" | "match", data: any) {
    const path = kind === "player" ? "/api/players" : kind === "tournament" ? "/api/tournaments" : "/api/matches";
    try {
      await api(path, { method: "POST", body: JSON.stringify(data) });
      setShowCreate(null); setNotice({ kind: "success", text: `${kind[0].toUpperCase() + kind.slice(1)} created` }); await refresh();
    } catch (e) { setNotice({ kind: "error", text: e instanceof Error ? e.message : "Could not create record" }); }
  }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
      <div className="brand"><div className="brand-mark"><Activity size={22} strokeWidth={2.6}/></div><div><div className="brand-name">court<span>pulse</span></div><div className="brand-sub">TOURNAMENT CONTROL</div></div><button className="mobile-close icon-btn" onClick={() => setMobileNav(false)}><X size={18}/></button></div>
      <div className="workspace-switch"><div className="workspace-avatar">CP</div><div className="workspace-copy"><strong>CourtPulse Arena</strong><span>Organizer workspace</span></div><ChevronDown size={15}/></div>
      {["WORKSPACE", "MANAGE"].map(group => <div className="nav-group" key={group}><div className="nav-caption">{group}</div>{nav.filter(n => n.group === group).map(n => <button key={n.label} className={`nav-link ${view === n.label ? "active" : ""}`} onClick={() => { setView(n.label); setMobileNav(false); }}><n.icon size={18}/><span>{n.label}</span>{n.label === "Live scoring" && liveMatches.length > 0 && <span className="nav-count">{liveMatches.length}</span>}</button>)}</div>)}
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><CircleHelp size={18}/></div><strong>Need a hand?</strong><p>Keep your tournament running smoothly.</p><button onClick={() => setNotice({ kind: "success", text: "Tip: create players first, then tournaments and matches." })}>Quick tips <ArrowUpRight size={14}/></button></div><div className="profile"><div className="profile-avatar">A</div><div className="profile-info"><strong>Administrator</strong><span>Event organizer</span></div><Settings2 size={17}/></div></div>
    </aside>
    {mobileNav && <div className="mobile-scrim" onClick={() => setMobileNav(false)} />}
    <main className="main">
      <header className="topbar"><div className="topbar-left"><button className="icon-btn mobile-menu" onClick={() => setMobileNav(true)}><Menu size={20}/></button><div className="breadcrumb">Workspace <span>/</span> <strong>{view}</strong></div></div><div className="topbar-actions"><div className={`connection ${apiOnline ? "online" : "offline"}`}><span className="connection-dot"/>{apiOnline ? "API connected" : "API disconnected"}</div><button className="icon-btn" title="Refresh data" onClick={() => void refresh()}><RefreshCw size={17}/></button><button className="icon-btn notification" title="Notifications" onClick={() => setNotice({kind:"success", text:"You're all caught up."})}><Bell size={17}/><i/></button><div className="top-avatar">A</div></div></header>
      <div className="page">
        {notice && <div className={`toast ${notice.kind}`}><span>{notice.kind === "success" ? <Check size={17}/> : <CircleHelp size={17}/>}</span>{notice.text}<button onClick={() => setNotice(null)}><X size={15}/></button></div>}
        {view === "Overview" && <Overview players={players} tournaments={tournaments} matches={matches} liveMatches={liveMatches} completedMatches={completedMatches} loading={loading} setView={setView} setShowCreate={setShowCreate} selectMatch={id => {setSelectedMatch(id);setView("Live scoring");}}/>}
        {view === "Live scoring" && <LiveScoring matches={matches} selected={chosenMatch} setSelected={setSelectedMatch} action={action} setShowCreate={setShowCreate} refresh={refresh}/>}
        {view === "Matches" && <Matches matches={filteredMatches} loading={loading} search={search} setSearch={setSearch} setShowCreate={setShowCreate} onSelect={id => {setSelectedMatch(id);setView("Live scoring");}}/>}
        {view === "Tournaments" && <Tournaments tournaments={filteredTournaments} loading={loading} search={search} setSearch={setSearch} setShowCreate={setShowCreate}/>}
        {view === "Players" && <Players players={filteredPlayers} loading={loading} search={search} setSearch={setSearch} setShowCreate={setShowCreate}/>}
        <footer className="footer"><span>© 2026 CourtPulse</span><span><span className={`footer-dot ${apiOnline ? "good" : ""}`}/>{apiOnline ? "All systems operational" : "Waiting for backend"} <span className="footer-divider">·</span> Built for the game.</span></footer>
      </div>
    </main>
    {showCreate && <CreateModal kind={showCreate} players={players} tournaments={tournaments} onClose={() => setShowCreate(null)} onCreate={createRecord}/>}
  </div>;
}

function PageHeading({eyebrow, title, description, actionLabel, onAction}: {eyebrow:string;title:string;description:string;actionLabel?:string;onAction?:()=>void}) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{actionLabel && <button className="primary-btn" onClick={onAction}><Plus size={17}/>{actionLabel}</button>}</div>;
}
function Overview({players,tournaments,matches,liveMatches,completedMatches,loading,setView,setShowCreate,selectMatch}:any) {
  const scheduled = matches.filter((m:Match) => (m.status||"").toUpperCase() === "SCHEDULED").length;
  return <><PageHeading eyebrow="MONDAY, OCTOBER 26, 2026" title="Your arena, at a glance." description="Everything happening across your badminton events." actionLabel="New tournament" onAction={() => setShowCreate("tournament")}/>
    <div className="welcome-banner"><div className="welcome-copy"><div className="banner-pill"><span/> LIVE OPERATIONS</div><h2>Every point tells a story.</h2><p>Manage your tournaments, track matches in real time, and keep every court in sync.</p><button className="banner-btn" onClick={() => setView("Live scoring")}>Open live scoring <ArrowUpRight size={16}/></button></div><div className="banner-art"><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><div className="art-court"><div className="court-midline"/><div className="court-net"/><div className="court-service top"/><div className="court-service bottom"/></div><div className="shuttle"><span/></div><div className="art-label"><Radio size={13}/> REAL-TIME SCORE</div></div><div className="banner-noise"/></div>
    <div className="stats-grid"><Stat icon={Trophy} label="Tournaments" value={tournaments.length} change="Your event hub" tone="mint"/><Stat icon={Users} label="Registered players" value={players.length} change="Athletes in your roster" tone="violet"/><Stat icon={Radio} label="Live matches" value={liveMatches.length} change={liveMatches.length ? "In progress right now" : "No active matches"} tone="orange"/><Stat icon={Flag} label="Matches completed" value={completedMatches.length} change={`${scheduled} scheduled next`} tone="blue"/></div>
    <div className="section-heading"><div><h2>On the courts</h2><p>Follow the action as it happens.</p></div><button className="text-btn" onClick={() => setView("Matches")}>All matches <ArrowUpRight size={15}/></button></div>
    <div className="match-grid">{loading ? <div className="empty-state"><RefreshCw className="spin" size={22}/>Loading your arena…</div> : matches.slice(0,3).length ? matches.slice(0,3).map((m:Match) => <MatchCard key={m.id} match={m} onClick={() => selectMatch(m.id)}/>) : <div className="empty-state"><div className="empty-icon"><Swords size={22}/></div><strong>Your first match starts here</strong><p>Create a match to bring the court to life.</p><button className="primary-btn" onClick={() => setShowCreate("match")}><Plus size={16}/> Create a match</button></div>}</div>
    <div className="bottom-grid"><div className="panel"><div className="panel-head"><div><h3>Quick actions</h3><p>Keep things moving.</p></div><Zap size={18} className="muted-icon"/></div><div className="quick-actions"><button onClick={() => setShowCreate("player")}><span className="quick-icon qi-purple"><UserRound size={18}/></span><span><strong>Add a player</strong><small>Register a new athlete</small></span><ArrowDownRight size={16}/></button><button onClick={() => setShowCreate("tournament")}><span className="quick-icon qi-green"><Trophy size={18}/></span><span><strong>Create tournament</strong><small>Set up your next event</small></span><ArrowDownRight size={16}/></button><button onClick={() => setShowCreate("match")}><span className="quick-icon qi-orange"><Swords size={18}/></span><span><strong>Schedule a match</strong><small>Put players on court</small></span><ArrowDownRight size={16}/></button></div></div><div className="panel pulse-panel"><div className="panel-head"><div><h3>Platform pulse</h3><p>Connection and activity</p></div><ChartNoAxesCombined size={18} className="muted-icon"/></div><div className="pulse-status"><span className="pulse-ring"><Wifi size={19}/></span><div><strong>Ready for game day</strong><small>Refresh after changes to sync the dashboard.</small></div></div><div className="pulse-foot"><span><span className="mini-dot"/> API status</span><strong>Connected when green</strong></div></div></div>
  </>;
}
function Stat({icon:Icon,label,value,change,tone}:any) { return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={19}/></div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-change"><span className="change-dot"/> {change}</div></div>; }
function MatchCard({match,onClick}: {match:Match;onClick:()=>void}) {
  const s = scoreOf(match); const status = (match.status || "SCHEDULED").toUpperCase();
  return <button className="match-card" onClick={onClick}><div className="match-card-top"><span className="court-tag"><span/> COURT 01</span><span className={`status-badge ${statusClass(status)}`}>{status === "LIVE" && <i/>}{status}</span></div><div className="match-players"><div className="match-person"><div className="player-avatar pa-one">{initials(displayName(match.playerOne))}</div><div><strong>{displayName(match.playerOne)}</strong><small>Player 01</small></div><b>{s.points[0]}</b></div><div className="match-person"><div className="player-avatar pa-two">{initials(displayName(match.playerTwo))}</div><div><strong>{displayName(match.playerTwo)}</strong><small>Player 02</small></div><b>{s.points[1]}</b></div></div><div className="match-card-foot"><span>{displayName(match.tournament) || "Friendly match"}</span><span>{status === "LIVE" ? <><Radio size={13}/> Live now</> : status === "COMPLETED" ? "Final score" : <><Clock3 size={13}/> Scheduled</>}</span></div></button>;
}

function LiveScoring({matches,selected,setSelected,action,setShowCreate,refresh}:any) {
  const [pointBusy,setPointBusy] = useState(false);
  const [events,setEvents] = useState<any[]>([]);
  const s = selected
    ? scoreOf(selected)
    : {games:[],points:[0,0],gamesWon:[0,0]};

  // Load recent match events whenever the selected match changes or its version updates.
  useEffect(() => {
    let cancelled = false;

    if (!selected?.id) {
      setEvents([]);
      return;
    }

    api<any>(`/api/matches/${selected.id}/events`)
      .then(r => {
        if (!cancelled) setEvents(rows<any>(r).slice(-6).reverse());
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      });

    return () => {
      cancelled = true;
    };
  }, [selected?.id, selected?.version]);

  // Poll the backend every 3 seconds while the match is live or paused.
  useEffect(() => {
    if (
      !selected?.id ||
      !["LIVE", "PAUSED"].includes(String(selected.status).toUpperCase())
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      void refresh();
    }, 3000);

    return () => window.clearInterval(timer);
  }, [selected?.id, selected?.status, refresh]);

  async function score(side: 0 | 1) {
    if (!selected || pointBusy) return;

    setPointBusy(true);
    try {
      await action(
        `/api/matches/${selected.id}/points`,
        "POST",
        {
          winnerSide: side,
          expectedVersion: selected.version
        },
        "Point recorded"
      );

      await refresh();
    } finally {
      setPointBusy(false);
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="COURTSIDE CONTROL"
        title="Live scoring"
        description="Keep every rally accurate. Updates are saved to your tournament backend."
        actionLabel="New match"
        onAction={() => setShowCreate("match")}
      />

      <div className="live-layout">
        <div className="live-main">
          {!matches.length ? (
            <div className="empty-state tall">
              <div className="empty-icon"><Radio size={23}/></div>
              <strong>No matches yet</strong>
              <p>Create players and a match, then start scoring.</p>
              <button
                className="primary-btn"
                onClick={() => setShowCreate("match")}
              >
                <Plus size={16}/> Create a match
              </button>
            </div>
          ) : (
            <>
              <div className="live-select-row">
                <label>SELECT MATCH</label>
                <select
                  value={selected?.id || ""}
                  onChange={e => setSelected(e.target.value)}
                >
                  {matches.map((m: Match) => (
                    <option key={m.id} value={m.id}>
                      {displayName(m.playerOne)} vs {displayName(m.playerTwo)} · {m.status}
                    </option>
                  ))}
                </select>
                <button
                  className="icon-btn"
                  onClick={() => void refresh()}
                  title="Refresh match"
                >
                  <RefreshCw size={16}/>
                </button>
              </div>

              <div className="scoreboard">
                <div className="scoreboard-head">
                  <span>
                    <span className="score-live-dot"/>
                    COURTPULSE LIVE SCORE
                  </span>
                  <span className={`status-badge ${statusClass(selected?.status)}`}>
                    {selected?.status}
                  </span>
                </div>

                <div className="scoreboard-tournament">
                  {displayName(selected?.tournament) || "Friendly match"}
                  <span>·</span> Best of {selected?.bestOf || 3}
                </div>

                <div className="score-contestants">
                  <div className="contestant">
                    <div className="contestant-avatar avatar-a">
                      {initials(displayName(selected?.playerOne))}
                    </div>
                    <strong>{displayName(selected?.playerOne)}</strong>
                    <small>PLAYER ONE</small>
                    <div className="big-score">{s.points[0]}</div>
                    <div className="games-won">
                      GAMES WON <b>{s.gamesWon[0]}</b>
                    </div>
                  </div>

                  <div className="versus">
                    VS<span>COURT 01</span>
                  </div>

                  <div className="contestant">
                    <div className="contestant-avatar avatar-b">
                      {initials(displayName(selected?.playerTwo))}
                    </div>
                    <strong>{displayName(selected?.playerTwo)}</strong>
                    <small>PLAYER TWO</small>
                    <div className="big-score">{s.points[1]}</div>
                    <div className="games-won">
                      GAMES WON <b>{s.gamesWon[1]}</b>
                    </div>
                  </div>
                </div>

                <div className="game-history">
                  {s.games.length ? (
                    s.games.map((g: any, i: number) => (
                      <div className="game-pill" key={i}>
                        <small>GAME {i + 1}</small>
                        <strong>
                          {g.playerOne} <span>–</span> {g.playerTwo}
                        </strong>
                      </div>
                    ))
                  ) : (
                    <span className="no-games">
                      Game scores appear here as each game finishes
                    </span>
                  )}
                </div>

                <div className="score-actions">
                  <button
                    className="point-btn point-a"
                    disabled={pointBusy || selected?.status !== "LIVE"}
                    onClick={() => score(0)}
                  >
                    <Plus size={18}/>
                    <span>Point for {displayName(selected?.playerOne)}</span>
                  </button>

                  <button
                    className="point-btn point-b"
                    disabled={pointBusy || selected?.status !== "LIVE"}
                    onClick={() => score(1)}
                  >
                    <Plus size={18}/>
                    <span>Point for {displayName(selected?.playerTwo)}</span>
                  </button>
                </div>

                <div className="match-controls">
                  {selected?.status === "SCHEDULED" && (
                    <button
                      className="control-btn start"
                      onClick={() => action(
                        `/api/matches/${selected.id}/start`,
                        "POST",
                        {expectedVersion:selected.version},
                        "Match started"
                      )}
                    >
                      <Play size={15} fill="currentColor"/> Start match
                    </button>
                  )}

                  {selected?.status === "LIVE" && (
                    <button
                      className="control-btn"
                      onClick={() => action(
                        `/api/matches/${selected.id}/pause`,
                        "POST",
                        {expectedVersion:selected.version},
                        "Match paused"
                      )}
                    >
                      <Pause size={15}/> Pause match
                    </button>
                  )}

                  {selected?.status === "PAUSED" && (
                    <button
                      className="control-btn start"
                      onClick={() => action(
                        `/api/matches/${selected.id}/resume`,
                        "POST",
                        {expectedVersion:selected.version},
                        "Match resumed"
                      )}
                    >
                      <Play size={15} fill="currentColor"/> Resume match
                    </button>
                  )}

                  <span className="version-label">
                    VERSION {selected?.version ?? "—"}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        <aside className="live-side">
          <div className="panel">
            <div className="panel-head">
              <div>
                <h3>Match timeline</h3>
                <p>Latest scoring events</p>
              </div>
              <Activity size={17} className="muted-icon"/>
            </div>

            {events.length ? (
              <div className="timeline">
                {events.map((e: any, i: number) => (
                  <div className="timeline-row" key={e.id || i}>
                    <span className="timeline-marker"><Check size={12}/></span>
                    <div>
                      <strong>{String(e.type || "Event").replaceAll("_", " ")}</strong>
                      <small>
                        {e.pointWinnerId ? "Point awarded" : "Match status updated"}
                      </small>
                    </div>
                    <time>{e.sequence ? `#${e.sequence}` : ""}</time>
                  </div>
                ))}
              </div>
            ) : (
              <div className="timeline-empty">
                <Activity size={22}/>
                <p>Events will appear here as the match progresses.</p>
              </div>
            )}
          </div>

          <div className="tip-card">
            <div className="tip-icon"><ShieldCheck size={19}/></div>
            <strong>Scoring integrity</strong>
            <p>Every score update is versioned and stored in the event history.</p>
          </div>
        </aside>
      </div>
    </>
  );
}
function TableToolbar({search,setSearch,placeholder,actionLabel,onAction}:any) { return <div className="table-toolbar"><div className="search-box"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder={placeholder}/>{search && <button onClick={() => setSearch("")}><X size={14}/></button>}</div><button className="primary-btn" onClick={onAction}><Plus size={16}/>{actionLabel}</button></div>; }
function Matches({matches,loading,search,setSearch,setShowCreate,onSelect}:any) { return <><PageHeading eyebrow="MATCH CENTER" title="All matches" description="Schedule, manage, and jump into any court." actionLabel="Create match" onAction={() => setShowCreate("match")}/><TableToolbar search={search} setSearch={setSearch} placeholder="Search players or tournament…" actionLabel="New match" onAction={() => setShowCreate("match")}/><div className="data-panel"><div className="data-panel-head"><div><h3>Match schedule</h3><p>{matches.length} match{matches.length===1?"":"es"} in view</p></div><span className="table-tag"><Command size={13}/> MATCH OPERATIONS</span></div>{loading ? <LoadingRows/> : matches.length ? <div className="match-list">{matches.map((m:Match)=><div className="match-list-row" key={m.id}><div className="list-match-icon"><Swords size={18}/></div><div className="match-list-info"><strong>{displayName(m.playerOne)} <span>vs</span> {displayName(m.playerTwo)}</strong><small>{displayName(m.tournament) || "Friendly match"} · Best of {m.bestOf || 3}</small></div><div className="list-score">{scoreOf(m).points[0]} <span>–</span> {scoreOf(m).points[1]}</div><span className={`status-badge ${statusClass(m.status)}`}>{m.status}</span><button className="row-action" onClick={() => onSelect(m.id)}>Open <ArrowUpRight size={14}/></button></div>)}</div> : <EmptyTable title="No matches found" detail="Create a match or adjust your search."/>}</div></>; }
function Tournaments({tournaments,loading,search,setSearch,setShowCreate}:any) { return <><PageHeading eyebrow="EVENT MANAGEMENT" title="Tournaments" description="Build your event, bring players together, and keep every match organized." actionLabel="New tournament" onAction={() => setShowCreate("tournament")}/><TableToolbar search={search} setSearch={setSearch} placeholder="Search tournaments…" actionLabel="Create tournament" onAction={() => setShowCreate("tournament")}/><div className="tournament-grid">{loading ? <LoadingRows/> : tournaments.length ? tournaments.map((t:Tournament,i:number)=><div className="tournament-card" key={t.id}><div className={`tournament-art art-${i%3}`}><div className="tourney-watermark"><Trophy size={66}/></div><span className="tourney-kicker">COURTPULSE EVENT</span><span className="tourney-initials">{initials(displayName(t))}</span></div><div className="tournament-body"><div className="tournament-title-row"><h3>{displayName(t)}</h3><span className={`status-badge ${statusClass(t.status)}`}>{t.status || "PLANNED"}</span></div><div className="tournament-meta"><span><CalendarDays size={14}/>{dateLabel(t.startDate)}</span><span><Users size={14}/>{t._count?.participants ?? t.participants?.length ?? 0} players</span></div><div className="tournament-footer"><span><Compass size={14}/>{t.location || "Location to be announced"}</span><span className="event-id">EVENT · {idOf(t).slice(0,6).toUpperCase()}</span></div></div></div>) : <EmptyTable title="No tournaments yet" detail="Create your first event and start organizing."/>}</div></>; }
function Players({players,loading,search,setSearch,setShowCreate}:any) { return <><PageHeading eyebrow="ATHLETE DIRECTORY" title="Players" description="Your athlete roster, all in one place." actionLabel="Add player" onAction={() => setShowCreate("player")}/><TableToolbar search={search} setSearch={setSearch} placeholder="Search player name or email…" actionLabel="Add player" onAction={() => setShowCreate("player")}/><div className="data-panel"><div className="data-panel-head"><div><h3>Registered athletes</h3><p>{players.length} player{players.length===1?"":"s"} registered</p></div><span className="table-tag"><Users size={13}/> PLAYER DIRECTORY</span></div>{loading ? <LoadingRows/> : players.length ? <div className="player-grid">{players.map((p:Player,i:number)=><div className="player-card" key={p.id}><div className={`player-large-avatar avatar-color-${i%5}`}>{initials(displayName(p))}</div><div className="player-card-name"><strong>{displayName(p)}</strong><span>{p.email || "No email provided"}</span></div><div className="player-card-bottom"><span><span className="mini-dot"/> REGISTERED PLAYER</span>{p.ranking ? <span className="rank-chip"><Award size={13}/> Rank {p.ranking}</span> : <span className="player-id">#{idOf(p).slice(0,6).toUpperCase()}</span>}</div></div>)}</div> : <EmptyTable title="Your roster is empty" detail="Add players before creating competitive matches."/>}</div></>; }
function LoadingRows() { return <div className="loading-state"><RefreshCw size={18} className="spin"/> Loading data…</div>; }
function EmptyTable({title,detail}: {title:string;detail:string}) { return <div className="empty-state table-empty"><div className="empty-icon"><Search size={20}/></div><strong>{title}</strong><p>{detail}</p></div>; }

function CreateModal({kind,players,tournaments,onClose,onCreate}:any) {
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [form,setForm] = useState<any>({name:"",email:"",phone:"",location:"",startDate:"",endDate:"",playerOneId:"",playerTwoId:"",tournamentId:"",bestOf:"3"});
  const update = (key:string,value:string) => setForm((old:any)=>({...old,[key]:value}));
  async function submit(e:React.FormEvent) {
    e.preventDefault();setError("");setBusy(true);
    let data:any;
    if(kind==="player") data={name:form.name.trim(),...(form.email.trim()?{email:form.email.trim()}:{}),...(form.phone.trim()?{phone:form.phone.trim()}:{})};
    if(kind==="tournament") data={name:form.name.trim(),...(form.location.trim()?{location:form.location.trim()}:{}),...(form.startDate?{startDate:new Date(form.startDate).toISOString()}:{}),...(form.endDate?{endDate:new Date(form.endDate).toISOString()}:{})};
    if(kind==="match") data={playerOneId:form.playerOneId,playerTwoId:form.playerTwoId,bestOf:Number(form.bestOf),...(form.tournamentId?{tournamentId:form.tournamentId}:{})};
    if(kind==="match" && (!form.playerOneId || !form.playerTwoId || form.playerOneId===form.playerTwoId)) {setError("Choose two different players.");setBusy(false);return;}
    try { await onCreate(kind,data); } catch(e) { setError(e instanceof Error?e.message:"Unable to save"); } finally {setBusy(false);}
  }
  const title = kind==="player"?"Add a player":kind==="tournament"?"Create tournament":"Schedule a match";
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><form className="modal" onSubmit={submit}><div className="modal-head"><div><div className="eyebrow">COURTPULSE / NEW RECORD</div><h2>{title}</h2><p>{kind==="player"?"Add an athlete to your roster.":kind==="tournament"?"Set up a new tournament event.":"Choose the competitors and match format."}</p></div><button type="button" className="icon-btn" onClick={onClose}><X size={18}/></button></div>
    {kind!=="match" && <><label className="field-label">{kind==="player"?"Player name":"Tournament name"}<input required autoFocus value={form.name} onChange={e=>update("name",e.target.value)} placeholder={kind==="player"?"e.g. Aarya Sharma":"e.g. Monsoon Open 2026"}/></label>{kind==="player" ? <div className="form-row"><label className="field-label">Email (optional)<input type="email" value={form.email} onChange={e=>update("email",e.target.value)} placeholder="player@example.com"/></label><label className="field-label">Phone (optional)<input value={form.phone} onChange={e=>update("phone",e.target.value)} placeholder="+91…"/></label></div> : <><label className="field-label">Venue / location<input value={form.location} onChange={e=>update("location",e.target.value)} placeholder="e.g. Pune Sports Arena"/></label><div className="form-row"><label className="field-label">Start date<input type="date" value={form.startDate} onChange={e=>update("startDate",e.target.value)}/></label><label className="field-label">End date<input type="date" value={form.endDate} onChange={e=>update("endDate",e.target.value)}/></label></div></>}</>}
    {kind==="match" && <><label className="field-label">Player one<select required value={form.playerOneId} onChange={e=>update("playerOneId",e.target.value)}><option value="">Choose first player</option>{players.map((p:Player)=><option key={p.id} value={p.id}>{displayName(p)}</option>)}</select></label><label className="field-label">Player two<select required value={form.playerTwoId} onChange={e=>update("playerTwoId",e.target.value)}><option value="">Choose second player</option>{players.map((p:Player)=><option key={p.id} value={p.id}>{displayName(p)}</option>)}</select></label><div className="form-row"><label className="field-label">Match format<select value={form.bestOf} onChange={e=>update("bestOf",e.target.value)}><option value="1">Best of 1 game</option><option value="3">Best of 3 games</option><option value="5">Best of 5 games</option></select></label><label className="field-label">Tournament<select value={form.tournamentId} onChange={e=>update("tournamentId",e.target.value)}><option value="">Friendly / no tournament</option>{tournaments.map((t:Tournament)=><option key={t.id} value={t.id}>{displayName(t)}</option>)}</select></label></div>{players.length<2 && <div className="inline-warning">Add at least two players before scheduling a match.</div>}</>}
    {error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary-btn" onClick={onClose}>Cancel</button><button type="submit" className="primary-btn" disabled={busy || (kind==="match" && players.length<2)}>{busy?"Saving…":<><Plus size={16}/> {kind==="player"?"Add player":kind==="tournament"?"Create tournament":"Create match"}</>}</button></div>
    </form></div>;
}