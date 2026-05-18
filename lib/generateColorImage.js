const sharp = require('sharp');

async function generateColorImage(hexColor, width = 200, height = 120) {
  // Remove # from hex
  const color = hexColor.replace('#', '');
  
  // Create SVG with gradient for better visual appeal
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#${color};stop-opacity:1" />
          <stop offset="100%" style="stop-color:#${darkenHex(color, 15)};stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#grad)" rx="8" ry="8" />
    </svg>
  `;
  
  return sharp(Buffer.from(svg))
    .png()
    .toBuffer();
}

function darkenHex(hex, percent) {
  const num = parseInt(hex, 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, (num >> 16) - amt);
  const G = Math.max(0, (num >> 8 & 0x00FF) - amt);
  const B = Math.max(0, (num & 0x0000FF) - amt);
  return (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

const colorData = [
  { hexCode: "#708090", name: "Slate Gray" },
  { hexCode: "#36454F", name: "Charcoal" },
  { hexCode: "#003366", name: "Navy Blue" },
  { hexCode: "#4682B4", name: "Steel Blue" },
  { hexCode: "#008080", name: "Teal" },
  { hexCode: "#808000", name: "Olive" },
  { hexCode: "#D2B48C", name: "Warm Taupe" },
  { hexCode: "#A9A9A9", name: "Greige" },
  { hexCode: "#FF2B2B", name: "Real Red" },
  { hexCode: "#228B22", name: "Muted Forest Green" },
  { hexCode: "#FFD700", name: "Gold" },
  { hexCode: "#6A5ACD", name: "Slate Blue" },
];

module.exports = { generateColorImage, colorData }; 