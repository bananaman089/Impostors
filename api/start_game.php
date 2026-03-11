<?php
/**
 * Start the game: set THEME_SELECTION, pick theme picker, assign impostor(s).
 */
require_once __DIR__ . '/db.php';

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$playerId = $input['playerId'] ?? '';
$roomCode = $input['roomCode'] ?? '';

if (!$playerId || !$roomCode) {
    http_response_code(400);
    echo json_encode(['error' => 'playerId and roomCode required']);
    exit;
}

try {
    $stmt = $pdo->prepare("SELECT r.id, r.host_id, r.settings FROM rooms r WHERE r.code = ? AND r.status = 'LOBBY'");
    $stmt->execute([$roomCode]);
    $room = $stmt->fetch();
    if (!$room) {
        http_response_code(404);
        echo json_encode(['error' => 'Room not found or game already started']);
        exit;
    }
    if ($room['host_id'] !== $playerId) {
        http_response_code(403);
        echo json_encode(['error' => 'Only host can start the game']);
        exit;
    }

    $settings = json_decode($room['settings'], true) ?: [];
    $impostorCount = (int) ($settings['impostorCount'] ?? 1);
    $forceHostImpostor = !empty($settings['forceHostImpostor']);
    $forceHostPicker = !empty($settings['forceHostPicker']);

    $stmt = $pdo->prepare("SELECT id FROM players WHERE room_id = ? ORDER BY id");
    $stmt->execute([$room['id']]);
    $playerIds = $stmt->fetchAll(PDO::FETCH_COLUMN);

    if (count($playerIds) < 4) {
        http_response_code(400);
        echo json_encode(['error' => 'Need at least 4 players']);
        exit;
    }

    // Theme picker (cannot be impostor in the same round)
    if ($forceHostPicker) {
        $themePickerId = $room['host_id'];
    } else {
        $pool = $forceHostImpostor ? array_values(array_diff($playerIds, [$room['host_id']])) : $playerIds;
        $themePickerId = $pool[array_rand($pool)];
    }

    // Impostors: only from players who are NOT the theme picker (no one is both picker and impostor)
    $availableForImpostor = array_values(array_diff($playerIds, [$themePickerId]));
    $impostorIds = [];
    if ($forceHostImpostor && in_array($room['host_id'], $availableForImpostor)) {
        $impostorIds[] = $room['host_id'];
        $availableForImpostor = array_values(array_diff($availableForImpostor, [$room['host_id']]));
    }
    $needed = $impostorCount - count($impostorIds);
    shuffle($availableForImpostor);
    for ($i = 0; $i < $needed && $i < count($availableForImpostor); $i++) {
        $impostorIds[] = $availableForImpostor[$i];
    }

    $stmt = $pdo->prepare("UPDATE rooms SET status = 'THEME_SELECTION', theme_picker_id = ?, associations = NULL, votes = NULL, ejected_player_id = NULL, winner = NULL, phase_ends_at = NULL WHERE id = ?");
    $stmt->execute([$themePickerId, $room['id']]);

    foreach ($playerIds as $pid) {
        $role = in_array($pid, $impostorIds) ? 'impostor' : 'civilian';
        $pdo->prepare("UPDATE players SET role = ? WHERE id = ?")->execute([$role, $pid]);
    }

    echo json_encode(['ok' => true]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
