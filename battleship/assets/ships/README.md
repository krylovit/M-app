# Ship Assets

This folder contains ship images or styled representations.

Currently, ships are rendered using CSS styling in the main stylesheet.
You can add PNG/SVG ship images here and update the CSS to use them:

- carrier.png (5 cells)
- battleship.png (4 cells)  
- cruiser.png (3 cells)
- submarine.png (3 cells)
- destroyer.png (2 cells)

Example CSS update:
```css
.cell.ship.carrier {
    background-image: url('../assets/ships/carrier.png');
    background-size: cover;
}
```
