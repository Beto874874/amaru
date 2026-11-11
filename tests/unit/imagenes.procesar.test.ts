import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { procesarImagen } from '../../src/modules/imagenes/procesar.js';

async function pngDeAncho(ancho: number, alto: number): Promise<Buffer> {
  return sharp({
    create: { width: ancho, height: alto, channels: 3, background: { r: 20, g: 120, b: 200 } },
  })
    .png()
    .toBuffer();
}

describe('procesarImagen', () => {
  it('re-codifica a WebP y limita el ancho de la grande y de la miniatura', async () => {
    const resultado = await procesarImagen(await pngDeAncho(2000, 1000));

    expect(resultado.ancho).toBe(1600);
    expect(resultado.alto).toBe(800);
    expect(resultado.bytes).toBe(resultado.grande.byteLength);

    const grande = await sharp(resultado.grande).metadata();
    const miniatura = await sharp(resultado.miniatura).metadata();

    expect(grande.format).toBe('webp');
    expect(grande.width).toBe(1600);
    expect(miniatura.format).toBe('webp');
    expect(miniatura.width).toBe(480);
  });

  it('no agranda una imagen mas pequena que el limite', async () => {
    const resultado = await procesarImagen(await pngDeAncho(300, 200));

    expect(resultado.ancho).toBe(300);
    expect((await sharp(resultado.miniatura).metadata()).width).toBe(300);
  });

  it('rechaza bytes que no son una imagen con IMAGEN_INVALIDA', async () => {
    await expect(procesarImagen(Buffer.from('esto no es una imagen'))).rejects.toMatchObject({
      statusCode: 400,
      code: 'IMAGEN_INVALIDA',
    });
  });

  it('rechaza formatos no permitidos aunque sharp los entienda (GIF)', async () => {
    const gif = await sharp({
      create: { width: 20, height: 20, channels: 3, background: { r: 255, g: 0, b: 0 } },
    })
      .gif()
      .toBuffer();

    await expect(procesarImagen(gif)).rejects.toMatchObject({
      statusCode: 400,
      code: 'IMAGEN_INVALIDA',
    });
  });
});
