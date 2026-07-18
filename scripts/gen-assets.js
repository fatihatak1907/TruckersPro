/* One-off branding asset generator. Run:
 *   npm install sharp --no-save --legacy-peer-deps
 *   node scripts/gen-assets.js
 */
const sharp = require('sharp');
const path = require('path');
const SRC = path.join(__dirname, '..', 'logo.png');
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

  // Monochrome: white shape on transparent — luminance-based alpha mask.
  // Light-background logos need the mask inverted (dark art = opaque);
  // dark-background logos use luminance directly (bright art = opaque).
  const bgIsDark = (bg.r + bg.g + bg.b) / 3 < 128;
  let maskPipeline = sharp(SRC).resize(1024, 1024).greyscale();
  if (!bgIsDark) maskPipeline = maskPipeline.negate();
  const mask = await maskPipeline.toBuffer();
  await sharp({ create: { width: 1024, height: 1024, channels: 3, background: { r: 255, g: 255, b: 255 } } })
    .joinChannel(mask).png().toFile(A('android-icon-monochrome.png'));

  // Splash icon: logo at 1024, own background
  await sharp(SRC).resize(1024, 1024).png().toFile(A('splash-icon.png'));

  // Feature graphic 1024x500: logo centered on sampled bg (the logo carries its own wordmark)
  const logoSmall = await sharp(SRC).resize(460, 460).png().toBuffer();
  await sharp({ create: { width: 1024, height: 500, channels: 4, background: { ...bg, alpha: 1 } } })
    .composite([{ input: logoSmall, gravity: 'center' }])
    .png().toFile(path.join(__dirname, '..', 'store', 'feature-graphic.png'));
}
main().catch((e) => { console.error(e); process.exit(1); });
