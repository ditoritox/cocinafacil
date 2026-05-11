'use strict';

const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT_DIR = path.join(__dirname, 'icons');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
          let c = n;
          for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
          t[n] = c;
    }
    return t;
})();

function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
    const typeBytes = Buffer.from(type, 'ascii');
    const lenBuf    = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length);
    const crcInput = Buffer.concat([typeBytes, data]);
    const crcBuf   = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(crcInput));
    return Buffer.concat([lenBuf, typeBytes, data, crcBuf]);
}

function drawIcon(size) {
    const pixels = new Uint8Array(size * size * 4);
    const cx = size / 2, cy = size / 2, r = size / 2 - 0.5;

  for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
                const idx = (y * size + x) * 4;
                const dx = x - cx + 0.5, dy = y - cy + 0.5;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > r) { pixels[idx + 3] = 0; continue; }
                const t = dist / r;
                pixels[idx]     = Math.round(0x22 + t * (0x15 - 0x22));
                pixels[idx + 1] = Math.round(0xc5 + t * (0x80 - 0xc5));
                pixels[idx + 2] = Math.round(0x5e + t * (0x3d - 0x5e));
                pixels[idx + 3] = dist > r - 1 ? Math.round(255 * (r - dist)) : 255;
        }
  }

  const panW = Math.round(size * 0.44), panH = Math.round(size * 0.34);
    const panX = Math.round(cx - panW / 2 + size * 0.04), panY = Math.round(cy - panH / 2 + size * 0.05);
    for (let y = panY; y < panY + panH; y++) {
          for (let x = panX; x < panX + panW; x++) {
                  const ex = (x-(panX+panW/2))/(panW/2), ey = (y-(panY+panH/2))/(panH/2);
                  if (ex*ex+ey*ey <= 1) {
                            const idx = (y*size+x)*4;
                            if (pixels[idx+3]>0) { pixels[idx]=255; pixels[idx+1]=255; pixels[idx+2]=255; pixels[idx+3]=240; }
                  }
          }
    }

  const hLen=Math.round(size*0.28), hThick=Math.round(size*0.08);
    const hX=panX-hLen, hY=Math.round(cy-hThick/2+size*0.03);
    for (let y=hY; y<hY+hThick; y++) {
          for (let x=hX; x<panX+Math.round(size*0.02); x++) {
                  if (x>=0&&x<size&&y>=0&&y<size) {
                            const idx=(y*size+x)*4;
                            if (pixels[idx+3]>0) { pixels[idx]=255; pixels[idx+1]=255; pixels[idx+2]=255; pixels[idx+3]=230; }
                  }
          }
    }

  const yR=Math.round(size*0.08), yCx=Math.round(panX+panW*0.55), yCy=Math.round(panY+panH*0.48);
    for (let y=yCy-yR; y<=yCy+yR; y++) {
          for (let x=yCx-yR; x<=yCx+yR; x++) {
                  if (x<0||x>=size||y<0||y>=size) continue;
                  const dx=x-yCx, dy=y-yCy;
                  if (dx*dx+dy*dy<=yR*yR) {
                            const idx=(y*size+x)*4;
                            pixels[idx]=0xf9; pixels[idx+1]=0xa8; pixels[idx+2]=0x0d; pixels[idx+3]=255;
                  }
          }
    }
    return pixels;
}

function encodePNG(size, pixels) {
    const sig = Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(size,0); ihdr.writeUInt32BE(size,4);
    ihdr[8]=8; ihdr[9]=6; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0;
    const raw = Buffer.alloc(size*(1+size*4));
    for (let y=0;y<size;y++) {
          raw[y*(1+size*4)]=0;
          for (let x=0;x<size;x++) {
                  const src=(y*size+x)*4, dst=y*(1+size*4)+1+x*4;
                  raw[dst]=pixels[src]; raw[dst+1]=pixels[src+1]; raw[dst+2]=pixels[src+2]; raw[dst+3]=pixels[src+3];
          }
    }
    return Buffer.concat([sig, pngChunk('IHDR',ihdr), pngChunk('IDAT',zlib.deflateSync(raw,{level:6})), pngChunk('IEND',Buffer.alloc(0))]);
}

[192,512].forEach((size) => {
    console.log(`Drawing ${size}x${size} icon...`);
    const png = encodePNG(size, drawIcon(size));
    const outPath = path.join(OUT_DIR, `icon-${size}.png`);
    fs.writeFileSync(outPath, png);
    console.log(`Saved ${outPath} (${Math.round(png.length/1024)} KB)`);
});
console.log('Icons generated!');
