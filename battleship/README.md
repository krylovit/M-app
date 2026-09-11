# 🚢 Battleship Game

A full-featured browser-based Battleship game built with vanilla HTML, CSS, and JavaScript.

## 🎮 Features

- **10x10 grids** for both player and computer
- **5 ship types**: Carrier (5), Battleship (4), Cruiser (3), Submarine (3), Destroyer (2)
- **Manual ship placement** with drag & drop preview and rotation
- **Smart AI opponent** with hunt and target algorithms
- **Visual feedback** with hit/miss animations and effects
- **Responsive design** that works on desktop and mobile
- **Navy blue and sea green theme** with smooth animations

## 🎯 How to Play

1. **Ship Placement Phase**:
   - Select a ship from the list on the left
   - Click on your grid to place it
   - Use the "Rotate" button to change orientation
   - Use "Random" for automatic placement
   - Click "Start Battle" when all ships are placed

2. **Battle Phase**:
   - Click on enemy waters (right grid) to attack
   - Red cells indicate hits, blue cells indicate misses
   - Destroy all enemy ships to win!

## 🏗️ Project Structure

```
📁 battleship-game/
├── index.html          # Main HTML file
├── css/
│   └── styles.css      # All game styles and animations
├── js/
│   ├── game.js         # Core game logic and mechanics
│   └── ai.js           # Computer opponent AI
└── assets/
    ├── ships/          # Ship images (placeholder)
    └── icons/          # Hit/miss markers (placeholder)
```

## 🚀 Getting Started

1. Open `index.html` in any modern web browser
2. No installation or build process required!
3. Works offline - no internet connection needed

## 🎨 Customization

- **Colors**: Edit CSS variables in `styles.css`
- **Ship Images**: Add PNG/SVG files to `assets/ships/`
- **Sound Effects**: Add audio files and update JavaScript
- **AI Difficulty**: Modify algorithms in `ai.js`

## 🔧 Technical Details

- **Pure vanilla JavaScript** - no frameworks or dependencies
- **Modular code structure** with separate game logic and AI
- **CSS Grid** for responsive game boards
- **CSS animations** for smooth visual effects
- **Mobile-friendly** responsive design

## 🎯 Game Rules

- Ships cannot touch each other (including diagonally)
- Players alternate turns after a miss
- Consecutive shots allowed after hits
- First to sink all enemy ships wins

Enjoy your naval battle! ⚓
