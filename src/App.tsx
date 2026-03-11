import React, { useState, useEffect } from 'react';
import { Player, Room, RoomSettings } from './types';
import * as api from './services/api';
import { AmongUsPanel } from './components/AmongUsPanel';
import { AmongUsButton } from './components/AmongUsButton';
import { AmongUsInput } from './components/AmongUsInput';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Clock, AlertTriangle } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<Player | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Polling for room updates
  useEffect(() => {
    if (!room) return;
    const interval = setInterval(async () => {
      const updatedRoom = await api.pollRoom();
      if (updatedRoom) setRoom(updatedRoom);
    }, 2000);
    return () => clearInterval(interval);
  }, [room?.id]);

  const handleLogin = async (username: string) => {
    setLoading(true);
    try {
      const u = await api.login(username);
      setUser(u);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  const handleHost = async (settings: RoomSettings) => {
    setLoading(true);
    try {
      const r = await api.hostRoom(settings);
      setRoom(r);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  const handleJoin = async (code: string) => {
    setLoading(true);
    try {
      const r = await api.joinRoom(code);
      setRoom(r);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center p-4">
      <div className="stars"></div>
      
      <AnimatePresence mode="wait">
        {!user ? (
          <LoginScreen key="login" onLogin={handleLogin} loading={loading} error={error} />
        ) : !room ? (
          <MainMenuScreen key="main" user={user} onHost={handleHost} onJoin={handleJoin} loading={loading} error={error} />
        ) : (
          <GameScreen key="game" user={user} room={room} setRoom={setRoom} />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Screens ---

interface LoginScreenProps {
  onLogin: (u: string) => void;
  loading: boolean;
  error: string;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, loading, error }) => {
  const [username, setUsername] = useState('');

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="w-full max-w-md">
      <AmongUsPanel className="flex flex-col items-center text-center">
        <h1 className="text-4xl md:text-6xl font-black mb-8 text-red-600 drop-shadow-md tracking-tighter" style={{ WebkitTextStroke: '2px white' }}>IMPOSTORS</h1>
        
        <div className="w-full space-y-4">
          <AmongUsInput 
            placeholder="Enter Username" 
            value={username} 
            onChange={e => setUsername(e.target.value)}
            maxLength={12}
            onKeyDown={e => e.key === 'Enter' && username && onLogin(username)}
          />
          {error && <p className="text-red-500 font-bold">{error}</p>}
          <AmongUsButton 
            className="w-full" 
            variant="success" 
            onClick={() => onLogin(username)} 
            disabled={!username || loading}
          >
            {loading ? 'Connecting...' : 'PLAY'}
          </AmongUsButton>
        </div>
      </AmongUsPanel>
    </motion.div>
  );
}

interface MainMenuScreenProps {
  user: Player;
  onHost: (s: RoomSettings) => void;
  onJoin: (c: string) => void;
  loading: boolean;
  error: string;
}

const MainMenuScreen: React.FC<MainMenuScreenProps> = ({ user, onHost, onJoin, loading, error }) => {
  const [mode, setMode] = useState<'menu' | 'host' | 'join'>('menu');
  const [joinCode, setJoinCode] = useState('');
  
  // Host settings
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [impostorCount, setImpostorCount] = useState(2);
  const [writeTime, setWriteTime] = useState(45);
  const [forceHostImpostor, setForceHostImpostor] = useState(false);
  const [forceHostPicker, setForceHostPicker] = useState(false);

  if (mode === 'host') {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
        <AmongUsPanel>
          <h2 className="text-3xl font-black mb-6 text-center">HOST SETTINGS</h2>
          
          <div className="space-y-6">
            <div>
              <label className="block font-bold mb-2 flex items-center"><Users className="mr-2" size={20}/> Max Players: {maxPlayers}</label>
              <input type="range" min="4" max="15" value={maxPlayers} onChange={e => setMaxPlayers(parseInt(e.target.value))} className="w-full" />
            </div>
            
            <div>
              <label className="block font-bold mb-2 flex items-center"><AlertTriangle size={20} className="mr-2 text-red-500"/> Impostors: {impostorCount}</label>
              <input type="range" min="1" max="3" value={impostorCount} onChange={e => setImpostorCount(parseInt(e.target.value))} className="w-full" />
            </div>
            
            <div>
              <label className="block font-bold mb-2 flex items-center"><Clock className="mr-2" size={20}/> Write Time (s): {writeTime}</label>
              <input type="range" min="10" max="100" step="5" value={writeTime} onChange={e => setWriteTime(parseInt(e.target.value))} className="w-full" />
            </div>

            <div className="space-y-3 pt-2">
              <label className="flex items-center cursor-pointer group">
                <div className={`w-6 h-6 border-2 border-white rounded mr-3 flex items-center justify-center transition-colors ${forceHostImpostor ? 'bg-red-600' : 'bg-transparent'}`}>
                  {forceHostImpostor && <div className="w-3 h-3 bg-white rounded-sm"></div>}
                </div>
                <input type="checkbox" className="hidden" checked={forceHostImpostor} onChange={e => {
                  setForceHostImpostor(e.target.checked);
                  if (e.target.checked) setForceHostPicker(false);
                }} />
                <span className="font-bold group-hover:text-red-400 transition-colors">I am always Impostor</span>
              </label>

              <label className="flex items-center cursor-pointer group">
                <div className={`w-6 h-6 border-2 border-white rounded mr-3 flex items-center justify-center transition-colors ${forceHostPicker ? 'bg-yellow-600' : 'bg-transparent'}`}>
                  {forceHostPicker && <div className="w-3 h-3 bg-white rounded-sm"></div>}
                </div>
                <input type="checkbox" className="hidden" checked={forceHostPicker} onChange={e => {
                  setForceHostPicker(e.target.checked);
                  if (e.target.checked) setForceHostImpostor(false);
                }} />
                <span className="font-bold group-hover:text-yellow-400 transition-colors">I am always Word Picker</span>
              </label>
            </div>
            
            <div className="flex gap-4 pt-4">
              <AmongUsButton variant="secondary" className="flex-1" onClick={() => setMode('menu')}>BACK</AmongUsButton>
              <AmongUsButton variant="success" className="flex-1" onClick={() => onHost({ maxPlayers, impostorCount, writeTime, forceHostImpostor, forceHostPicker })} disabled={loading}>
                {loading ? '...' : 'CREATE'}
              </AmongUsButton>
            </div>
          </div>
        </AmongUsPanel>
      </motion.div>
    );
  }

  if (mode === 'join') {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
        <AmongUsPanel>
          <h2 className="text-3xl font-black mb-6 text-center">JOIN ROOM</h2>
          <div className="space-y-4">
            <AmongUsInput 
              placeholder="Enter Room Code" 
              value={joinCode} 
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="text-center text-2xl tracking-widest uppercase"
            />
            {error && <p className="text-red-500 font-bold text-center">{error}</p>}
            <div className="flex gap-4 pt-4">
              <AmongUsButton variant="secondary" className="flex-1" onClick={() => setMode('menu')}>BACK</AmongUsButton>
              <AmongUsButton variant="primary" className="flex-1" onClick={() => onJoin(joinCode)} disabled={!joinCode || loading}>
                {loading ? '...' : 'JOIN'}
              </AmongUsButton>
            </div>
          </div>
        </AmongUsPanel>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
      <AmongUsPanel className="flex flex-col items-center">
        <div className="mb-8 text-center">
          <p className="text-gray-600 font-bold mb-2">Welcome,</p>
          <div className="inline-block px-4 py-2 rounded-full border-4 border-gray-400 font-black text-xl" style={{ backgroundColor: user.color, color: '#fff', textShadow: '1px 1px 0 #000' }}>
            {user.name}
          </div>
        </div>
        
        <div className="w-full space-y-4">
          <AmongUsButton className="w-full" variant="primary" onClick={() => setMode('host')}>HOST ROOM</AmongUsButton>
          <AmongUsButton className="w-full" variant="success" onClick={() => setMode('join')}>JOIN ROOM</AmongUsButton>
        </div>
      </AmongUsPanel>
    </motion.div>
  );
}

interface GameScreenProps {
  user: Player;
  room: Room;
  setRoom: (r: Room) => void;
}

const GameScreen: React.FC<GameScreenProps> = ({ user, room, setRoom }) => {
  // --- Hooks ---
  const [word, setWord] = useState('');
  const [association, setAssociation] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [votedId, setVotedId] = useState<string | null>(null);
  const [chatText, setChatText] = useState('');
  const chatEndRef = React.useRef<HTMLDivElement>(null);
  const [localTimeLeft, setLocalTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!room.phaseEndsAt) {
      setLocalTimeLeft(null);
      return;
    }

    const update = () => {
      const remaining = Math.max(0, Math.floor((room.phaseEndsAt! - Date.now()) / 1000));
      setLocalTimeLeft(remaining);
    };

    update();
    const interval = setInterval(update, 500);
    return () => clearInterval(interval);
  }, [room.phaseEndsAt]);

  // Reset local state when round changes
  useEffect(() => {
    if (room.state === 'THEME_SELECTION' || room.state === 'LOBBY') {
      setWord('');
      setAssociation('');
      setSubmitted(false);
      setVotedId(null);
    }
    if (room.state === 'ASSOCIATION') {
      setSubmitted(false);
    }
  }, [room.state, room.id]);

  useEffect(() => {
    if (room.state === 'VOTING') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [room.chat, room.state]);

  const handleFillBots = async () => {
    const r = await api.fillWithBots();
    setRoom(r);
  };

  const handleStart = async () => {
    const r = await api.startGame();
    setRoom(r);
  };

  if (room.state === 'LOBBY') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-2xl">
        <AmongUsPanel>
          <div className="flex justify-between items-center mb-6 border-b-4 border-gray-400 pb-4">
            <h2 className="text-3xl font-black">LOBBY</h2>
            <div className="bg-gray-800 text-white px-4 py-2 rounded-lg border-2 border-gray-600">
              <span className="text-gray-400 text-sm block">ROOM CODE</span>
              <span className="text-2xl font-mono font-bold tracking-widest">{room.code}</span>
            </div>
          </div>
          
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-xl">Players ({room.players.length}/{room.settings.maxPlayers})</h3>
            </div>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
              {room.players.map(p => (
                <div key={p.id} className="flex flex-col items-center">
                  <div className="w-12 h-16 rounded-t-full rounded-b-md border-4 border-gray-800 relative shadow-md" style={{ backgroundColor: p.color }}>
                    <div className="absolute top-2 left-1 right-1 h-6 bg-blue-200 rounded-full border-2 border-gray-800 opacity-80"></div>
                  </div>
                  <span className="mt-2 font-bold text-sm truncate w-full text-center">{p.name}</span>
                </div>
              ))}
              {Array.from({ length: room.settings.maxPlayers - room.players.length }).map((_, i) => (
                <div key={i} className="flex flex-col items-center opacity-30">
                  <div className="w-12 h-16 rounded-t-full rounded-b-md border-4 border-gray-800 border-dashed bg-gray-300"></div>
                  <span className="mt-2 font-bold text-sm">Empty</span>
                </div>
              ))}
            </div>
          </div>
          
          {user.isHost ? (
            <div className="flex gap-4">
              <AmongUsButton variant="secondary" className="flex-1" onClick={handleFillBots} disabled={room.players.length >= room.settings.maxPlayers}>
                FILL BOTS
              </AmongUsButton>
              <AmongUsButton variant="success" className="flex-1" onClick={handleStart} disabled={room.players.length < 4}>
                START GAME
              </AmongUsButton>
            </div>
          ) : (
            <div className="text-center font-bold text-xl text-gray-600 animate-pulse">
              Waiting for host to start...
            </div>
          )}
        </AmongUsPanel>
      </motion.div>
    );
  }

  if (room.state === 'THEME_SELECTION') {
    const isPicker = room.themePickerId === user.id;
    const picker = room.players.find(p => p.id === room.themePickerId);
    
    return (
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-xl">
        <AmongUsPanel className="text-center">
          <h2 className="text-3xl font-black mb-8">THEME SELECTION</h2>
          
          {isPicker ? (
            <div>
              <p className="text-xl font-bold mb-6">You are the Theme Picker!</p>
              <p className="mb-4">Choose a theme for this round:</p>
              <div className="grid grid-cols-2 gap-4">
                {['Animals', 'Technology', 'Food', 'Movies', 'Sports', 'Geography'].map(t => (
                  <AmongUsButton key={t} variant="primary" onClick={async () => {
                    const r = await api.selectTheme(t);
                    setRoom(r);
                  }}>
                    {t}
                  </AmongUsButton>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="inline-block p-4 rounded-xl border-4 border-gray-400 mb-6" style={{ backgroundColor: picker?.color }}>
                <span className="text-white font-black text-2xl drop-shadow-md">{picker?.name}</span>
              </div>
              <p className="text-xl font-bold animate-pulse">is choosing a theme...</p>
            </div>
          )}
        </AmongUsPanel>
      </motion.div>
    );
  }

  if (room.state === 'WORD_SELECTION') {
    const isPicker = room.themePickerId === user.id;
    
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-xl">
        <AmongUsPanel className="text-center">
          <h2 className="text-3xl font-black mb-4">WORD SELECTION</h2>
          <div className="bg-blue-100 border-4 border-blue-400 rounded-xl p-4 mb-8 inline-block">
            <span className="text-blue-800 font-bold">THEME:</span>
            <span className="text-2xl font-black ml-2 text-blue-900">{room.theme}</span>
          </div>
          
          {isPicker ? (
            <div>
              <p className="font-bold mb-4">Type a word that fits the theme:</p>
              <AmongUsInput 
                value={word} 
                onChange={e => setWord(e.target.value)} 
                placeholder="Secret Word"
                className="mb-4 text-center text-2xl"
              />
              <AmongUsButton variant="success" className="w-full" onClick={async () => {
                if (word.length < 2) return;
                const r = await api.selectWord(word);
                setRoom(r);
              }} disabled={word.length < 2}>
                CONFIRM WORD
              </AmongUsButton>
            </div>
          ) : (
            <p className="text-xl font-bold animate-pulse">Waiting for the secret word...</p>
          )}
        </AmongUsPanel>
      </motion.div>
    );
  }

  if (room.state === 'ASSOCIATION') {
    const isImpostor = room.impostorIds.includes(user.id);
    const isPicker = room.themePickerId === user.id;
    
    // Calculate hint for impostors
    const word = room.word || '';
    const hint = isImpostor ? `${word.charAt(0)}...${word.charAt(word.length - 1)} (${word.length} letters)` : word;

    if (isPicker) {
      return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-xl">
          <AmongUsPanel className="text-center">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-3xl font-black">WAITING FOR PLAYERS</h2>
              {localTimeLeft !== null && (
                <div className={`text-2xl font-black px-4 py-1 rounded-lg border-4 ${localTimeLeft < 10 ? 'bg-red-100 border-red-500 text-red-600 animate-pulse' : 'bg-gray-100 border-gray-400 text-gray-700'}`}>
                  {localTimeLeft}s
                </div>
              )}
            </div>
            <p className="text-xl mb-4">Players are writing associations for your word:</p>
            <div className="text-4xl font-black text-green-600 drop-shadow-sm mb-8">{word}</div>
            <p className="animate-pulse font-bold text-gray-600">Waiting...</p>
          </AmongUsPanel>
        </motion.div>
      );
    }

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-xl">
        <AmongUsPanel className="text-center">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-3xl font-black">ASSOCIATION PHASE</h2>
            {localTimeLeft !== null && (
              <div className={`text-2xl font-black px-4 py-1 rounded-lg border-4 ${localTimeLeft < 10 ? 'bg-red-100 border-red-500 text-red-600 animate-pulse' : 'bg-gray-100 border-gray-400 text-gray-700'}`}>
                {localTimeLeft}s
              </div>
            )}
          </div>
          
          {isImpostor && (
            <div className="bg-red-100 border-4 border-red-500 rounded-xl p-2 mb-4 animate-pulse">
              <span className="text-red-700 font-black">YOU ARE AN IMPOSTOR</span>
            </div>
          )}
          
          <div className="bg-gray-200 border-4 border-gray-400 rounded-xl p-6 mb-8">
            <div className="mb-2 text-sm font-bold text-gray-500 uppercase">Theme</div>
            <div className="text-2xl font-black mb-4 text-gray-900">{room.theme}</div>
            
            <div className="mb-2 text-sm font-bold text-gray-500 uppercase">The Word</div>
            <div className={`text-4xl font-black ${isImpostor ? 'text-red-600' : 'text-green-600'} tracking-widest`}>
              {hint}
            </div>
          </div>
          
          {!submitted ? (
            <div>
              <p className="font-bold mb-4">Write a word associated with the secret word:</p>
              <AmongUsInput 
                value={association} 
                onChange={e => setAssociation(e.target.value)} 
                placeholder="Your association..."
                className="mb-4 text-center text-xl"
              />
              <AmongUsButton variant="primary" className="w-full" onClick={async () => {
                if (!association) return;
                setSubmitted(true);
                const r = await api.submitAssociation(association);
                setRoom(r);
              }} disabled={!association}>
                SUBMIT
              </AmongUsButton>
            </div>
          ) : (
            <p className="text-xl font-bold text-green-600">Submitted! Waiting for others...</p>
          )}
        </AmongUsPanel>
      </motion.div>
    );
  }

  if (room.state === 'VOTING') {
    const alivePlayers = room.players.filter(p => p.isAlive);
    const hasVoted = !!room.votes[user.id];
    const isDead = !room.players.find(p => p.id === user.id)?.isAlive;
    const isImpostor = room.impostorIds.includes(user.id);
    const displayWord = isImpostor && room.word 
      ? `${room.word.charAt(0)}...${room.word.charAt(room.word.length - 1)} (${room.word.length} letters)` 
      : room.word;

    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Side: Voting Tablet */}
          <div className="lg:col-span-2 bg-gray-800 border-8 border-gray-600 rounded-3xl p-4 shadow-2xl flex flex-col h-[80vh]">
            {/* Tablet Header */}
            <div className="bg-blue-900 border-4 border-blue-700 rounded-xl p-4 mb-4 text-center shadow-inner relative overflow-hidden shrink-0">
              <div className="absolute inset-0 bg-blue-400 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, #000 2px, #000 4px)' }}></div>
              <div className="flex justify-between items-center relative z-10">
                <div className="w-16"></div> {/* Spacer */}
                <h2 className="text-2xl md:text-3xl font-black text-white tracking-widest">WHO IS THE IMPOSTOR?</h2>
                {localTimeLeft !== null ? (
                  <div className={`text-xl font-black px-3 py-1 rounded-lg border-4 ${localTimeLeft < 10 ? 'bg-red-100 border-red-500 text-red-600 animate-pulse' : 'bg-gray-100 border-gray-400 text-gray-700'}`}>
                    {localTimeLeft}s
                  </div>
                ) : <div className="w-16"></div>}
              </div>
              <p className="text-blue-200 font-bold relative z-10 mt-1">Theme: {room.theme} | Word: {displayWord}</p>
            </div>
            
            {/* Players Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 overflow-y-auto flex-1 pr-2 custom-scrollbar">
              {alivePlayers.map(p => {
                const isMe = p.id === user.id;
                const isPicker = p.id === room.themePickerId;
                const association = room.associations[p.id];
                const isSelected = votedId === p.id;
                
                return (
                  <div 
                    key={p.id} 
                    onClick={() => !hasVoted && !isMe && !isPicker && !isDead && setVotedId(p.id)}
                    className={`
                      flex items-center p-3 rounded-xl border-4 transition-all
                      ${isMe || isPicker || isDead ? 'opacity-70 cursor-not-allowed bg-gray-700 border-gray-600' : 'cursor-pointer hover:bg-gray-700'}
                      ${isSelected ? 'bg-red-900 border-red-500' : 'bg-gray-800 border-gray-600'}
                    `}
                  >
                    <div className="w-10 h-14 rounded-t-full rounded-b-md border-2 border-black relative mr-4 shrink-0" style={{ backgroundColor: p.color }}>
                      <div className="absolute top-2 left-1 right-1 h-4 bg-blue-200 rounded-full border border-black opacity-80"></div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white truncate flex items-center">
                        {p.name} {isMe && <span className="ml-2 text-xs bg-blue-600 px-2 py-1 rounded">YOU</span>}
                        {isPicker && <span className="ml-2 text-xs bg-yellow-600 px-2 py-1 rounded">PICKER</span>}
                      </div>
                      {isPicker ? (
                        <div className="text-yellow-400 font-mono text-sm mt-1 truncate">Picked the word</div>
                      ) : (
                        <div className="text-green-400 font-mono text-lg mt-1 truncate bg-black/30 px-2 py-1 rounded">"{association}"</div>
                      )}
                    </div>
                    
                    {/* Vote indicator */}
                    <div className="flex flex-wrap w-8 justify-end">
                      {Object.values(room.votes).filter(v => v === p.id).map((_, i) => (
                        <div key={i} className="w-3 h-3 bg-red-500 rounded-full border border-black ml-1 mb-1"></div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Actions */}
            <div className="flex justify-between items-center bg-gray-700 p-4 rounded-xl border-4 border-gray-600 shrink-0">
              <div className="text-gray-300 font-bold">
                {isDead ? 'You are dead.' : hasVoted ? 'Waiting for others...' : 'Select a player to vote'}
              </div>
              <AmongUsButton 
                variant="danger" 
                disabled={!votedId || hasVoted || isDead}
                onClick={async () => {
                  if (votedId && !isDead) {
                    const r = await api.submitVote(votedId);
                    setRoom(r);
                  }
                }}
              >
                {isDead ? 'DEAD' : hasVoted ? 'VOTE CAST' : 'CAST VOTE'}
              </AmongUsButton>
            </div>
          </div>

          {/* Right Side: Chat */}
          <div className="bg-gray-800 border-8 border-gray-600 rounded-3xl p-4 shadow-2xl flex flex-col h-[80vh]">
            <div className="bg-gray-900 rounded-xl p-3 mb-4 text-center border-2 border-gray-700 shrink-0">
              <h3 className="text-xl font-black text-white tracking-widest">DISCUSSION</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto mb-4 space-y-3 pr-2 custom-scrollbar">
              {room.chat?.map(msg => (
                <div key={msg.id} className="bg-gray-700 rounded-lg p-3 border-l-4" style={{ borderLeftColor: msg.senderColor }}>
                  <div className="font-bold text-sm mb-1" style={{ color: msg.senderColor }}>{msg.senderName}</div>
                  <div className="text-white text-sm break-words">{msg.text}</div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            
            <div className="flex gap-2 shrink-0">
              <AmongUsInput 
                value={chatText}
                onChange={e => setChatText(e.target.value)}
                placeholder="Discuss..."
                className="text-sm py-2"
                onKeyDown={e => {
                  if (e.key === 'Enter' && chatText.trim()) {
                    api.sendChatMessage(chatText.trim());
                    setChatText('');
                  }
                }}
              />
              <AmongUsButton 
                variant="primary" 
                className="px-4 py-2 text-sm"
                onClick={() => {
                  if (chatText.trim()) {
                    api.sendChatMessage(chatText.trim());
                    setChatText('');
                  }
                }}
              >
                SEND
              </AmongUsButton>
            </div>
          </div>

        </div>
      </motion.div>
    );
  }

  if (room.state === 'RESULT' || room.state === 'GAME_OVER') {
    const ejected = room.players.find(p => p.id === room.ejectedPlayerId);
    const wasImpostor = ejected ? room.impostorIds.includes(ejected.id) : false;
    
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-2xl text-center">
        <div className="mb-12">
          {room.ejectedPlayerId === null ? (
            <motion.h2 initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-4xl md:text-6xl font-black text-gray-400 tracking-widest">
              NO ONE WAS EJECTED (TIE)
            </motion.h2>
          ) : (
            <motion.div initial={{ x: -100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ type: 'spring' }}>
              <div className="inline-block w-24 h-32 rounded-t-full rounded-b-md border-4 border-black relative mb-6" style={{ backgroundColor: ejected?.color }}>
                <div className="absolute top-4 left-2 right-2 h-8 bg-blue-200 rounded-full border-2 border-black opacity-80"></div>
              </div>
              <h2 className="text-3xl md:text-5xl font-black text-white tracking-widest mb-4">
                {ejected?.name} was ejected.
              </h2>
              <p className={`text-2xl font-bold ${wasImpostor ? 'text-green-400' : 'text-red-400'}`}>
                {wasImpostor ? 'They were an Impostor.' : 'They were NOT an Impostor.'}
              </p>
            </motion.div>
          )}
        </div>
        
        {room.state === 'GAME_OVER' ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}>
            <h1 className={`text-6xl font-black mb-8 ${room.winner === 'CREWMATES' ? 'text-blue-500' : 'text-red-600'}`} style={{ WebkitTextStroke: '2px white' }}>
              {room.winner === 'CREWMATES' ? 'CREWMATES WIN' : 'IMPOSTORS WIN'}
            </h1>
            
            <div className="bg-gray-800 border-4 border-gray-600 rounded-xl p-6 mb-8 text-left">
              <h3 className="text-xl font-bold mb-4 text-white border-b border-gray-600 pb-2">The Impostors were:</h3>
              <div className="flex gap-4 flex-wrap">
                {room.players.filter(p => room.impostorIds.includes(p.id)).map(imp => (
                  <div key={imp.id} className="flex items-center bg-gray-700 px-4 py-2 rounded-lg border border-gray-500">
                    <div className="w-6 h-8 rounded-t-full rounded-b-sm border border-black mr-3" style={{ backgroundColor: imp.color }}></div>
                    <span className="font-bold text-red-400">{imp.name}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {user.isHost && (
              <AmongUsButton variant="primary" onClick={async () => {
                const r = await api.nextRound();
                setRoom(r);
              }}>
                PLAY AGAIN
              </AmongUsButton>
            )}
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }}>
            {user.isHost ? (
              <AmongUsButton variant="primary" onClick={async () => {
                const r = await api.nextRound();
                setRoom(r);
              }}>
                NEXT ROUND
              </AmongUsButton>
            ) : (
              <p className="text-xl font-bold text-gray-400 animate-pulse">Waiting for host to continue...</p>
            )}
          </motion.div>
        )}
      </motion.div>
    );
  }

  return null;
}