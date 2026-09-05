// Generates the MSDF atlas the WebGL clock samples. The clock only ever shows
// digits and a colon, so the atlas stays tiny — regenerate with `npm run atlas`
// whenever the display face changes.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import generateBMFont from "msdf-bmfont-xml";

const here = dirname(fileURLToPath(import.meta.url));
const FONT = resolve(here, "../../public/fonts/Tektur-Variable.ttf");
const OUT_DIR = resolve(here, "../public/atlas");
const CHARSET = "0123456789:";

const options = {
  outputType: "json",
  charset: CHARSET,
  fontSize: 96,
  textureSize: [512, 256],
  distanceRange: 6,
  fieldType: "msdf",
  smartSize: true,
  pot: true,
};

const [textures, font] = await new Promise((ok, fail) => {
  generateBMFont(FONT, options, (error, textures, font) =>
    error ? fail(error) : ok([textures, font]),
  );
});

await mkdir(OUT_DIR, { recursive: true });
for (const texture of textures) {
  await writeFile(resolve(OUT_DIR, "clock.png"), texture.texture);
}
await writeFile(resolve(OUT_DIR, "clock.json"), font.data);

const parsed = JSON.parse(font.data);
console.log(
  `atlas: ${parsed.chars.length} glyphs, ${parsed.common.scaleW}x${parsed.common.scaleH}, ` +
    `lineHeight ${parsed.common.lineHeight}`,
);
