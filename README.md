# Educational Games Hub

A growing collection of interactive educational games designed to help students learn concepts in a fun and engaging way. This project is designed to support chapter-based course content and is built for future expansion.

## Current Games

### 1. Matching Cards
Match terms with their correct definitions. Tracks score, moves, progress, and time.

### 2. Drag & Fill
Drag terms from a word bank into blanks in definitions. Features:
- Immediate feedback toggle
- Undo/redo support
- Scoring and timer
- Chapter selection

### 3. Hangman
Classic educational hangman:
- Difficulty levels
- Keyboard interaction (on-screen and physical)
- Visual progress (hangman SVG)
- Sound effects and scoring

## Features

- Modular architecture with Single Page Application (SPA) routing
- Chapter-based data loading via JSON
- Sound toggle for each game
- Responsive UI with modern design
- Built-in timer and score tracking
- Customizable and extensible structure for adding new games

## Getting Started

To run the project locally:

```bash
git clone https://github.com/YOUR_USERNAME/educational-games-hub.git
cd educational-games-hub
```

Then open `index.html` in your browser.

No server setup is required — the app runs entirely in the browser.  
(Note: You will need local JSON files in the `/data/` directory for full functionality.)

## Project Structure

```
.
├── index.html
├── matching-cards.html
├── drag-fill.html
├── hangman.html
├── scripts/
│   ├── spa-loader.js
│   ├── matching-cards.js
│   ├── drag-fill.js
│   └── hangman.js
├── styles/
│   ├── main.css
│   └── [component/game-specific styles]
├── assets/
│   └── sfx/
└── data/
    └── is451.json, etc.
```
## Customization & Expansion

- To add a new game, create a new HTML and JS file and register it in `spa-loader.js`.
- To load new chapter content, create structured JSON files and place them under the `/data/` directory.

## License

MIT License — you are free to use, modify, and distribute this project.

## About

This project is part of an educational initiative to make learning more interactive, especially for chapter-based academic content. It’s actively developed and intended to support additional games and learning features over time.

## Roadmap

- Add quiz-style games and sorting challenges
- Improve mobile accessibility
- Add persistent scoreboards and user tracking
- Deploy on GitHub Pages or LMS platforms
