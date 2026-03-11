# Impostor Party Hub — PHP API (Backend)

Backend for the Impostor Party Hub game. PHP 7.4+ with PDO and MySQL.

## Contents

| File | Purpose |
|------|--------|
| `db.php` | Database connection (PDO), CORS headers |
| `create_or_join.php` | Create room (host) or join by code (guest) |
| `start_game.php` | Start game: theme picker, impostors |
| `get_state.php` | Polling endpoint: full room state + bot logic |
| `submit_action.php` | Theme/word/association/vote/chat/fill_bots/next_round |
| `theme_data.php` | Theme → word → associations (for bots) |

## Setup (e.g. XAMPP)

1. **Database**  
   In phpMyAdmin, import `../database.sql` (same repo: file `database.sql` in the Impostors folder). It creates the `impostor_party_hub` database and tables.

2. **API**  
   Copy this `api` folder into your web server’s document root so the API is served at `/api/`:
   - **XAMPP:** copy to `C:\xampp\htdocs\api\`  
   - The frontend expects requests to `{origin}/api/` (e.g. `http://localhost/api/`).

3. **Config**  
   In `db.php` adjust `$host`, `$dbname`, `$user`, `$pass` if needed (default: `localhost`, `impostor_party_hub`, `root`, no password).

## Frontend

The React app is in the parent folder (`src/`, etc.). It calls this API and polls `get_state.php` every 1.5s.
