"use client";

import { useMemo, useState } from "react";
import { TeamColorPicker } from "@/components/TeamColorPicker";

type Side = "A" | "B";
type Point = "0" | "15" | "30" | "40" | "Ad" | "Game";

type Player = {
  name: string;
};

type Team = {
  name: string;
  players: [Player, Player];
};

type MatchConfig = {
  bestOfSets: number;
  gamesPerSetToWin: number;
  tieBreakAt?: number | null;
};

type GameScore = {
  A: Point;
  B: Point;
};

type SetScore = {
  A: number;
  B: number;
};

type MatchState = {
  sets: SetScore[];
  currentGame: GameScore;
  currentSetIndex: number;
  winner: Side | null;
};

type TeamColors = Record<Side, string>;

const defaultTeams: Record<Side, Team> = {
  A: {
    name: "Team A",
    players: [{ name: "Player A1" }, { name: "Player A2" }],
  },
  B: {
    name: "Team B",
    players: [{ name: "Player B1" }, { name: "Player B2" }],
  },
};

const defaultConfig: MatchConfig = {
  bestOfSets: 3,
  gamesPerSetToWin: 6,
  tieBreakAt: 6,
};

const defaultTeamColors: TeamColors = {
  A: "#22c55e", // emerald-500
  B: "#0ea5e9", // sky-500
};

function isValidHexColor(value: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

function normalizeHex(value: string): string {
  let v = value.trim();
  if (!v.startsWith("#")) v = `#${v}`;
  if (!isValidHexColor(v)) return v;
  // Expand 3-digit hex to 6-digit for consistent luminance calc
  if (v.length === 4) {
    const r = v[1];
    const g = v[2];
    const b = v[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return v.toLowerCase();
}

function getContrastTextColor(hexColor: string): string {
  const c = normalizeHex(hexColor);
  if (!isValidHexColor(c)) return "#000000";
  const r = parseInt(c.slice(1, 3), 16) / 255;
  const g = parseInt(c.slice(3, 5), 16) / 255;
  const b = parseInt(c.slice(5, 7), 16) / 255;

  const [R, G, B] = [r, g, b].map((channel) =>
    channel <= 0.03928
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4),
  );

  const luminance = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  return luminance > 0.5 ? "#000000" : "#ffffff";
}

function nextPoint(current: GameScore, scoringSide: Side): GameScore {
  const opponent: Side = scoringSide === "A" ? "B" : "A";
  const p = current[scoringSide];
  const o = current[opponent];

  // If game is already won, keep as is
  if (p === "Game" || o === "Game") return current;

  // Deuce/Advantage logic
  if (p === "40" && o === "40") {
    return { ...current, [scoringSide]: "Ad" };
  }
  if (p === "Ad") {
    return { ...current, [scoringSide]: "Game" };
  }
  if (o === "Ad") {
    return { ...current, [opponent]: "40" };
  }

  // Normal progression
  const order: Point[] = ["0", "15", "30", "40", "Game"];
  const idx = order.indexOf(p);
  const next = order[Math.min(idx + 1, order.length - 1)];
  return { ...current, [scoringSide]: next };
}

function isGameWon(game: GameScore): Side | null {
  if (game.A === "Game") return "A";
  if (game.B === "Game") return "B";
  return null;
}

function isSetWon(
  setScore: SetScore,
  config: MatchConfig,
  isFinalSet: boolean,
): Side | null {
  const { gamesPerSetToWin, tieBreakAt } = config;
  const { A, B } = setScore;

  // Simple rule: at least gamesPerSetToWin games and 2-game difference,
  // unless tieBreakAt is reached (e.g. 6-6) where next game decides.

  if (tieBreakAt && A === tieBreakAt && B === tieBreakAt) {
    // Next game decides set
    // Caller will increment then re-call; here just checks typical difference rule.
  }

  if (A >= gamesPerSetToWin && A - B >= 2) return "A";
  if (B >= gamesPerSetToWin && B - A >= 2) return "B";

  // Optional: in a tiebreak set we can allow 7–6 etc.
  if (tieBreakAt && (A === tieBreakAt + 1 || B === tieBreakAt + 1)) {
    if (A === tieBreakAt + 1 && B === tieBreakAt) return "A";
    if (B === tieBreakAt + 1 && A === tieBreakAt) return "B";
  }

  return null;
}

function isMatchWon(sets: SetScore[], bestOfSets: number): Side | null {
  const needed = Math.floor(bestOfSets / 2) + 1;
  const aSets = sets.filter((s) => s.A > s.B).length;
  const bSets = sets.filter((s) => s.B > s.A).length;
  if (aSets >= needed) return "A";
  if (bSets >= needed) return "B";
  return null;
}

function createInitialMatch(config: MatchConfig): MatchState {
  const initialSets: SetScore[] = [{ A: 0, B: 0 }];
  return {
    sets: initialSets,
    currentGame: { A: "0", B: "0" },
    currentSetIndex: 0,
    winner: null,
  };
}

export default function Home() {
  const [teams, setTeams] = useState<Record<Side, Team>>(defaultTeams);
  const [config, setConfig] = useState<MatchConfig>(defaultConfig);
  const [match, setMatch] = useState<MatchState>(() =>
    createInitialMatch(defaultConfig),
  );
  const [history, setHistory] = useState<MatchState[]>([]);
  const [teamColors, setTeamColors] =
    useState<TeamColors>(defaultTeamColors);
  const [server, setServer] = useState<Side>("A");
  const [servingPlayerIndex, setServingPlayerIndex] = useState<0 | 1>(0);
  const [serveIdentifierStyle, setServeIdentifierStyle] = useState<
    "player" | "team"
  >("player");
  const [isCompactView, setIsCompactView] = useState(false);

  const currentSet = match.sets[match.currentSetIndex];

  const setScoreSummary = useMemo(
    () =>
      match.sets.map((s, idx) => ({
        index: idx + 1,
        A: s.A,
        B: s.B,
      })),
    [match.sets],
  );

  function resetMatch(newConfig?: MatchConfig) {
    const cfg = newConfig ?? config;
    setMatch(createInitialMatch(cfg));
    setHistory([]);
  }

  function handleConfigChange(field: keyof MatchConfig, value: number) {
    const nextConfig = {
      ...config,
      [field]: value,
    };
    setConfig(nextConfig);
  }

  function handleTeamNameChange(side: Side, value: string) {
    setTeams((prev) => ({
      ...prev,
      [side]: {
        ...prev[side],
        name: value,
      },
    }));
  }

  function handleTeamColorChange(side: Side, rawValue: string) {
    const normalized = normalizeHex(rawValue);
    setTeamColors((prev) => ({
      ...prev,
      [side]: normalized,
    }));
  }

  function handlePlayerNameChange(
    side: Side,
    index: 0 | 1,
    value: string,
  ) {
    setTeams((prev) => {
      const updatedPlayers: [Player, Player] = [...prev[side].players] as [
        Player,
        Player,
      ];
      updatedPlayers[index] = { name: value };
      return {
        ...prev,
        [side]: {
          ...prev[side],
          players: updatedPlayers,
        },
      };
    });
  }

  function handlePoint(side: Side) {
    if (match.winner) return;

    // Save current state for undo
    setHistory((prev) => [...prev, match]);

    const nextGame = nextPoint(match.currentGame, side);
    const gameWinner = isGameWon(nextGame);

    if (!gameWinner) {
      setMatch((prev) => ({
        ...prev,
        currentGame: nextGame,
      }));
      return;
    }

    // Update set score
    setMatch((prev) => {
      const newSets = [...prev.sets];
      const setIdx = prev.currentSetIndex;
      const currentSetScore = newSets[setIdx];

      const updatedSet: SetScore = {
        ...currentSetScore,
        [gameWinner]: currentSetScore[gameWinner] + 1,
      };

      newSets[setIdx] = updatedSet;

      const setWinner = isSetWon(
        updatedSet,
        config,
        setIdx === config.bestOfSets - 1,
      );

      let winner: Side | null = null;
      let currentSetIndex = prev.currentSetIndex;

      if (setWinner) {
        const maybeWinner = isMatchWon(newSets, config.bestOfSets);
        if (maybeWinner) {
          winner = maybeWinner;
        } else if (newSets.length < config.bestOfSets) {
          newSets.push({ A: 0, B: 0 });
          currentSetIndex = prev.currentSetIndex + 1;
        }
      }

      return {
        sets: newSets,
        currentGame: { A: "0", B: "0" },
        currentSetIndex,
        winner,
      };
    });
  }

  function undoLastPoint() {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const previous = prev[prev.length - 1];
      setMatch(previous);
      return prev.slice(0, -1);
    });
  }

  function clearCurrentGame() {
    // Save current state for undo
    setHistory((prev) => [...prev, match]);
    setMatch((prev) => ({
      ...prev,
      currentGame: { A: "0", B: "0" },
    }));
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-900 text-zinc-50">
      {/* Top: scoreboard for OBS */}
      <div className="flex w-full justify-center border-b border-zinc-800 bg-gradient-to-r from-zinc-900 via-zinc-950 to-zinc-900 px-4 py-3">
        {isCompactView ? (
          /* Compact scoreboard view - fixed width: always bestOfSets columns, upcoming sets are transparent placeholders */
          <div
            className="w-fit rounded-xl border border-zinc-800/80 bg-zinc-950/80 shadow-[0_0_40px_rgba(0,0,0,0.6)] backdrop-blur-md overflow-hidden"
            style={{
              display: "grid",
              gridTemplateColumns: `4rem auto ${Array(config.bestOfSets).fill("3rem").join(" ")} 4rem`,
              gridTemplateRows: "3rem 3rem",
            }}
          >
            {(() => {
              const totalSetsA = match.sets
                .slice(0, match.currentSetIndex)
                .reduce((sum, s) => sum + (s.A > s.B ? 1 : 0), 0);
              const totalSetsB = match.sets
                .slice(0, match.currentSetIndex)
                .reduce((sum, s) => sum + (s.B > s.A ? 1 : 0), 0);
              const isALeading =
                totalSetsA > totalSetsB ||
                (totalSetsA === totalSetsB && (currentSet?.A ?? 0) >= (currentSet?.B ?? 0));
              const topTeam = isALeading ? "A" : "B";
              const bottomTeam = isALeading ? "B" : "A";

              return (
                <>
                  {/* Row 1 - Leading team */}
                  <div
                    className="col-span-1 row-span-1 flex h-12 items-center border-b border-zinc-800/50 bg-black/30"
                    style={{ gridColumn: 1 }}
                  >
                    <div
                      className="h-full w-full"
                      style={{ backgroundColor: teamColors[topTeam] }}
                    />
                  </div>
                  <div
                    className="col-span-1 flex h-12 items-center border-b border-zinc-800/50 bg-black/30 px-3"
                    style={{ gridColumn: 2 }}
                  >
                    <span className="whitespace-nowrap text-sm font-bold uppercase tracking-wide text-zinc-50">
                      {serveIdentifierStyle === "player" ? (
                        server === topTeam && servingPlayerIndex === 0 ? (
                          <>
                            {teams[topTeam].players[0].name.toUpperCase()}{" "}
                            <span className="text-red-500">●</span> /{" "}
                            {teams[topTeam].players[1].name.toUpperCase()}
                          </>
                        ) : server === topTeam && servingPlayerIndex === 1 ? (
                          <>
                            {teams[topTeam].players[0].name.toUpperCase()} /{" "}
                            {teams[topTeam].players[1].name.toUpperCase()}{" "}
                            <span className="text-red-500">●</span>
                          </>
                        ) : (
                          <>
                            {teams[topTeam].players[0].name.toUpperCase()} /{" "}
                            {teams[topTeam].players[1].name.toUpperCase()}
                          </>
                        )
                      ) : (
                        <>
                          {teams[topTeam].players[0].name.toUpperCase()} /{" "}
                          {teams[topTeam].players[1].name.toUpperCase()}
                          {server === topTeam && (
                            <>
                              {" "}
                              <span className="text-red-500">●</span>
                            </>
                          )}
                        </>
                      )}
                    </span>
                  </div>
                  {Array.from({ length: config.bestOfSets }, (_, col) => {
                    // Rightmost column = current set; finished sets fill left to right (oldest left)
                    const setIndex = match.currentSetIndex + col - config.bestOfSets + 1;
                    const set = setIndex >= 0 && setIndex < match.sets.length ? match.sets[setIndex] : undefined;
                    const isPlaceholder = set === undefined;
                    return (
                      <div
                        key={col}
                        className={`flex h-12 w-12 shrink-0 items-center justify-center ${isPlaceholder ? "border-transparent bg-transparent" : "border-b border-l border-r border-zinc-800/50 bg-[#1e3a5f]"}`}
                        style={{ gridColumn: 3 + col }}
                      >
                        {!isPlaceholder && (
                          <span className="text-lg font-bold tabular-nums text-zinc-50">
                            {topTeam === "A" ? set.A : set.B}
                          </span>
                        )}
                      </div>
                    );
                  })}
                  <div
                    className="flex h-12 items-center justify-center border-b border-zinc-800/50 bg-[#c2410c]"
                    style={{ gridColumn: 3 + config.bestOfSets }}
                  >
                    <span className="text-lg font-bold tabular-nums text-white">
                      {topTeam === "A" ? match.currentGame.A : match.currentGame.B}
                    </span>
                  </div>

                  {/* Row 2 - Trailing team */}
                  <div
                    className="flex h-12 items-center bg-black/20"
                    style={{ gridColumn: 1, gridRow: 2 }}
                  >
                    <div
                      className="h-full w-full"
                      style={{ backgroundColor: teamColors[bottomTeam] }}
                    />
                  </div>
                  <div
                    className="flex h-12 items-center bg-black/20 px-3"
                    style={{ gridColumn: 2, gridRow: 2 }}
                  >
                    <span className="whitespace-nowrap text-sm font-bold uppercase tracking-wide text-zinc-50">
                      {serveIdentifierStyle === "player" ? (
                        server === bottomTeam && servingPlayerIndex === 0 ? (
                          <>
                            {teams[bottomTeam].players[0].name.toUpperCase()}{" "}
                            <span className="text-red-500">●</span> /{" "}
                            {teams[bottomTeam].players[1].name.toUpperCase()}
                          </>
                        ) : server === bottomTeam && servingPlayerIndex === 1 ? (
                          <>
                            {teams[bottomTeam].players[0].name.toUpperCase()} /{" "}
                            {teams[bottomTeam].players[1].name.toUpperCase()}{" "}
                            <span className="text-red-500">●</span>
                          </>
                        ) : (
                          <>
                            {teams[bottomTeam].players[0].name.toUpperCase()} /{" "}
                            {teams[bottomTeam].players[1].name.toUpperCase()}
                          </>
                        )
                      ) : (
                        <>
                          {teams[bottomTeam].players[0].name.toUpperCase()} /{" "}
                          {teams[bottomTeam].players[1].name.toUpperCase()}
                          {server === bottomTeam && (
                            <>
                              {" "}
                              <span className="text-red-500">●</span>
                            </>
                          )}
                        </>
                      )}
                    </span>
                  </div>
                  {Array.from({ length: config.bestOfSets }, (_, col) => {
                    const setIndex = match.currentSetIndex + col - config.bestOfSets + 1;
                    const set = setIndex >= 0 && setIndex < match.sets.length ? match.sets[setIndex] : undefined;
                    const isPlaceholder = set === undefined;
                    return (
                      <div
                        key={col}
                        className={`flex h-12 w-12 shrink-0 items-center justify-center ${isPlaceholder ? "border-transparent bg-transparent" : "border-l border-r border-zinc-800/50 bg-[#1e3a5f]"}`}
                        style={{ gridColumn: 3 + col, gridRow: 2 }}
                      >
                        {!isPlaceholder && (
                          <span className="text-lg font-bold tabular-nums text-zinc-50">
                            {bottomTeam === "A" ? set.A : set.B}
                          </span>
                        )}
                      </div>
                    );
                  })}
                  <div
                    className="flex h-12 items-center justify-center bg-[#c2410c]"
                    style={{ gridColumn: 3 + config.bestOfSets, gridRow: 2 }}
                  >
                    <span className="text-lg font-bold tabular-nums text-white">
                      {bottomTeam === "A" ? match.currentGame.A : match.currentGame.B}
                    </span>
                  </div>
                </>
              );
            })()}
          </div>
        ) : (
          /* Standard scoreboard view */
          <div className="flex w-full max-w-5xl items-center justify-between gap-4 rounded-xl border border-zinc-800/80 bg-zinc-950/80 px-4 py-3 shadow-[0_0_40px_rgba(0,0,0,0.6)] backdrop-blur-md">
            {/* Left team */}
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span
                    className="rounded-sm px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide"
                    style={{
                      backgroundColor: teamColors.A,
                      color: getContrastTextColor(teamColors.A),
                    }}
                  >
                    Team A
                  </span>
                  {match.winner === "A" && (
                    <span className="rounded-sm bg-amber-400 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-950">
                      Winner
                    </span>
                  )}
                  {server === "A" && (
                    <span
                      className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                      style={{
                        borderColor: teamColors.A,
                        color: teamColors.A,
                      }}
                    >
                      {serveIdentifierStyle === "team"
                        ? "Serve"
                        : `Serve (${teams.A.players[servingPlayerIndex].name})`}
                    </span>
                  )}
                </div>
                <div className="truncate text-lg font-semibold">
                  {teams.A.name}
                </div>
                <div className="flex flex-wrap gap-x-3 text-xs text-zinc-400">
                  <span>
                    {teams.A.players[0].name} &bull;{" "}
                    {teams.A.players[1].name}
                  </span>
                </div>
              </div>
            </div>

            {/* Center: current set / game score */}
            <div className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-black/50 px-4 py-2">
              <div className="flex flex-col items-center text-[10px] uppercase tracking-wide text-zinc-400">
                <span>Set</span>
                <span className="text-lg font-semibold text-zinc-100">
                  {match.currentSetIndex + 1}
                </span>
              </div>

              <div className="h-8 w-px bg-zinc-800" />

              <div className="flex items-center gap-3 text-center">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                    A
                  </span>
                  <span className="text-2xl font-bold tabular-nums">
                    {currentSet?.A ?? 0}
                  </span>
                </div>
                <span className="text-sm text-zinc-500">Sets</span>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                    B
                  </span>
                  <span className="text-2xl font-bold tabular-nums">
                    {currentSet?.B ?? 0}
                  </span>
                </div>
              </div>

              <div className="h-8 w-px bg-zinc-800" />

              <div className="flex items-center gap-3 text-center">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                    A
                  </span>
                  <span
                    className="text-2xl font-bold tabular-nums"
                    style={{ color: teamColors.A }}
                  >
                    {match.currentGame.A}
                  </span>
                </div>
                <span className="text-sm text-zinc-500">Game</span>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                    B
                  </span>
                  <span
                    className="text-2xl font-bold tabular-nums"
                    style={{ color: teamColors.B }}
                  >
                    {match.currentGame.B}
                  </span>
                </div>
              </div>
            </div>

            {/* Right team */}
            <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2">
                  {server === "B" && (
                    <span
                      className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                      style={{
                        borderColor: teamColors.B,
                        color: teamColors.B,
                      }}
                    >
                      {serveIdentifierStyle === "team"
                        ? "Serve"
                        : `Serve (${teams.B.players[servingPlayerIndex].name})`}
                    </span>
                  )}
                  {match.winner === "B" && (
                    <span className="rounded-sm bg-amber-400 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-950">
                      Winner
                    </span>
                  )}
                  <span
                    className="rounded-sm px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide"
                    style={{
                      backgroundColor: teamColors.B,
                      color: getContrastTextColor(teamColors.B),
                    }}
                  >
                    Team B
                  </span>
                </div>
                <div className="truncate text-lg font-semibold">
                  {teams.B.name}
                </div>
                <div className="flex flex-wrap justify-end gap-x-3 text-xs text-zinc-400">
                  <span>
                    {teams.B.players[0].name} &bull;{" "}
                    {teams.B.players[1].name}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom: control panel for the operator (not captured in OBS if you crop) */}
      <div className="flex flex-1 justify-center px-4 pb-6 pt-4">
        <div className="grid w-full max-w-5xl grid-cols-1 gap-4 md:grid-cols-3">
          {/* Match configuration */}
          <section className="col-span-1 space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
              Match Settings
            </h2>

            <div className="space-y-2 text-sm">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-zinc-400">
                  Best of (sets)
                </span>
                <input
                  type="number"
                  min={1}
                  max={7}
                  value={config.bestOfSets}
                  onChange={(e) =>
                    handleConfigChange(
                      "bestOfSets",
                      Number(e.target.value || 1),
                    )
                  }
                  className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-50 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-zinc-400">
                  Games to win a set
                </span>
                <input
                  type="number"
                  min={4}
                  max={9}
                  value={config.gamesPerSetToWin}
                  onChange={(e) =>
                    handleConfigChange(
                      "gamesPerSetToWin",
                      Number(e.target.value || 6),
                    )
                  }
                  className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-50 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-zinc-400">
                  Tie-break at (games each, optional)
                </span>
                <input
                  type="number"
                  min={0}
                  max={9}
                  value={config.tieBreakAt ?? ""}
                  placeholder="6"
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") {
                      setConfig((prev) => ({
                        ...prev,
                        tieBreakAt: null,
                      }));
                    } else {
                      handleConfigChange("tieBreakAt", Number(raw));
                    }
                  }}
                  className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-50 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </label>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-medium text-zinc-400">
                  Compact scoreboard view
                </span>
                <button
                  type="button"
                  onClick={() => setIsCompactView(!isCompactView)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    isCompactView ? "bg-emerald-500" : "bg-zinc-700"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isCompactView ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={() => resetMatch()}
                className="inline-flex flex-1 items-center justify-center rounded-md border border-emerald-500/70 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
              >
                Reset Match (keep teams)
              </button>
              <button
                type="button"
                onClick={() => {
                  setTeams(defaultTeams);
                  resetMatch(defaultConfig);
                  setConfig(defaultConfig);
                }}
                className="inline-flex flex-1 items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-800"
              >
                Reset All
              </button>
            </div>

            <div className="pt-3 text-xs text-zinc-500">
              Crop only the top scoreboard area in OBS for a clean overlay.
            </div>
          </section>

          {/* Team and server controls */}
          <section className="col-span-1 space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
              Teams &amp; Serve
            </h2>

            <div className="space-y-3 text-sm">
              <div className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
                  Team A
                </span>
                <input
                  type="text"
                  value={teams.A.name}
                  onChange={(e) =>
                    handleTeamNameChange("A", e.target.value)
                  }
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-50 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <input
                    type="text"
                    value={teams.A.players[0].name}
                    onChange={(e) =>
                      handlePlayerNameChange("A", 0, e.target.value)
                    }
                    placeholder="Player A1"
                    className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-50 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                  <input
                    type="text"
                    value={teams.A.players[1].name}
                    onChange={(e) =>
                      handlePlayerNameChange("A", 1, e.target.value)
                    }
                    placeholder="Player A2"
                    className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-50 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div className="pt-1">
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium text-zinc-400">
                      Team A color
                    </span>
                    <TeamColorPicker
                      value={teamColors.A}
                      onChange={(color) => handleTeamColorChange("A", color)}
                      placeholder="#22c55e"
                      invalid={
                        !isValidHexColor(normalizeHex(teamColors.A))
                      }
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-1 pt-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-sky-300">
                  Team B
                </span>
                <input
                  type="text"
                  value={teams.B.name}
                  onChange={(e) =>
                    handleTeamNameChange("B", e.target.value)
                  }
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-50 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <input
                    type="text"
                    value={teams.B.players[0].name}
                    onChange={(e) =>
                      handlePlayerNameChange("B", 0, e.target.value)
                    }
                    placeholder="Player B1"
                    className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-50 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  />
                  <input
                    type="text"
                    value={teams.B.players[1].name}
                    onChange={(e) =>
                      handlePlayerNameChange("B", 1, e.target.value)
                    }
                    placeholder="Player B2"
                    className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-50 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  />
                </div>
                <div className="pt-1">
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium text-zinc-400">
                      Team B color
                    </span>
                    <TeamColorPicker
                      value={teamColors.B}
                      onChange={(color) => handleTeamColorChange("B", color)}
                      placeholder="#0ea5e9"
                      invalid={
                        !isValidHexColor(normalizeHex(teamColors.B))
                      }
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-400">
                  Serve identifier
                </span>
                <div className="inline-flex rounded-full border border-zinc-700 bg-zinc-900 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setServeIdentifierStyle("player")}
                    className={`rounded-full px-2 py-0.5 font-semibold ${
                      serveIdentifierStyle === "player"
                        ? "bg-zinc-100 text-zinc-900"
                        : "text-zinc-300"
                    }`}
                  >
                    Player
                  </button>
                  <button
                    type="button"
                    onClick={() => setServeIdentifierStyle("team")}
                    className={`rounded-full px-2 py-0.5 font-semibold ${
                      serveIdentifierStyle === "team"
                        ? "bg-zinc-100 text-zinc-900"
                        : "text-zinc-300"
                    }`}
                  >
                    Team
                  </button>
                </div>
              </div>
              <div className="text-xs text-zinc-500">
                {serveIdentifierStyle === "player"
                  ? "Shows which player is serving (dot next to name)."
                  : "Shows only which team is serving."}
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-medium text-zinc-400">
                  Serving team
                </span>
                <div className="inline-flex rounded-full border border-zinc-700 bg-zinc-900 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setServer("A")}
                    className={`rounded-full px-2 py-0.5 font-semibold ${
                      server === "A"
                        ? "bg-zinc-100 text-zinc-900"
                        : "text-zinc-300"
                    }`}
                  >
                    A
                  </button>
                  <button
                    type="button"
                    onClick={() => setServer("B")}
                    className={`rounded-full px-2 py-0.5 font-semibold ${
                      server === "B"
                        ? "bg-zinc-100 text-zinc-900"
                        : "text-zinc-300"
                    }`}
                  >
                    B
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-400">
                  Serving player
                </span>
                <div className="inline-flex rounded-full border border-zinc-700 bg-zinc-900 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setServingPlayerIndex(0)}
                    className={`rounded-full px-2 py-0.5 font-semibold ${
                      servingPlayerIndex === 0
                        ? "bg-zinc-100 text-zinc-900"
                        : "text-zinc-300"
                    }`}
                  >
                    1
                  </button>
                  <button
                    type="button"
                    onClick={() => setServingPlayerIndex(1)}
                    className={`rounded-full px-2 py-0.5 font-semibold ${
                      servingPlayerIndex === 1
                        ? "bg-zinc-100 text-zinc-900"
                        : "text-zinc-300"
                    }`}
                  >
                    2
                  </button>
                </div>
              </div>

              <div className="text-xs text-zinc-500">
                Serving player affects who serves next; visible on scoreboard
                only when identifier is &quot;Player&quot;.
              </div>
            </div>
          </section>

          {/* Scoring controls & set overview */}
          <section className="col-span-1 space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
              Scoring
            </h2>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <button
                type="button"
                onClick={() => handlePoint("A")}
                className="flex items-center justify-center rounded-md border border-emerald-500/80 bg-emerald-500/20 px-3 py-2 text-sm font-semibold text-emerald-100 shadow-sm transition hover:bg-emerald-500/30"
              >
                Point Team A
              </button>
              <button
                type="button"
                onClick={() => handlePoint("B")}
                className="flex items-center justify-center rounded-md border border-sky-500/80 bg-sky-500/20 px-3 py-2 text-sm font-semibold text-sky-100 shadow-sm transition hover:bg-sky-500/30"
              >
                Point Team B
              </button>
              <button
                type="button"
                onClick={clearCurrentGame}
                className="col-span-2 flex items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-800"
              >
                Clear current game points
              </button>
              <button
                type="button"
                onClick={undoLastPoint}
                className="col-span-2 flex items-center justify-center rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-900"
              >
                Undo last point
              </button>
            </div>

            <div className="space-y-2 pt-2 text-xs">
              <div className="flex items-center justify-between text-zinc-400">
                <span>Set breakdown</span>
                <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-300">
                  Best of {config.bestOfSets}
                </span>
              </div>
              <div className="space-y-1">
                {setScoreSummary.map((s) => (
                  <div
                    key={s.index}
                    className={`flex items-center justify-between rounded-md border px-2 py-1 ${
                      s.index - 1 === match.currentSetIndex
                        ? "border-emerald-500/70 bg-emerald-500/10"
                        : "border-zinc-800 bg-zinc-950"
                    }`}
                  >
                    <span className="text-[11px] font-medium text-zinc-300">
                      Set {s.index}
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-zinc-100">
                      {s.A} - {s.B}
                    </span>
                  </div>
                ))}
              </div>
              {match.winner && (
                <div className="mt-2 rounded-md border border-amber-400/70 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-100">
                  Match winner:{" "}
                  {match.winner === "A" ? teams.A.name : teams.B.name}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

