/* One-off branding asset generator. Run:
 *   npm install sharp --no-save --legacy-peer-deps
 *   node scripts/gen-assets.js
 */
const sharp = require('sharp');
const path = require('path');
const SRC = path.join(__dirname, '..', 'Logo.jpeg');
const A = (f) => path.join(__dirname, '..', 'assets', f);

async function main() {
  // Sample the top-left corner for the baked background color
  const { data } = await sharp(SRC).extract({ left: 8, top: 8, width: 16, height: 16 })
    .resize(1, 1).raw().toBuffer({ resolveWithObject: true });
  const bg = { r: data[0], g: data[1], b: data[2] };
  const hex = '#' + [bg.r, bg.g, bg.b].map((v) => v.toString(16).padStart(2, '0')).join('');
  console.log('sampled background:', hex);

  // 1024 app icon (square source, straight resize)
  await sharp(SRC).resize(1024, 1024).png().toFile(A('icon.png'));

  // Adaptive foreground: logo scaled to 66% safe zone, centered on the sampled bg
  const inner = await sharp(SRC).resize(676, 676).png().toBuffer();
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { ...bg, alpha: 1 } } })
    .composite([{ input: inner, gravity: 'center' }]).png().toFile(A('android-icon-foreground.png'));

  // Adaptive background: solid sampled color
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { ...bg, alpha: 1 } } })
    .png().toFile(A('android-icon-background.png'));

  // Monochrome: white shape on transparent — luminance-inverted alpha mask
  const mask = await sharp(SRC).resize(1024, 1024).greyscale().negate().toBuffer();
  await sharp({ create: { width: 1024, height: 1024, channels: 3, background: { r: 255, g: 255, b: 255 } } })
    .joinChannel(mask).png().toFile(A('android-icon-monochrome.png'));

  // Splash icon: logo at 1024, own background
  await sharp(SRC).resize(1024, 1024).png().toFile(A('splash-icon.png'));

  // Feature graphic 1024x500: logo left, wordmark right, on sampled bg
  const logoSmall = await sharp(SRC).resize(420, 420).png().toBuffer();
  const text = Buffer.from(`<svg width="1024" height="500">
    <text x="470" y="240" font-family="Arial, Helvetica, sans-serif" font-size="86" font-weight="800" fill="#1c1d22">TruckersPro</text>
    <text x="472" y="300" font-family="Arial, Helvetica, sans-serif" font-size="34" fill="#4a4d55">Know your real profit, every week</text>
  </svg>`);
  await sharp({ create: { width: 1024, height: 500, channels: 4, background: { ...bg, alpha: 1 } } })
    .composite([{ input: logoSmall, left: 30, top: 40 }, { input: text, left: 0, top: 0 }])
    .png().toFile(path.join(__dirname, '..', 'store', 'feature-graphic.png'));
}
main().catch((e) => { console.error(e); process.exit(1); });
