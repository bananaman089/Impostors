/**
 * PHP + MySQL backend API (no Supabase).
 * All calls go to http://localhost/api/
 * This module keeps the same function signatures the React UI already uses.
 * It also handles guest persistence via localStorage (playerId + roomCode).
 */

import type { Player, Room, RoomSettings } from '../types';

// Use same origin as the loaded app (works with localhost, LAN IP, ngrok, etc.)
const API_BASE =
  typeof window !== 'undefined'
    ? `${window.location.origin}/api`
    : 'http://localhost/api';

const STORAGE_KEYS = {
  playerId: 'impostor_party_playerId',
  roomCode: 'impostor_party_roomCode',
};

let currentUser: Player | null = null;
let currentPlayerId: string | null = null;
let currentRoomCode: string | null = null;

async function request<T>(endpoint: string, body: object): Promise<T> {
  const res = await fetch(`${API_BASE}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed: ${res.status}`);
  }
  return data as T;
}

function saveSession(playerId: string, roomCode: string) {
  currentPlayerId = playerId;
  currentRoomCode = roomCode;
  try {
    localStorage.setItem(STORAGE_KEYS.playerId, playerId);
    localStorage.setItem(STORAGE_KEYS.roomCode, roomCode);
  } catch {
    // ignore storage errors
  }
}

function loadSessionFromStorage() {
  try {
    const pid = localStorage.getItem(STORAGE_KEYS.playerId);
    const code = localStorage.getItem(STORAGE_KEYS.roomCode);
    if (pid && code) {
      currentPlayerId = pid;
      currentRoomCode = code;
    }
  } catch {
    // ignore
  }
}

async function fetchRoomState(): Promise<Room> {
  if (!currentPlayerId || !currentRoomCode) {
    throw new Error('No active session');
  }
  return request<Room>('get_state.php', {
    playerId: currentPlayerId,
    roomCode: currentRoomCode,
  });
}

/** Clear stored session (e.g. when game is over so refresh returns to main menu). */
export function clearSession(): void {
  currentPlayerId = null;
  currentRoomCode = null;
  try {
    localStorage.removeItem(STORAGE_KEYS.playerId);
    localStorage.removeItem(STORAGE_KEYS.roomCode);
  } catch {
    // ignore
  }
}

/** Try to restore session from localStorage on app start. */
export async function restoreSession(): Promise<{ room: Room; user: Player } | null> {
  loadSessionFromStorage();
  if (!currentPlayerId || !currentRoomCode) return null;
  try {
    const room = await fetchRoomState();
    const player = room.players.find(p => p.id === currentPlayerId);
    if (!player) return null;
    currentUser = player;
    return { room, user: player };
  } catch {
    return null;
  }
}

/** Login: purely client-side. Backend assigns true playerId on host/join. */
export async function login(username: string): Promise<Player> {
  // Avoid gray/dark colors that blend with chat background
  const COLORS = [
    '#c51111', '#132ed1', '#117f2d', '#ed54ba',
    '#ef7d0d', '#f5f557', '#9c27b0', '#00bcd4',
    '#6b2fbb', '#e91e63', '#38fedc', '#50ef39',
  ];
  const user: Player = {
    id: '',
        name: username,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        isBot: false,
        isHost: false,
        isAlive: true,
      };
  currentUser = user;
  return user;
}

/** Host room: create_or_join.php with settings, then fetch full Room and current player. */
export async function hostRoom(settings: RoomSettings): Promise<{ room: Room; player: Player }> {
  if (!currentUser) {
    throw new Error('Not logged in');
  }
  const { playerId, roomCode } = await request<{ playerId: string; roomCode: string }>(
    'create_or_join.php',
    {
      name: currentUser.name,
      settings,
    }
  );
  saveSession(playerId, roomCode);
  const room = await fetchRoomState();
  const player = room.players.find(p => p.id === playerId);
  if (player) {
    currentUser = player;
  }
  return { room, player: player || currentUser! };
}

/** Join room: create_or_join.php with code, then fetch full Room and current player. */
export async function joinRoom(code: string): Promise<{ room: Room; player: Player }> {
  if (!currentUser) {
    throw new Error('Not logged in');
  }
  const { playerId, roomCode } = await request<{ playerId: string; roomCode: string }>(
    'create_or_join.php',
    {
      name: currentUser.name,
      code: code.toUpperCase(),
    }
  );
  saveSession(playerId, roomCode);
  const room = await fetchRoomState();
  const player = room.players.find(p => p.id === playerId);
  if (player) {
    currentUser = player;
  }
  return { room, player: player || currentUser! };
}

/** Host-only: fill remaining slots with bots. */
export async function fillWithBots(): Promise<Room> {
  if (!currentPlayerId || !currentRoomCode) {
    throw new Error('No active room');
  }
  await request('submit_action.php', {
    playerId: currentPlayerId,
    roomCode: currentRoomCode,
    action: 'fill_bots',
  });
  return fetchRoomState();
}

/** Host-only: start game -> THEME_SELECTION + impostor(s) assignment. */
export async function startGame(): Promise<Room> {
  if (!currentPlayerId || !currentRoomCode) {
    throw new Error('No active room');
  }
  await request('start_game.php', {
    playerId: currentPlayerId,
    roomCode: currentRoomCode,
  });
  return fetchRoomState();
}

/** Theme picker selects theme. */
export async function selectTheme(theme: string): Promise<Room> {
  if (!currentPlayerId || !currentRoomCode) {
    throw new Error('No active room');
  }
  await request('submit_action.php', {
    playerId: currentPlayerId,
    roomCode: currentRoomCode,
    action: 'select_theme',
    theme,
  });
  return fetchRoomState();
}

/** Theme picker selects secret word (string typed by picker). */
export async function selectWord(word: string): Promise<Room> {
  if (!currentPlayerId || !currentRoomCode) {
    throw new Error('No active room');
  }
  await request('submit_action.php', {
    playerId: currentPlayerId,
    roomCode: currentRoomCode,
    action: 'select_word',
    word,
  });
  return fetchRoomState();
}

/** Association phase: player submits association word. */
export async function submitAssociation(association: string): Promise<Room> {
  if (!currentPlayerId || !currentRoomCode) {
    throw new Error('No active room');
  }
  await request('submit_action.php', {
    playerId: currentPlayerId,
    roomCode: currentRoomCode,
    action: 'association',
    word: association,
  });
  return fetchRoomState();
}

/** Voting phase: player votes for a playerId. */
export async function submitVote(votedPlayerId: string): Promise<Room> {
  if (!currentPlayerId || !currentRoomCode) {
    throw new Error('No active room');
  }
  await request('submit_action.php', {
    playerId: currentPlayerId,
    roomCode: currentRoomCode,
    action: 'vote',
    votedPlayerId,
  });
  return fetchRoomState();
}

/** Chat message during voting / discussion. */
export async function sendChatMessage(text: string): Promise<Room> {
  if (!currentPlayerId || !currentRoomCode) {
    throw new Error('No active room');
  }
  await request('submit_action.php', {
    playerId: currentPlayerId,
    roomCode: currentRoomCode,
    action: 'chat',
                text,
  });
  return fetchRoomState();
}

/** Host-only: go to next round or back to LOBBY after GAME_OVER. */
export async function nextRound(): Promise<Room> {
  if (!currentPlayerId || !currentRoomCode) {
    throw new Error('No active room');
  }
  await request('submit_action.php', {
    playerId: currentPlayerId,
    roomCode: currentRoomCode,
    action: 'next_round',
  });
  return fetchRoomState();
}

/** Polling: returns latest Room or null if session invalid. */
export async function pollRoom(): Promise<Room | null> {
  if (!currentPlayerId || !currentRoomCode) {
    loadSessionFromStorage();
    if (!currentPlayerId || !currentRoomCode) return null;
  }
  try {
    return await fetchRoomState();
  } catch {
    return null;
  }
}
