export type Player = {
  id: string;
  name: string;
  color: string;
  isBot: boolean;
  isHost: boolean;
  isAlive: boolean;
};

export type RoomSettings = {
  maxPlayers: number;
  impostorCount: number;
  writeTime: number;
  forceHostImpostor?: boolean;
  forceHostPicker?: boolean;
};

export type GameState = 'LOBBY' | 'THEME_SELECTION' | 'WORD_SELECTION' | 'ASSOCIATION' | 'VOTING' | 'RESULT' | 'GAME_OVER';

export type ChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  senderColor: string;
  text: string;
  timestamp: number;
};

export type Room = {
  id: string;
  code: string;
  hostId: string;
  players: Player[];
  settings: RoomSettings;
  state: GameState;
  themePickerId?: string;
  theme?: string;
  word?: string;
  impostorIds: string[];
  associations: Record<string, string>; // playerId -> associated word
  votes: Record<string, string>; // voterId -> votedPlayerId
  chat: ChatMessage[];
  ejectedPlayerId?: string | null;
  winner?: 'CREWMATES' | 'IMPOSTORS';
  phaseEndsAt?: number;
};
