# HTML Dungeon Crawl

A procedural HTML5 roguelite dungeon crawler featuring potions, fog of war, and turn-based combat.  
Built entirely with vanilla JavaScript, HTML5 Canvas, and CSS3 — no frameworks or external libraries required.

<p align="center">
  <img src="https://github.com/ericmaddox/html-dungeon-crawl/blob/main/media/html_dungeon_crawl_1.png?raw=true" 
       alt="HTML Dungeon Crawl Screenshot" 
       width="720" 
       style="border-radius:12px; box-shadow:0 0 10px rgba(0,0,0,0.3);" />
</p>

<p align="center">
  <em>In a realm of ever-changing halls and forgotten tombs, the brave who descend must battle through darkness and scarcity. Conquer the depths of <strong>HTML Dungeon Crawl</strong>.</em>
</p>


## Overview

**HTML Dungeon Crawl** is a browser-based dungeon crawler that generates a new maze on every playthrough.  
Players explore procedurally generated dungeons, fight enemies, open treasure chests, and manage limited potions to survive and descend deeper.

This expanded version introduces a **potion system**, **enhanced HUD**, and **larger dungeon layouts** for greater tactical depth and replayability.

---

## Features

- **Procedurally Generated Dungeons** using a recursive backtracking algorithm  
- **Turn-Based Combat** with melee and ranged enemies  
- **Potion System** for healing and inventory management  
- **Treasure Chests** containing randomized loot (HP, ATK, or potions)  
- **Fog of War** and **Minimap** for exploration realism  
- **Dynamic Dungeon Names** per level for variety  
- **Pixel-Art Rendering** through the HTML5 Canvas 2D API  
- **Responsive HUD and Layout** with CSS3  
- **No External Dependencies** — runs directly in any modern browser

---

## Controls

| Action | Input |
|--------|--------|
| Move | **WASD** or **Arrow Keys** |
| Use Potion | **P** key |
| Drink Potion (UI) | Click or tap a potion slot |
| Start Game | Click **Start** button |

---

## Technical Overview

- **Language:** JavaScript (ES6)  
- **Rendering:** HTML5 Canvas 2D API  
- **Styling:** CSS3 for responsive HUD and layout  
- **Structure:** Single-page game (`html_dungeon_crawl.html`)  
- **Game Loop:** Managed with `requestAnimationFrame()`  
- **Procedural Generation:** Recursive backtracking maze algorithm  
- **Fog of War:** Dynamic visibility based on player proximity  
- **No Build Process:** Runs locally without npm or bundlers

---

## Running the Game

Clone the repository and open `html_dungeon_crawl.html` directly in your browser:

```bash
git clone https://github.com/ericmaddox/html-dungeon-crawl.git
cd html-dungeon-crawl
open html_dungeon_crawl.html
