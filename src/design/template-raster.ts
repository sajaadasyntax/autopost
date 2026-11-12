import { existsSync } from 'fs';
import { join } from 'path';
import { Resvg } from '@resvg/resvg-js';

export function rasterizeSvg(svg: string): Buffer {
  const font = join(process.cwd(), 'assets', 'fonts', 'Cairo.ttf');
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1080 },
    font: {
      fontFiles: existsSync(font) ? [font] : [],
      loadSystemFonts: true,
      defaultFontFamily: 'Cairo',
    },
  });
  return Buffer.from(resvg.render().asPng());
}
