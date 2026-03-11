<?php
/**
 * Handle chat messages, votes, theme selection, word selection, association, fill_bots, next_round.
 */
require_once __DIR__ . '/db.php';

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$playerId = $input['playerId'] ?? '';
$roomCode = $input['roomCode'] ?? '';
$action = $input['action'] ?? '';

if (!$playerId || !$roomCode || !$action) {
    http_response_code(400);
    echo json_encode(['error' => 'playerId, roomCode and action required']);
    exit;
}

function generateId($pdo) {
    return bin2hex(random_bytes(4)) . substr(uniqid('', true), -4);
}

// Avoid gray/dark colors that blend with chat background
$COLORS = ['#c51111', '#132ed1', '#117f2d', '#ed54ba', '#ef7d0d', '#f5f557', '#9c27b0', '#00bcd4', '#6b2fbb', '#e91e63', '#38fedc', '#50ef39'];

try {
    $stmt = $pdo->prepare("SELECT * FROM rooms WHERE code = ?");
    $stmt->execute([$roomCode]);
    $room = $stmt->fetch();
    if (!$room) {
        http_response_code(404);
        echo json_encode(['error' => 'Room not found']);
        exit;
    }

    $stmt = $pdo->prepare("SELECT id, name, role, is_host, color FROM players WHERE room_id = ?");
    $stmt->execute([$room['id']]);
    $players = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $me = null;
    foreach ($players as $p) {
        if ($p['id'] === $playerId) {
            $me = $p;
            break;
        }
    }
    if (!$me) {
        http_response_code(403);
        echo json_encode(['error' => 'Not in this room']);
        exit;
    }

    switch ($action) {
        case 'select_theme':
            if ($room['theme_picker_id'] !== $playerId) {
                http_response_code(403);
                echo json_encode(['error' => 'Only theme picker can select theme']);
                exit;
            }
            $theme = trim((string) ($input['theme'] ?? ''));
            if ($theme === '') {
                http_response_code(400);
                echo json_encode(['error' => 'theme required']);
                exit;
            }
            $pdo->prepare("UPDATE rooms SET status = 'WORD_SELECTION', category = ? WHERE id = ?")->execute([$theme, $room['id']]);
            echo json_encode(['ok' => true]);
            break;

        case 'select_word':
            if ($room['theme_picker_id'] !== $playerId) {
                http_response_code(403);
                echo json_encode(['error' => 'Only theme picker can select word']);
                exit;
            }
            $word = trim((string) ($input['word'] ?? ''));
            if ($word === '') {
                http_response_code(400);
                echo json_encode(['error' => 'word required']);
                exit;
            }
            $settings = json_decode($room['settings'], true) ?: [];
            $writeTime = (int) ($settings['writeTime'] ?? 45);
            $phaseEndsAt = (string) (time() + $writeTime);
            $pdo->prepare("UPDATE rooms SET status = 'ASSOCIATION', current_word = ?, associations = '{}', votes = NULL, phase_ends_at = ? WHERE id = ?")
                ->execute([$word, $phaseEndsAt, $room['id']]);
            echo json_encode(['ok' => true]);
            break;

        case 'association':
            if ($room['status'] !== 'ASSOCIATION') {
                http_response_code(400);
                echo json_encode(['error' => 'Not in association phase']);
                exit;
            }
            if ($room['theme_picker_id'] === $playerId) {
                http_response_code(400);
                echo json_encode(['error' => 'Theme picker does not submit association']);
                exit;
            }
            $stmt = $pdo->prepare("SELECT is_alive FROM players WHERE id = ?");
            $stmt->execute([$playerId]);
            if (!$stmt->fetch()['is_alive']) {
                http_response_code(400);
                echo json_encode(['error' => 'Dead players cannot submit']);
                exit;
            }
            $word = trim((string) ($input['word'] ?? ''));
            if ($word === '') {
                http_response_code(400);
                echo json_encode(['error' => 'word required']);
                exit;
            }
            $assoc = json_decode($room['associations'], true) ?: [];
            $assoc[$playerId] = $word;
            $pdo->prepare("UPDATE rooms SET associations = ? WHERE id = ?")->execute([json_encode($assoc), $room['id']]);
            echo json_encode(['ok' => true]);
            break;

        case 'vote':
            if ($room['status'] !== 'VOTING') {
                http_response_code(400);
                echo json_encode(['error' => 'Not in voting phase']);
                exit;
            }
            $stmt = $pdo->prepare("SELECT is_alive FROM players WHERE id = ?");
            $stmt->execute([$playerId]);
            if (!$stmt->fetch()['is_alive']) {
                http_response_code(400);
                echo json_encode(['error' => 'Dead players cannot vote']);
                exit;
            }
            $votedPlayerId = $input['votedPlayerId'] ?? '';
            $votes = json_decode($room['votes'], true) ?: [];
            $votes[$playerId] = $votedPlayerId;
            $pdo->prepare("UPDATE rooms SET votes = ? WHERE id = ?")->execute([json_encode($votes), $room['id']]);
            echo json_encode(['ok' => true]);
            break;

        case 'chat':
            $text = trim((string) ($input['text'] ?? ''));
            if ($text === '') {
                http_response_code(400);
                echo json_encode(['error' => 'text required']);
                exit;
            }
            $msgId = generateId($pdo);
            $pdo->prepare("INSERT INTO messages (id, room_id, sender_id, sender_name, sender_color, text, type, timestamp) VALUES (?, ?, ?, ?, ?, ?, 'chat', ?)")
                ->execute([$msgId, $room['id'], $playerId, $me['name'], $me['color'], $text, (string) (time() * 1000)]);
            echo json_encode(['ok' => true]);
            break;

        case 'fill_bots':
            if (!$me['is_host']) {
                http_response_code(403);
                echo json_encode(['error' => 'Only host can fill bots']);
                exit;
            }
            $settings = json_decode($room['settings'], true) ?: [];
            $maxPlayers = (int) ($settings['maxPlayers'] ?? 10);
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM players WHERE room_id = ?");
            $stmt->execute([$room['id']]);
            $current = (int) $stmt->fetchColumn();
            $stmt = $pdo->prepare("SELECT color FROM players WHERE room_id = ?");
            $stmt->execute([$room['id']]);
            $takenColors = $stmt->fetchAll(PDO::FETCH_COLUMN);
            $available = array_values(array_diff($COLORS, $takenColors));
            for ($i = $current; $i < $maxPlayers; $i++) {
                $botId = 'bot-' . bin2hex(random_bytes(4));
                $color = $available[$i % count($available)] ?? $COLORS[$i % count($COLORS)];
                $pdo->prepare("INSERT INTO players (id, room_id, name, role, is_host, is_alive, is_bot, color) VALUES (?, ?, ?, 'civilian', 0, 1, 1, ?)")
                    ->execute([$botId, $room['id'], 'Bot ' . ($i - $current + 1), $color]);
            }
            echo json_encode(['ok' => true]);
            break;

        case 'next_round':
            if (!$me['is_host']) {
                http_response_code(403);
                echo json_encode(['error' => 'Only host can advance']);
                exit;
            }
            $wasGameOver = ($room['status'] === 'GAME_OVER');
            if ($wasGameOver) {
                $pdo->prepare("DELETE FROM messages WHERE room_id = ?")->execute([$room['id']]);
                $pdo->prepare("UPDATE players SET is_alive = 1, role = 'civilian' WHERE room_id = ?")->execute([$room['id']]);
                $pdo->prepare("UPDATE rooms SET status = 'LOBBY', theme_picker_id = NULL, category = NULL, current_word = NULL, associations = NULL, votes = NULL, ejected_player_id = NULL, winner = NULL, phase_ends_at = NULL WHERE id = ?")->execute([$room['id']]);
            } else {
                $settings = json_decode($room['settings'], true) ?: [];
                $stmt = $pdo->prepare("SELECT id FROM players WHERE room_id = ? AND is_alive = 1 AND role = 'civilian'");
                $stmt->execute([$room['id']]);
                $aliveCrew = $stmt->fetchAll(PDO::FETCH_COLUMN);
                $forceHostPicker = !empty($settings['forceHostPicker']);
                $hostId = $room['host_id'];
                $themePickerId = null;
                if ($forceHostPicker) {
                    $stmt = $pdo->prepare("SELECT id FROM players WHERE id = ? AND is_alive = 1");
                    $stmt->execute([$hostId]);
                    if ($stmt->fetch() && in_array($hostId, $aliveCrew)) {
                        $themePickerId = $hostId;
                    }
                }
                if (!$themePickerId && count($aliveCrew) > 0) {
                    $themePickerId = $aliveCrew[array_rand($aliveCrew)];
                }
                if (!$themePickerId) {
                    $stmt = $pdo->prepare("SELECT id FROM players WHERE room_id = ? AND is_alive = 1");
                    $stmt->execute([$room['id']]);
                    $alive = $stmt->fetchAll(PDO::FETCH_COLUMN);
                    $themePickerId = $alive[array_rand($alive)] ?? $hostId;
                }
                $pdo->prepare("DELETE FROM messages WHERE room_id = ?")->execute([$room['id']]);
                $pdo->prepare("UPDATE rooms SET status = 'THEME_SELECTION', theme_picker_id = ?, category = NULL, current_word = NULL, associations = NULL, votes = NULL, ejected_player_id = NULL, winner = NULL, phase_ends_at = NULL WHERE id = ?")->execute([$themePickerId, $room['id']]);
            }
            echo json_encode(['ok' => true]);
            break;

        default:
            http_response_code(400);
            echo json_encode(['error' => 'Unknown action: ' . $action]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
