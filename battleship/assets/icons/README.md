# Icon Assets

This folder contains hit/miss markers and other game icons.

Currently, icons are rendered using CSS and emoji in the main stylesheet.
You can add custom icon images here:

- explosion.png (for hits)
- splash.png (for misses)
- crosshair.png (for targeting)
- sunk.png (for destroyed ships)

## PWA Icons (for mobile installation)
- icon-32.png (32x32 favicon)
- icon-180.png (180x180 Apple touch icon)
- icon-192.png (192x192 PWA icon)
- icon-512.png (512x512 PWA icon)

Example CSS update:
```css
.cell.hit::after {
    content: '';
    background-image: url('../assets/icons/explosion.png');
    background-size: contain;
    width: 100%;
    height: 100%;
}
```

To create PWA icons, you can use any 512x512 battleship-themed image and resize it to the required dimensions.
