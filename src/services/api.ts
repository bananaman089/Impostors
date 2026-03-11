import { Player, Room, RoomSettings } from '../types';
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// This is a mock implementation of the backend.
// To connect to your PHP backend, replace these functions with fetch() calls.
// Example:
// export const joinRoom = async (code: string, username: string) => {
//   const res = await fetch('http://your-php-server.com/api/join.php', {
//     method: 'POST', body: JSON.stringify({ code, username })
//   });
//   return res.json();
// }

let mockRoom: Room | null = null;
let currentUser: Player | null = null;

const COLORS = ['#c51111', '#132ed1', '#117f2d', '#ed54ba', '#ef7d0d', '#f5f557', '#3f474e', '#d6e0f0', '#6b2fbb', '#71491e', '#38fedc', '#50ef39'];

export const THEME_DATA: Record<string, Record<string, string[]>> = {
  'Animals': {
    'Lion': ['roar', 'mane', 'cat', 'king', 'safari', 'africa', 'wild'],
    'Elephant': ['trunk', 'big', 'gray', 'tusks', 'africa', 'huge', 'ears'],
    'Tiger': ['stripes', 'cat', 'orange', 'jungle', 'fierce', 'predator'],
    'Bear': ['honey', 'brown', 'grizzly', 'hibernate', 'forest', 'claws'],
    'Monkey': ['banana', 'tree', 'swing', 'tail', 'ape', 'jungle'],
    'Giraffe': ['neck', 'tall', 'yellow', 'spots', 'leaves', 'africa']
  },
  'Technology': {
    'Computer': ['keyboard', 'screen', 'mouse', 'code', 'hacker', 'digital'],
    'Phone': ['call', 'screen', 'mobile', 'app', 'smart', 'text'],
    'Robot': ['metal', 'ai', 'machine', 'future', 'cyborg', 'auto'],
    'Internet': ['web', 'wifi', 'online', 'browser', 'network', 'cloud'],
    'Software': ['code', 'app', 'program', 'developer', 'bug', 'update']
  },
  'Food': {
    'Pizza': ['cheese', 'slice', 'italy', 'dough', 'pepperoni', 'crust'],
    'Burger': ['meat', 'bun', 'fast', 'fries', 'cheese', 'beef'],
    'Pasta': ['italy', 'noodles', 'sauce', 'spaghetti', 'carb', 'bowl'],
    'Salad': ['green', 'healthy', 'lettuce', 'tomato', 'bowl', 'diet'],
    'Sushi': ['fish', 'rice', 'japan', 'roll', 'raw', 'seaweed'],
    'Taco': ['mexico', 'shell', 'meat', 'spicy', 'salsa', 'wrap']
  },
  'Movies': {
    'Action': ['explosions', 'fight', 'fast', 'gun', 'hero', 'stunt'],
    'Comedy': ['laugh', 'funny', 'joke', 'humor', 'smile', 'hilarious'],
    'Drama': ['sad', 'cry', 'serious', 'story', 'emotion', 'acting'],
    'Horror': ['scary', 'fear', 'blood', 'ghost', 'monster', 'dark'],
    'Sci-Fi': ['space', 'future', 'alien', 'laser', 'stars', 'ship']
  },
  'Sports': {
    'Football': ['touchdown', 'ball', 'field', 'tackle', 'helmet', 'goal'],
    'Basketball': ['hoop', 'dunk', 'court', 'bounce', 'net', 'jump'],
    'Tennis': ['racket', 'net', 'ball', 'court', 'swing', 'serve'],
    'Golf': ['club', 'hole', 'green', 'swing', 'ball', 'putt'],
    'Soccer': ['goal', 'kick', 'field', 'ball', 'net', 'cleats']
  },
  'Geography': {
    'Mountain': ['high', 'peak', 'snow', 'climb', 'rock', 'everest'],
    'River': ['water', 'flow', 'stream', 'bank', 'boat', 'long'],
    'Ocean': ['water', 'sea', 'blue', 'deep', 'waves', 'salt'],
    'Desert': ['sand', 'hot', 'dry', 'camel', 'cactus', 'sun'],
    'Island': ['water', 'beach', 'sand', 'tropical', 'ocean', 'palm']
  }
};

const botTrust: Record<string, Record<string, number>> = {};

const generateId = () => Math.random().toString(36).substring(2, 9);

export const login = async (username: string): Promise<Player> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      currentUser = {
        id: generateId(),
        name: username,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        isBot: false,
        isHost: false,
        isAlive: true,
      };
      resolve(currentUser);
    }, 500);
  });
};

export const hostRoom = async (settings: RoomSettings): Promise<Room> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (!currentUser) throw new Error("Not logged in");
      currentUser.isHost = true;
      mockRoom = {
        id: generateId(),
        code: Math.random().toString(36).substring(2, 8).toUpperCase(),
        hostId: currentUser.id,
        players: [currentUser],
        settings,
        state: 'LOBBY',
        impostorIds: [],
        associations: {},
        votes: {},
        chat: [],
      };
      resolve(mockRoom);
    }, 500);
  });
};

export const joinRoom = async (code: string): Promise<Room> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (!currentUser) throw new Error("Not logged in");
      if (!mockRoom || mockRoom.code !== code) {
        reject(new Error("Room not found"));
        return;
      }
      if (mockRoom.players.length >= mockRoom.settings.maxPlayers) {
        reject(new Error("Room is full"));
        return;
      }
      
      const takenColors = mockRoom.players.map(p => p.color);
      const availableColors = COLORS.filter(c => !takenColors.includes(c));
      currentUser.color = availableColors.length > 0 ? availableColors[0] : COLORS[0];
      
      mockRoom.players.push(currentUser);
      resolve(mockRoom);
    }, 500);
  });
};

export const fillWithBots = async (): Promise<Room> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (!mockRoom) throw new Error("No room");
      const botsNeeded = mockRoom.settings.maxPlayers - mockRoom.players.length;
      for (let i = 0; i < botsNeeded; i++) {
        const takenColors = mockRoom.players.map(p => p.color);
        const availableColors = COLORS.filter(c => !takenColors.includes(c));
        mockRoom.players.push({
          id: `bot-${generateId()}`,
          name: `Bot ${i + 1}`,
          color: availableColors.length > 0 ? availableColors[0] : COLORS[Math.floor(Math.random() * COLORS.length)],
          isBot: true,
          isHost: false,
          isAlive: true,
        });
      }
      resolve({...mockRoom});
    }, 500);
  });
};

export const startGame = async (): Promise<Room> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (!mockRoom) throw new Error("No room");
      mockRoom.state = 'THEME_SELECTION';
      
      if (mockRoom.settings.forceHostPicker) {
        mockRoom.themePickerId = mockRoom.hostId;
      } else {
        // If host is forced to be impostor, exclude them from random picker selection
        const potentialPickers = mockRoom.settings.forceHostImpostor 
          ? mockRoom.players.filter(p => p.id !== mockRoom!.hostId)
          : mockRoom.players;
        
        const pickerIndex = Math.floor(Math.random() * potentialPickers.length);
        mockRoom.themePickerId = potentialPickers[pickerIndex].id;
      }
      
      const availableIds = mockRoom.players.filter(p => p.id !== mockRoom!.themePickerId).map(p => p.id);
      mockRoom.impostorIds = [];
      
      if (mockRoom.settings.forceHostImpostor && mockRoom.hostId !== mockRoom.themePickerId) {
        mockRoom.impostorIds.push(mockRoom.hostId);
        const idx = availableIds.indexOf(mockRoom.hostId);
        if (idx > -1) availableIds.splice(idx, 1);
      }
      
      const remainingImpostors = mockRoom.settings.impostorCount - mockRoom.impostorIds.length;
      for (let i = 0; i < remainingImpostors; i++) {
        if (availableIds.length === 0) break;
        const idx = Math.floor(Math.random() * availableIds.length);
        mockRoom.impostorIds.push(availableIds[idx]);
        availableIds.splice(idx, 1);
      }
      
      resolve({...mockRoom});
    }, 500);
  });
};

export const selectTheme = async (theme: string): Promise<Room> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (!mockRoom) throw new Error("No room");
      mockRoom.theme = theme;
      mockRoom.state = 'WORD_SELECTION';
      resolve({...mockRoom});
    }, 500);
  });
};

export const selectWord = async (word: string): Promise<Room> => {
  if (!mockRoom) throw new Error("No room");
  mockRoom.word = word;
  mockRoom.state = 'ASSOCIATION';
  mockRoom.associations = {};
  mockRoom.phaseEndsAt = Date.now() + (mockRoom.settings.writeTime * 1000);
  
  const bots = mockRoom.players.filter(p => p.isBot && p.id !== mockRoom!.themePickerId);
  
  if (bots.length > 0) {
    try {
      const prompt = `We are playing a game similar to "A Fake Artist Goes to New York". 
      Theme: "${mockRoom.theme}"
      Secret Word: "${word}"
      
      I need you to generate a single-word association for each bot player.
      - Crewmates (know the secret word): Give a word related to "${word}" but not too obvious.
      - Impostors (DO NOT know the secret word): Give a word related to the theme "${mockRoom.theme}" and try to blend in.
      
      Bots to generate for:
      ${bots.map(b => `- ${b.id} (${mockRoom!.impostorIds.includes(b.id) ? 'IMPOSTOR' : 'CREWMATE'})`).join('\n')}
      
      Return ONLY a JSON object where keys are bot IDs and values are their single-word associations.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: bots.reduce((acc, bot) => {
              acc[bot.id] = { type: Type.STRING };
              return acc;
            }, {} as any),
            required: bots.map(b => b.id)
          }
        }
      });
      
      const results = JSON.parse(response.text);
      Object.assign(mockRoom.associations, results);
    } catch (e) {
      console.error("AI Bot Association Error:", e);
      // Fallback to local logic if AI fails
      bots.forEach(bot => {
        const isImpostor = mockRoom!.impostorIds.includes(bot.id);
        const themeData = THEME_DATA[mockRoom!.theme!];
        if (!themeData) {
          mockRoom!.associations[bot.id] = "mystery";
          return;
        }

        if (isImpostor) {
          const allWords = Object.keys(themeData);
          const randomWord = allWords[Math.floor(Math.random() * allWords.length)];
          const assocs = themeData[randomWord];
          if (assocs) {
            mockRoom!.associations[bot.id] = assocs[Math.floor(Math.random() * assocs.length)];
          }
        } else {
          const assocs = themeData[mockRoom!.word!];
          if (assocs) {
            mockRoom!.associations[bot.id] = assocs[Math.floor(Math.random() * assocs.length)];
          } else {
            mockRoom!.associations[bot.id] = "clue";
          }
        }
      });
    }
  }
  
  return {...mockRoom};
};

export const submitAssociation = async (association: string): Promise<Room> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (!mockRoom || !currentUser) throw new Error("No room or user");
      mockRoom.associations[currentUser.id] = association;
      resolve({...mockRoom});
    }, 200);
  });
};

export const submitVote = async (votedPlayerId: string): Promise<Room> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (!mockRoom || !currentUser) throw new Error("No room or user");
      const playerInRoom = mockRoom.players.find(p => p.id === currentUser!.id);
      if (!playerInRoom || !playerInRoom.isAlive) throw new Error("Dead players cannot vote");
      mockRoom.votes[currentUser.id] = votedPlayerId;
      resolve({...mockRoom});
    }, 200);
  });
};

export const sendChatMessage = async (text: string): Promise<Room> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (!mockRoom || !currentUser) throw new Error("No room or user");
      mockRoom.chat.push({
        id: generateId(),
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderColor: currentUser.color,
        text,
        timestamp: Date.now()
      });
      resolve({...mockRoom});
    }, 200);
  });
};

export const nextRound = async (): Promise<Room> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (!mockRoom) throw new Error("No room");
      
      const wasGameOver = mockRoom.state === 'GAME_OVER';
      
      if (wasGameOver) {
        mockRoom.state = 'LOBBY';
        mockRoom.impostorIds = [];
        mockRoom.winner = undefined;
        mockRoom.players.forEach(p => {
          p.isAlive = true;
        });
      } else {
        mockRoom.state = 'THEME_SELECTION';
      }
      
      mockRoom.theme = undefined;
      mockRoom.word = undefined;
      mockRoom.associations = {};
      mockRoom.votes = {};
      mockRoom.chat = [];
      mockRoom.ejectedPlayerId = undefined;
      mockRoom.phaseEndsAt = undefined;
      
      if (mockRoom.state === 'THEME_SELECTION') {
        const aliveCrewmates = mockRoom.players.filter(p => p.isAlive && !mockRoom!.impostorIds.includes(p.id));
        
        if (mockRoom.settings.forceHostPicker && mockRoom.players.find(p => p.id === mockRoom!.hostId)?.isAlive && !mockRoom.impostorIds.includes(mockRoom.hostId)) {
          mockRoom.themePickerId = mockRoom.hostId;
        } else if (aliveCrewmates.length > 0) {
          const pickerIndex = Math.floor(Math.random() * aliveCrewmates.length);
          mockRoom.themePickerId = aliveCrewmates[pickerIndex].id;
        } else {
          // Fallback if somehow no crewmates are alive (shouldn't happen if game isn't over)
          const alivePlayers = mockRoom.players.filter(p => p.isAlive);
          const pickerIndex = Math.floor(Math.random() * alivePlayers.length);
          mockRoom.themePickerId = alivePlayers[pickerIndex].id;
        }
      }
      
      resolve({...mockRoom});
    }, 500);
  });
};

export const pollRoom = async (): Promise<Room | null> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (mockRoom) {
        const picker = mockRoom.players.find(p => p.id === mockRoom!.themePickerId);
        
        // Bot Theme Selection
        if (mockRoom.state === 'THEME_SELECTION' && picker?.isBot) {
          const themes = Object.keys(THEME_DATA);
          mockRoom.theme = themes[Math.floor(Math.random() * themes.length)];
          mockRoom.state = 'WORD_SELECTION';
        } 
        // Bot Word Selection
        else if (mockRoom.state === 'WORD_SELECTION' && picker?.isBot) {
          const themeWords = THEME_DATA[mockRoom.theme || 'Animals'];
          const words = Object.keys(themeWords);
          mockRoom.word = words[Math.floor(Math.random() * words.length)];
          mockRoom.state = 'ASSOCIATION';
          mockRoom.associations = {};
          mockRoom.phaseEndsAt = Date.now() + (mockRoom.settings.writeTime * 1000);
          
          // Other bots submit their associations immediately
          mockRoom.players.filter(p => p.isBot && p.id !== mockRoom!.themePickerId).forEach(bot => {
            const isImpostor = mockRoom!.impostorIds.includes(bot.id);
            const themeData = THEME_DATA[mockRoom!.theme!];
            if (isImpostor) {
              const allWords = Object.keys(themeData);
              const randomWord = allWords[Math.floor(Math.random() * allWords.length)];
              const assocs = themeData[randomWord];
              mockRoom!.associations[bot.id] = assocs[Math.floor(Math.random() * assocs.length)];
            } else {
              const assocs = themeData[mockRoom!.word!];
              mockRoom!.associations[bot.id] = assocs[Math.floor(Math.random() * assocs.length)];
            }
          });
        }

        // General check for ASSOCIATION phase completion
        if (mockRoom.state === 'ASSOCIATION') {
          // Ensure bots have submitted associations
          mockRoom.players.filter(p => p.isBot && p.isAlive && p.id !== mockRoom!.themePickerId && !mockRoom!.associations[p.id]).forEach(bot => {
            const isImpostor = mockRoom!.impostorIds.includes(bot.id);
            const themeData = THEME_DATA[mockRoom!.theme!];
            if (isImpostor) {
              const allWords = Object.keys(themeData);
              const randomWord = allWords[Math.floor(Math.random() * allWords.length)];
              const assocs = themeData[randomWord];
              mockRoom!.associations[bot.id] = assocs[Math.floor(Math.random() * assocs.length)];
            } else {
              const assocs = themeData[mockRoom!.word!];
              mockRoom!.associations[bot.id] = assocs[Math.floor(Math.random() * assocs.length)];
            }
          });

          const alivePlayers = mockRoom.players.filter(p => p.isAlive && p.id !== mockRoom!.themePickerId);
          const allSubmitted = alivePlayers.length > 0 && alivePlayers.every(p => mockRoom!.associations[p.id]);
          const timeout = mockRoom.phaseEndsAt && Date.now() > mockRoom.phaseEndsAt;
          
          if (allSubmitted || timeout) {
            // If timeout, fill missing associations with "..."
            if (timeout && !allSubmitted) {
              alivePlayers.forEach(p => {
                if (!mockRoom!.associations[p.id]) {
                  mockRoom!.associations[p.id] = "...";
                }
              });
            }
            mockRoom.state = 'VOTING';
            mockRoom.votes = {};
            mockRoom.chat = mockRoom.chat || [];
            mockRoom.phaseEndsAt = Date.now() + (mockRoom.settings.writeTime * 1000);
          }
        }

        // General check for VOTING phase completion
        if (mockRoom.state === 'VOTING') {
          const aliveBots = mockRoom.players.filter(p => p.isBot && p.isAlive);
          
          aliveBots.forEach(bot => {
            if (mockRoom!.votes[bot.id]) return; // Already voted
            
            const isImpostor = mockRoom!.impostorIds.includes(bot.id);
            
            // Determine who this bot finds suspicious
            let susPlayers: Player[] = [];
            if (!isImpostor) {
              const themeData = THEME_DATA[mockRoom!.theme!];
              const validAssocs = themeData ? themeData[mockRoom!.word!] : null;
              
              susPlayers = mockRoom!.players.filter(p => {
                if (p.id === mockRoom!.themePickerId || !p.isAlive || !mockRoom!.associations[p.id]) return false;
                const assoc = mockRoom!.associations[p.id].toLowerCase();
                if (validAssocs && validAssocs.includes(assoc)) return false;
                if (p.isBot) return true; // Bots should only use valid words, so if a bot uses an invalid word, it's an impostor
                
                // For human players, check if they used a word from another category in the same theme
                if (!themeData) return false;
                let inOtherWord = false;
                for (const [w, assocs] of Object.entries(themeData)) {
                  if (w !== mockRoom!.word! && assocs.includes(assoc)) {
                    inOtherWord = true;
                    break;
                  }
                }
                if (inOtherWord) return true; // Definitely sus
                
                // Unknown word from human. Give them benefit of the doubt unless we already distrust them
                const trust = botTrust[bot.id]?.[p.id] || 0;
                if (trust < 0) return true;
                return Math.random() < 0.15; // Only 15% chance to find an unknown human word sus if neutral trust
              });
            }

            // Chat logic
            if (mockRoom!.chat.filter(c => c.senderId === bot.id).length < 2) {
              let text = "Who are we voting?";
              
              if (!isImpostor) {
                if (susPlayers.length > 0) {
                  susPlayers.sort((a, b) => (botTrust[bot.id]?.[a.id] || 0) - (botTrust[bot.id]?.[b.id] || 0));
                  const sus = susPlayers[0];
                  if (sus.id !== bot.id) {
                    const phrases = [
                      `${sus.name} is acting sus with "${mockRoom!.associations[sus.id]}"`,
                      `Why did ${sus.name} say "${mockRoom!.associations[sus.id]}"? Vote ${sus.name}`,
                      `I'm voting ${sus.name}, their word makes no sense.`
                    ];
                    if ((botTrust[bot.id]?.[sus.id] || 0) < 0) {
                      phrases.push(`I already didn't trust ${sus.name}, and now this word?`);
                    }
                    text = phrases[Math.floor(Math.random() * phrases.length)];
                  }
                } else {
                  const others = mockRoom!.players.filter(p => p.isAlive && p.id !== bot.id && p.id !== mockRoom!.themePickerId);
                  if (others.length > 0) {
                    others.sort((a, b) => (botTrust[bot.id]?.[a.id] || 0) - (botTrust[bot.id]?.[b.id] || 0));
                    const leastTrusted = others[0];
                    if ((botTrust[bot.id]?.[leastTrusted.id] || 0) < 0) {
                      text = `I don't trust ${leastTrusted.name} from before.`;
                    } else {
                      const phrases = [
                        "Everyone seems okay... this is hard.",
                        "I have no idea who it is.",
                        "Skip vote?"
                      ];
                      text = phrases[Math.floor(Math.random() * phrases.length)];
                    }
                  } else {
                    text = "Skip vote?";
                  }
                }
              } else {
                // Impostor deflects
                const others = mockRoom!.players.filter(p => p.isAlive && p.id !== bot.id);
                if (others.length > 0) {
                  others.sort((a, b) => (botTrust[bot.id]?.[a.id] || 0) - (botTrust[bot.id]?.[b.id] || 0));
                  const scapegoat = others[0];
                  const phrases = [
                    `I think ${scapegoat.name} is the impostor!`,
                    `${scapegoat.name} is super sus.`,
                    `My word was totally normal, vote ${scapegoat.name}`
                  ];
                  text = phrases[Math.floor(Math.random() * phrases.length)];
                }
              }
              
              mockRoom!.chat.push({
                id: generateId(),
                senderId: bot.id,
                senderName: bot.name,
                senderColor: bot.color,
                text,
                timestamp: Date.now()
              });
            }
            
            // Vote logic
            if (!mockRoom!.votes[bot.id]) {
              let voteTarget = bot.id;
              const aliveIds = mockRoom!.players.filter(p => p.isAlive).map(p => p.id);
              
              if (!isImpostor) {
                if (susPlayers.length > 0) {
                  susPlayers.sort((a, b) => (botTrust[bot.id]?.[a.id] || 0) - (botTrust[bot.id]?.[b.id] || 0));
                  voteTarget = susPlayers[0].id;
                } else {
                  const others = aliveIds.filter(id => id !== bot.id && id !== mockRoom!.themePickerId);
                  if (others.length > 0) {
                    others.sort((a, b) => (botTrust[bot.id]?.[a] || 0) - (botTrust[bot.id]?.[b] || 0));
                    if ((botTrust[bot.id]?.[others[0]] || 0) < 0) {
                      voteTarget = others[0];
                    } else {
                      voteTarget = others[Math.floor(Math.random() * others.length)];
                    }
                  }
                }
              } else {
                const others = aliveIds.filter(id => id !== bot.id && !mockRoom!.impostorIds.includes(id));
                if (others.length > 0) {
                  others.sort((a, b) => (botTrust[bot.id]?.[a] || 0) - (botTrust[bot.id]?.[b] || 0));
                  voteTarget = others[0];
                }
              }
              mockRoom!.votes[bot.id] = voteTarget;
            }
          });

          const alivePlayers = mockRoom.players.filter(p => p.isAlive);
          const allVoted = alivePlayers.length > 0 && alivePlayers.every(p => mockRoom!.votes[p.id]);
          const timeout = mockRoom.phaseEndsAt && Date.now() > mockRoom.phaseEndsAt;
          
          if (allVoted || timeout) {
            // If timeout, non-voters skip (vote for themselves or null)
            if (timeout && !allVoted) {
              alivePlayers.forEach(p => {
                if (!mockRoom!.votes[p.id]) {
                  mockRoom!.votes[p.id] = "skip"; // Use "skip" as a special value
                }
              });
            }
            mockRoom.state = 'RESULT';
            
            const voteCounts: Record<string, number> = {};
            Object.values(mockRoom.votes).forEach(vid => {
              if (vid !== "skip") {
                voteCounts[vid] = (voteCounts[vid] || 0) + 1;
              }
            });
            
            let maxVotes = 0;
            let ejectedId: string | null = null;
            let tie = false;
            
            Object.entries(voteCounts).forEach(([vid, count]) => {
              if (count > maxVotes) {
                maxVotes = count;
                ejectedId = vid;
                tie = false;
              } else if (count === maxVotes) {
                tie = true;
              }
            });
            
            if (tie) {
              mockRoom.ejectedPlayerId = null;
            } else {
              mockRoom.ejectedPlayerId = ejectedId;
              const ejectedPlayer = mockRoom.players.find(p => p.id === ejectedId);
              if (ejectedPlayer) ejectedPlayer.isAlive = false;
            }

            // Bot Learning Mechanism
            const bots = mockRoom.players.filter(p => p.isBot);
            bots.forEach(bot => {
              if (!botTrust[bot.id]) botTrust[bot.id] = {};
              
              // Decrease trust for anyone who voted for this bot
              Object.entries(mockRoom!.votes).forEach(([voterId, targetId]) => {
                if (targetId === bot.id && voterId !== bot.id) {
                  botTrust[bot.id][voterId] = (botTrust[bot.id][voterId] || 0) - 1;
                }
              });

              // Learn from ejected player
              if (ejectedId && ejectedId !== bot.id) {
                const ejectedWasImpostor = mockRoom!.impostorIds.includes(ejectedId);
                const botIsImpostor = mockRoom!.impostorIds.includes(bot.id);
                
                if (!botIsImpostor) {
                  if (ejectedWasImpostor) {
                    // Bot learns to trust people who voted for the impostor
                    Object.entries(mockRoom!.votes).forEach(([voterId, targetId]) => {
                      if (targetId === ejectedId && voterId !== bot.id) {
                        botTrust[bot.id][voterId] = (botTrust[bot.id][voterId] || 0) + 1;
                      }
                    });
                    botTrust[bot.id][ejectedId] = (botTrust[bot.id][ejectedId] || 0) - 5;
                  } else {
                    // Ejected was crewmate. Decrease trust for people who voted for them
                    Object.entries(mockRoom!.votes).forEach(([voterId, targetId]) => {
                      if (targetId === ejectedId && voterId !== bot.id) {
                        botTrust[bot.id][voterId] = (botTrust[bot.id][voterId] || 0) - 1;
                      }
                    });
                  }
                }
              }
            });
            
            const aliveImpostors = mockRoom.players.filter(p => p.isAlive && mockRoom!.impostorIds.includes(p.id));
            const aliveCrewmates = mockRoom.players.filter(p => p.isAlive && !mockRoom!.impostorIds.includes(p.id));
            const ejectedWasImpostor = ejectedId && mockRoom.impostorIds.includes(ejectedId);
            
            if (aliveImpostors.length === 0) {
              mockRoom.winner = 'CREWMATES';
              mockRoom.state = 'GAME_OVER';
            } else if (aliveImpostors.length >= aliveCrewmates.length) {
              mockRoom.winner = 'IMPOSTORS';
              mockRoom.state = 'GAME_OVER';
            }
          }
        }
      }
      resolve(mockRoom ? {...mockRoom} : null);
    }, 500);
  });
};
