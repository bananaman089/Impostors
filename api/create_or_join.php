<?php
/**
 * Create a new room (host) or join existing room (guest).
 * Returns playerId and roomCode. Guest system: assigns unique playerId.
 */
require_once __DIR__ . '/db.php';

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$name = trim((string) ($input['name'] ?? ''));
$code = isset($input['code']) ? strtoupper(trim((string) $input['code'])) : null;
$settings = $input['settings'] ?? null;

if ($name === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Name is required']);
    exit;
}

// Avoid gray/dark colors that blend with chat background
$COLORS = ['#c51111', '#132ed1', '#117f2d', '#ed54ba', '#ef7d0d', '#f5f557', '#9c27b0', '#00bcd4', '#6b2fbb', '#e91e63', '#38fedc', '#50ef39'];

function generateId() {
    return bin2hex(random_bytes(4)) . substr(uniqid('', true), -4);
}

function generateRoomCode() {
    return strtoupper(substr(bin2hex(random_bytes(3)), 0, 6));
}

try {
    if ($code !== null && $code !== '') {
        // JOIN: find room by code
        $stmt = $pdo->prepare("SELECT id, code, host_id FROM rooms WHERE code = ? AND status = 'LOBBY'");
        $stmt->execute([$code]);
        $room = $stmt->fetch();
        if (!$room) {
            http_response_code(404);
            echo json_encode(['error' => 'Room not found']);
            exit;
        }
        $settingsJson = null;
        $stmt = $pdo->prepare("SELECT settings FROM rooms WHERE id = ?");
        $stmt->execute([$room['id']]);
        $row = $stmt->fetch();
        $settingsDecoded = $row ? json_decode($row['settings'], true) : null;
        $maxPlayers = $settingsDecoded['maxPlayers'] ?? 10;

        $stmt = $pdo->prepare("SELECT COUNT(*) FROM players WHERE room_id = ?");
        $stmt->execute([$room['id']]);
        $count = (int) $stmt->fetchColumn();
        if ($count >= $maxPlayers) {
            http_response_code(400);
            echo json_encode(['error' => 'Room is full']);
            exit;
        }

        $stmt = $pdo->prepare("SELECT color FROM players WHERE room_id = ?");
        $stmt->execute([$room['id']]);
        $takenColors = $stmt->fetchAll(PDO::FETCH_COLUMN);
        $available = array_values(array_diff($COLORS, $takenColors));
        $color = $available[0] ?? $COLORS[array_rand($COLORS)];

        $playerId = generateId();
        $pdo->prepare("INSERT INTO players (id, room_id, name, role, is_host, is_alive, is_bot, color) VALUES (?, ?, ?, 'civilian', 0, 1, 0, ?)")
            ->execute([$playerId, $room['id'], $name, $color]);

        echo json_encode([
            'playerId' => $playerId,
            'roomCode' => $room['code'],
        ]);
        exit;
    }

    // CREATE: new room
    $roomId = generateId();
    $roomCode = generateRoomCode();
    $playerId = generateId();

    $defaultSettings = [
        'maxPlayers' => (int) ($settings['maxPlayers'] ?? 10),
        'impostorCount' => (int) ($settings['impostorCount'] ?? 1),
        'writeTime' => (int) ($settings['writeTime'] ?? 45),
        'forceHostImpostor' => !empty($settings['forceHostImpostor']),
        'forceHostPicker' => !empty($settings['forceHostPicker']),
    ];
    $settingsJson = json_encode($defaultSettings);

    $pdo->prepare("INSERT INTO rooms (id, code, status, host_id, settings) VALUES (?, ?, 'LOBBY', ?, ?)")
        ->execute([$roomId, $roomCode, $playerId, $settingsJson]);

    $pdo->prepare("INSERT INTO players (id, room_id, name, role, is_host, is_alive, is_bot, color) VALUES (?, ?, ?, 'civilian', 1, 1, 0, ?)")
        ->execute([$playerId, $roomId, $name, $COLORS[array_rand($COLORS)]]);

    echo json_encode([
        'playerId' => $playerId,
        'roomCode' => $roomCode,
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
