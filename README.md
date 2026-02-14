# Padel Scoreboard

A professional padel/tennis scoreboard application built with Next.js and Tailwind CSS, designed for OBS broadcasting.

## Features

- **Padel Doubles Scoring**: Full support for doubles matches with 2 players per team
- **Configurable Match Format**: Set best-of-N sets (3, 5, etc.)
- **Customizable Teams**: Configure team names, player names, and team colors (hex codes)
- **Serving Indicator**: Track which team and player is serving
- **Two View Modes**:
  - **Standard View**: Full-featured scoreboard with detailed information
  - **Compact View**: Broadcast-style vertical layout optimized for OBS overlays
- **Complete Scoring Logic**: Tennis-style point progression (0, 15, 30, 40, Ad, Game)
- **Set & Match Tracking**: Automatic set and match win detection
- **Undo Functionality**: Step back through scoring history
- **OBS Ready**: Designed to be cropped and used as a browser source in OBS

## Getting Started

### Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Deployment

This app is ready to deploy to Vercel (free tier available):

1. Push your code to GitHub
2. Import your repository on [Vercel](https://vercel.com)
3. Deploy with zero configuration

See deployment instructions below for detailed steps.

## Usage

1. **Configure Match**: Set best-of-N sets, games per set, and tie-break rules
2. **Set Teams**: Enter team names, player names, and team colors
3. **Start Scoring**: Use "Point Team A" / "Point Team B" buttons to score
4. **Toggle Compact View**: Switch to compact view for OBS broadcasting
5. **OBS Setup**: Add as Browser Source and crop to show only the scoreboard area

## Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS 4
