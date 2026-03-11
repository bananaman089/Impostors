<?php
/**
 * Polling engine: returns full room state as JSON matching frontend Room type.
 * If requesting playerId is impostor, current_word in response is null.
 * Full bot logic from mocks: theme/word pick, associations, voting + chat.
 */
require_once __DIR__ . '/db.php';
$THEME_DATA = require __DIR__ . '/theme_data.php';

function generateId() {
    return bin2hex(random_bytes(4)) . substr(uniqid('', true), -4);
}

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$playerId = $input['playerId'] ?? $_GET['playerId'] ?? '';
$roomCode = $input['roomCode'] ?? $_GET['roomCode'] ?? '';

if (!$playerId || !$roomCode) {
    http_response_code(400);
    echo json_encode(['error' => 'playerId and roomCode required']);
    exit;
}

try {
    $stmt = $pdo->prepare("SELECT * FROM rooms WHERE code = ?");
    $stmt->execute([$roomCode]);
    $room = $stmt->fetch();
    if (!$room) {
        http_response_code(404);
        echo json_encode(['error' => 'Room not found']);
        exit;
    }

    $stmt = $pdo->prepare("SELECT id, room_id, name, role, is_host, is_alive, is_bot, color FROM players WHERE room_id = ? ORDER BY is_host DESC, id");
    $stmt->execute([$room['id']]);
    $playersRows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $requestingPlayer = null;
    foreach ($playersRows as $p) {
        if ($p['id'] === $playerId) {
            $requestingPlayer = $p;
            break;
        }
    }
    if (!$requestingPlayer) {
        http_response_code(403);
        echo json_encode(['error' => 'You are not in this room']);
        exit;
    }

    $settings = json_decode($room['settings'], true);
    if (!$settings) {
        $settings = ['maxPlayers' => 10, 'impostorCount' => 1, 'writeTime' => 45, 'forceHostImpostor' => false, 'forceHostPicker' => false];
    }
    $writeTime = (int) ($settings['writeTime'] ?? 45);

    // --- State machine: advance phase when conditions met ---
    $themePickerId = $room['theme_picker_id'];
    $associations = json_decode($room['associations'], true);
    if (!is_array($associations)) {
        $associations = [];
    }
    $votes = json_decode($room['votes'], true);
    if (!is_array($votes)) {
        $votes = [];
    }
    $phaseEndsAtSec = $room['phase_ends_at'] ? (int) $room['phase_ends_at'] : null;
    $now = time();

    $THEMES = ['Animals', 'Technology', 'Food', 'Movies', 'Sports', 'Geography'];
    $pickerIsBot = false;
    foreach ($playersRows as $p) {
        if ($p['id'] === $themePickerId && (int) $p['is_bot'] === 1) {
            $pickerIsBot = true;
            break;
        }
    }

    // Only one phase transition per request so the client sees each step (e.g. WORD_SELECTION for entering the next word)
    $phaseTransitionDone = false;

    // Bot theme picker: auto-select theme
    if (!$phaseTransitionDone && $room['status'] === 'THEME_SELECTION' && $themePickerId && $pickerIsBot) {
        $theme = $THEMES[array_rand($THEMES)];
        $pdo->prepare("UPDATE rooms SET status = 'WORD_SELECTION', category = ? WHERE id = ?")->execute([$theme, $room['id']]);
        $room['status'] = 'WORD_SELECTION';
        $room['category'] = $theme;
        $phaseTransitionDone = true;
    }

    // Bot word picker: auto-select word from game_words
    if (!$phaseTransitionDone && $room['status'] === 'WORD_SELECTION' && $themePickerId && $pickerIsBot) {
        $cat = $room['category'] ?? 'Animals';
        $stmt = $pdo->prepare("SELECT word FROM game_words WHERE category = ? ORDER BY RAND() LIMIT 1");
        $stmt->execute([$cat]);
        $row = $stmt->fetch();
        $word = $row ? $row['word'] : 'Mystery';
        $phaseEnd = (string) ($now + $writeTime);
        $pdo->prepare("UPDATE rooms SET status = 'ASSOCIATION', current_word = ?, associations = '{}', phase_ends_at = ? WHERE id = ?")
            ->execute([$word, $phaseEnd, $room['id']]);
        $room['status'] = 'ASSOCIATION';
        $room['current_word'] = $word;
        $room['associations'] = '{}';
        $room['phase_ends_at'] = $phaseEnd;
        $associations = [];
        $phaseTransitionDone = true;
    }

    if (!$phaseTransitionDone && $room['status'] === 'ASSOCIATION') {
        $aliveNonPicker = array_filter($playersRows, function ($p) use ($themePickerId) {
            return $p['id'] !== $themePickerId && (int) $p['is_alive'] === 1;
        });
        $category = $room['category'] ?? 'Animals';
        $currentWord = $room['current_word'] ?? '';
        $themeWords = $THEME_DATA[$category] ?? [];
        $validAssocs = isset($themeWords[$currentWord]) ? $themeWords[$currentWord] : [];
        foreach ($aliveNonPicker as $p) {
            if (isset($associations[$p['id']])) continue;
            $isBot = (int) $p['is_bot'] === 1;
            if ($isBot) {
                $isImpostorBot = ($p['role'] === 'impostor');
                if ($isImpostorBot) {
                    $otherWords = array_keys($themeWords);
                    $pickWord = $otherWords[array_rand($otherWords)];
                    $list = $themeWords[$pickWord];
                    $associations[$p['id']] = $list[array_rand($list)];
                } else {
                    if (!empty($validAssocs)) {
                        $associations[$p['id']] = $validAssocs[array_rand($validAssocs)];
                    } else {
                        $associations[$p['id']] = 'clue';
                    }
                }
                $pdo->prepare("UPDATE rooms SET associations = ? WHERE id = ?")->execute([json_encode($associations), $room['id']]);
            }
        }
        $allSubmitted = count($aliveNonPicker) > 0 && count(array_intersect_key($associations, array_flip(array_column($aliveNonPicker, 'id')))) >= count($aliveNonPicker);
        $timeout = $phaseEndsAtSec && $now >= $phaseEndsAtSec;
        if ($allSubmitted || $timeout) {
            if ($timeout && !$allSubmitted) {
                foreach ($aliveNonPicker as $p) {
                    if (!isset($associations[$p['id']])) {
                        $associations[$p['id']] = ''; // empty = did not submit (show as blank in UI)
                    }
                }
                $pdo->prepare("UPDATE rooms SET associations = ? WHERE id = ?")->execute([json_encode($associations), $room['id']]);
            }
            $newPhaseEnd = (string) ($now + $writeTime);
            $pdo->prepare("UPDATE rooms SET status = 'VOTING', votes = '{}', phase_ends_at = ? WHERE id = ?")->execute([$newPhaseEnd, $room['id']]);
            $room['status'] = 'VOTING';
            $room['votes'] = '{}';
            $room['phase_ends_at'] = $newPhaseEnd;
            $votes = [];
            $phaseTransitionDone = true;
        }
    }

    if (!$phaseTransitionDone && $room['status'] === 'VOTING') {
        // Use current phase_ends_at so we don't use stale ASSOCIATION end time (which would
        // make voting timeout immediately when we just transitioned from ASSOCIATION)
        $phaseEndsAtSec = $room['phase_ends_at'] ? (int) $room['phase_ends_at'] : null;
        $category = $room['category'] ?? 'Animals';
        $currentWord = $room['current_word'] ?? '';
        $themeWords = $THEME_DATA[$category] ?? [];
        $validAssocs = isset($themeWords[$currentWord]) ? array_map('strtolower', $themeWords[$currentWord]) : [];
        $impostorIds = array_column(array_filter($playersRows, function ($p) { return $p['role'] === 'impostor'; }), 'id');
        $aliveIds = array_column(array_filter($playersRows, function ($p) { return (int) $p['is_alive'] === 1; }), 'id');

        $stmtChat = $pdo->prepare("SELECT sender_id FROM messages WHERE room_id = ? AND type = 'chat'");
        $stmtChat->execute([$room['id']]);
        $chatBySender = [];
        while ($row = $stmtChat->fetch()) {
            $sid = $row['sender_id'];
            $chatBySender[$sid] = ($chatBySender[$sid] ?? 0) + 1;
        }

        foreach ($playersRows as $p) {
            if ((int) $p['is_alive'] !== 1 || (int) $p['is_bot'] !== 1) continue;
            if (isset($votes[$p['id']])) continue;
            $botIsImpostor = in_array($p['id'], $impostorIds);
            $othersAlive = array_filter($playersRows, function ($x) use ($p, $themePickerId) {
                return $x['id'] !== $p['id'] && $x['id'] !== $themePickerId && (int) $x['is_alive'] === 1;
            });
            if (($chatBySender[$p['id']] ?? 0) < 2) {
                $msg = 'Who are we voting?';
                if (!$botIsImpostor) {
                    $sus = [];
                    foreach ($othersAlive as $o) {
                        $assoc = isset($associations[$o['id']]) ? strtolower(trim($associations[$o['id']])) : '';
                        if ($assoc === '' || $assoc === '...') continue;
                        if (!in_array($assoc, $validAssocs)) $sus[] = $o;
                    }
                    if (count($sus) > 0) {
                        $s = $sus[array_rand($sus)];
                        $phrases = [
                            $s['name'] . ' is acting sus with "' . ($associations[$s['id']] ?? '') . '"',
                            'Why did ' . $s['name'] . ' say "' . ($associations[$s['id']] ?? '') . '"? Vote ' . $s['name'],
                            'I\'m voting ' . $s['name'] . ', their word makes no sense.',
                        ];
                        $msg = $phrases[array_rand($phrases)];
                    } else {
                        $phrases = ['Everyone seems okay... this is hard.', 'I have no idea who it is.', 'Skip vote?'];
                        $msg = $phrases[array_rand($phrases)];
                    }
                } else {
                    $crewmates = array_filter($othersAlive, function ($x) use ($impostorIds) { return !in_array($x['id'], $impostorIds); });
                    if (count($crewmates) > 0) {
                        $s = $crewmates[array_rand($crewmates)];
                        $phrases = [
                            'I think ' . $s['name'] . ' is the impostor!',
                            $s['name'] . ' is super sus.',
                            'My word was totally normal, vote ' . $s['name'],
                        ];
                        $msg = $phrases[array_rand($phrases)];
                    }
                }
                $msgId = generateId();
                $pdo->prepare("INSERT INTO messages (id, room_id, sender_id, sender_name, sender_color, text, type, timestamp) VALUES (?, ?, ?, ?, ?, ?, 'chat', ?)")
                    ->execute([$msgId, $room['id'], $p['id'], $p['name'], $p['color'], $msg, (string) (time() * 1000)]);
                $chatBySender[$p['id']] = ($chatBySender[$p['id']] ?? 0) + 1;
            }
            $voteTarget = $p['id'];
            if (!$botIsImpostor) {
                $sus = [];
                foreach ($othersAlive as $o) {
                    $assoc = isset($associations[$o['id']]) ? strtolower(trim($associations[$o['id']])) : '';
                    if ($assoc === '' || $assoc === '...') continue;
                    if (!in_array($assoc, $validAssocs)) $sus[] = $o;
                }
                if (count($sus) > 0) {
                    $voteTarget = $sus[array_rand($sus)]['id'];
                } else {
                    $otherIds = array_column($othersAlive, 'id');
                    $voteTarget = count($otherIds) > 0 ? $otherIds[array_rand($otherIds)] : $p['id'];
                }
            } else {
                $crewmates = array_filter($othersAlive, function ($x) use ($impostorIds) { return !in_array($x['id'], $impostorIds); });
                if (count($crewmates) > 0) {
                    $voteTarget = $crewmates[array_rand($crewmates)]['id'];
                }
            }
            $votes[$p['id']] = $voteTarget;
            $pdo->prepare("UPDATE rooms SET votes = ? WHERE id = ?")->execute([json_encode($votes), $room['id']]);
            // One bot per poll so spectators (and others) see chat messages during voting instead of jumping straight to RESULT
            break;
        }

        $allVoted = count($aliveIds) > 0 && count(array_intersect_key($votes, array_flip($aliveIds))) >= count($aliveIds);
        $timeout = $phaseEndsAtSec && $now >= $phaseEndsAtSec;
        if ($allVoted || $timeout) {
            if ($timeout && !$allVoted) {
                foreach ($aliveIds as $pid) {
                    if (!isset($votes[$pid])) {
                        $votes[$pid] = 'skip';
                    }
                }
                $pdo->prepare("UPDATE rooms SET votes = ? WHERE id = ?")->execute([json_encode($votes), $room['id']]);
            }
            $voteCounts = [];
            foreach ($votes as $vid) {
                if ($vid !== 'skip') {
                    $voteCounts[$vid] = ($voteCounts[$vid] ?? 0) + 1;
                }
            }
            $maxVotes = 0;
            $ejectedId = null;
            $tie = false;
            foreach ($voteCounts as $vid => $count) {
                if ($count > $maxVotes) {
                    $maxVotes = $count;
                    $ejectedId = $vid;
                    $tie = false;
                } elseif ($count === $maxVotes) {
                    $tie = true;
                }
            }
            if ($tie) {
                $ejectedId = null;
            }
            $pdo->prepare("UPDATE rooms SET status = 'RESULT', ejected_player_id = ? WHERE id = ?")->execute([$ejectedId, $room['id']]);
            $room['status'] = 'RESULT';
            $room['ejected_player_id'] = $ejectedId;
            // Do NOT clear chat here: keep discussion visible during vote-results screen; clear when next round starts
            if ($ejectedId) {
                $pdo->prepare("UPDATE players SET is_alive = 0 WHERE id = ?")->execute([$ejectedId]);
                foreach ($playersRows as $i => $p) {
                    if ($p['id'] === $ejectedId) {
                        $playersRows[$i]['is_alive'] = '0';
                        break;
                    }
                }
            }
            $impostorIds = [];
            foreach ($playersRows as $p) {
                if ($p['role'] === 'impostor') {
                    $impostorIds[] = $p['id'];
                }
            }
            $aliveImpostors = array_filter($playersRows, function ($p) use ($ejectedId, $impostorIds) {
                return (int) $p['is_alive'] === 1 && in_array($p['id'], $impostorIds);
            });
            $aliveCrewmates = array_filter($playersRows, function ($p) use ($impostorIds) {
                return (int) $p['is_alive'] === 1 && !in_array($p['id'], $impostorIds);
            });
            $winner = null;
            if (count($aliveImpostors) === 0) {
                $winner = 'CREWMATES';
            } elseif (count($aliveImpostors) >= count($aliveCrewmates)) {
                $winner = 'IMPOSTORS';
            }
            if ($winner) {
                $pdo->prepare("UPDATE rooms SET status = 'GAME_OVER', winner = ? WHERE id = ?")->execute([$winner, $room['id']]);
                $room['status'] = 'GAME_OVER';
                $room['winner'] = $winner;
            }
            $phaseTransitionDone = true;
        }
    }

    // Re-fetch room after possible updates
    $stmt = $pdo->prepare("SELECT * FROM rooms WHERE id = ?");
    $stmt->execute([$room['id']]);
    $room = $stmt->fetch();
    $associations = json_decode($room['associations'], true);
    if (!is_array($associations)) {
        $associations = [];
    }
    $votes = json_decode($room['votes'], true);
    if (!is_array($votes)) {
        $votes = [];
    }
    $stmt = $pdo->prepare("SELECT id, room_id, name, role, is_host, is_alive, is_bot, color FROM players WHERE room_id = ? ORDER BY is_host DESC, id");
    $stmt->execute([$room['id']]);
    $playersRows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $isImpostor = ($requestingPlayer['role'] === 'impostor');
    $currentWord = $room['current_word'];
    if ($isImpostor && $currentWord !== null && $currentWord !== '') {
        $currentWord = null;
    }

    $settings = json_decode($room['settings'], true);
    if (!$settings) {
        $settings = ['maxPlayers' => 10, 'impostorCount' => 1, 'writeTime' => 45, 'forceHostImpostor' => false, 'forceHostPicker' => false];
    }

    $impostorIds = [];
    foreach ($playersRows as $p) {
        if ($p['role'] === 'impostor') {
            $impostorIds[] = $p['id'];
        }
    }

    $stmt = $pdo->prepare("SELECT id, sender_id AS senderId, sender_name AS senderName, sender_color AS senderColor, text, timestamp FROM messages WHERE room_id = ? AND type = 'chat' ORDER BY timestamp ASC");
    $stmt->execute([$room['id']]);
    $chatRows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $chat = array_map(function ($r) {
        return [
            'id' => $r['id'],
            'senderId' => $r['senderId'],
            'senderName' => $r['senderName'],
            'senderColor' => $r['senderColor'],
            'text' => $r['text'],
            'timestamp' => (int) $r['timestamp'],
        ];
    }, $chatRows);

    $players = array_map(function ($p) {
        return [
            'id' => $p['id'],
            'name' => $p['name'],
            'color' => $p['color'],
            'isBot' => (bool) (int) $p['is_bot'],
            'isHost' => (bool) (int) $p['is_host'],
            'isAlive' => (bool) (int) $p['is_alive'],
        ];
    }, $playersRows);

    $payload = [
        'id' => $room['id'],
        'code' => $room['code'],
        'hostId' => $room['host_id'],
        'players' => $players,
        'settings' => $settings,
        'state' => $room['status'],
        'themePickerId' => $room['theme_picker_id'],
        'theme' => $room['category'],
        'word' => $currentWord,
        'impostorIds' => $impostorIds,
        'associations' => $associations,
        'votes' => $votes,
        'chat' => $chat,
        'ejectedPlayerId' => $room['ejected_player_id'],
        'winner' => $room['winner'],
        'phaseEndsAt' => $room['phase_ends_at'] ? (int) $room['phase_ends_at'] * 1000 : null,
    ];

    echo json_encode($payload);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
