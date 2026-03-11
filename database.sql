-- Impostor Party Hub - MySQL Schema for phpMyAdmin
-- Run this in phpMyAdmin to create the database and tables.

CREATE DATABASE IF NOT EXISTS impostor_party_hub;
USE impostor_party_hub;

-- Rooms: game sessions
CREATE TABLE rooms (
  id VARCHAR(36) PRIMARY KEY,
  code VARCHAR(10) NOT NULL UNIQUE,
  status VARCHAR(32) NOT NULL DEFAULT 'LOBBY',
  current_word VARCHAR(128) NULL,
  category VARCHAR(64) NULL,
  host_id VARCHAR(36) NOT NULL,
  theme_picker_id VARCHAR(36) NULL,
  phase_ends_at INT UNSIGNED NULL,
  ejected_player_id VARCHAR(36) NULL,
  winner VARCHAR(16) NULL,
  settings JSON NULL,
  associations JSON NULL,
  votes JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_code (code),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Players: guests in a room (name = guest display name)
CREATE TABLE players (
  id VARCHAR(36) PRIMARY KEY,
  room_id VARCHAR(36) NOT NULL,
  name VARCHAR(64) NOT NULL,
  role ENUM('civilian', 'impostor') NOT NULL DEFAULT 'civilian',
  is_host TINYINT(1) NOT NULL DEFAULT 0,
  is_alive TINYINT(1) NOT NULL DEFAULT 1,
  is_bot TINYINT(1) NOT NULL DEFAULT 0,
  color VARCHAR(20) NOT NULL DEFAULT '#9c27b0',
  last_seen TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  INDEX idx_room (room_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Game words: seed from frontend THEME_DATA (word = secret word, category = theme)
CREATE TABLE game_words (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  word VARCHAR(128) NOT NULL,
  category VARCHAR(64) NOT NULL,
  UNIQUE KEY uk_word_category (word, category),
  INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Messages: chat and vote messages
CREATE TABLE messages (
  id VARCHAR(36) PRIMARY KEY,
  room_id VARCHAR(36) NOT NULL,
  sender_id VARCHAR(36) NOT NULL,
  sender_name VARCHAR(64) NOT NULL,
  sender_color VARCHAR(20) NOT NULL DEFAULT '#9c27b0',
  text TEXT NOT NULL,
  type ENUM('chat', 'vote') NOT NULL DEFAULT 'chat',
  timestamp BIGINT UNSIGNED NOT NULL,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  INDEX idx_room (room_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed game_words from THEME_DATA (Animals, Technology, Food, Movies, Sports, Geography)
INSERT INTO game_words (word, category) VALUES
('Lion', 'Animals'),
('Elephant', 'Animals'),
('Tiger', 'Animals'),
('Bear', 'Animals'),
('Monkey', 'Animals'),
('Giraffe', 'Animals'),
('Computer', 'Technology'),
('Phone', 'Technology'),
('Robot', 'Technology'),
('Internet', 'Technology'),
('Software', 'Technology'),
('Pizza', 'Food'),
('Burger', 'Food'),
('Pasta', 'Food'),
('Salad', 'Food'),
('Sushi', 'Food'),
('Taco', 'Food'),
('Action', 'Movies'),
('Comedy', 'Movies'),
('Drama', 'Movies'),
('Horror', 'Movies'),
('Sci-Fi', 'Movies'),
('Football', 'Sports'),
('Basketball', 'Sports'),
('Tennis', 'Sports'),
('Golf', 'Sports'),
('Soccer', 'Sports'),
('Mountain', 'Geography'),
('River', 'Geography'),
('Ocean', 'Geography'),
('Desert', 'Geography'),
('Island', 'Geography');
