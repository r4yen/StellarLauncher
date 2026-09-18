// Run after `tauri icon src/assets/logo.svg -o <temporary-directory>`.
// Playwright is only needed to regenerate installer bitmaps, not to build the app.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const logo = readFileSync(new URL("../src/assets/logo.svg", import.meta.url), "utf8");
const image = `data:image/svg+xml;base64,${Buffer.from(logo).toString("base64")}`;
const images = {
  "installer-header": {width:150,height:57,body:`<rect width="150" height="57" rx="0" fill="#080f20"/><image href="${image}" x="8" y="8" width="41" height="41"/><text x="58" y="27" font-family="Arial,sans-serif" font-size="12" font-weight="bold" fill="#edfaff">STELLAR</text><text x="58" y="41" font-family="Arial,sans-serif" font-size="8" letter-spacing="1.6" fill="#83a3c4">LAUNCHER</text>`},
  "installer-sidebar": {width:164,height:314,body:`<defs><linearGradient id="bg" x2=".8" y2="1"><stop stop-color="#102443"/><stop offset="1" stop-color="#080d1c"/></linearGradient></defs><rect width="164" height="314" fill="url(#bg)"/><path d="M-70 194 218 46M-65 228 223 80M-60 262 228 114" stroke="#50d9ff" stroke-opacity=".09" stroke-width="1"/><circle cx="123" cy="34" r="2" fill="#56dcff"/><circle cx="32" cy="170" r="1.5" fill="#8c7bff"/><image href="${image}" x="26" y="61" width="112" height="112"/><text x="82" y="223" text-anchor="middle" font-family="Arial,sans-serif" font-size="22" font-weight="bold" letter-spacing="1" fill="#edfaff">STELLAR</text><text x="82" y="244" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" letter-spacing="4" fill="#8ba8c7">LAUNCHER</text><path d="M56 275h52" stroke="#42d7ff" stroke-width="2"/>`}
};
images["installer-header"].body = images["installer-header"].body.replace(/<text[\s\S]*$/, '<text x="55" y="33" font-family="Arial,sans-serif" font-size="11" font-weight="bold" fill="#edfaff">StellarLauncher</text>');
images["installer-sidebar"].body = images["installer-sidebar"].body.replace(/<text[\s\S]*$/, '<text x="82" y="232" text-anchor="middle" font-family="Arial,sans-serif" font-size="17" font-weight="bold" fill="#edfaff">StellarLauncher</text><path d="M56 275h52" stroke="#42d7ff" stroke-width="2"/>');
const browser = await chromium.launch({channel:"msedge",headless:true});
try {
  const page=await browser.newPage();
  for(const [name,{width,height,body}] of Object.entries(images)){
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;
    writeFileSync(new URL(`../src-tauri/icons/${name}.svg`,import.meta.url),svg);
    const pixels=await page.evaluate(async({svg,width,height})=>{const img=new Image();img.src='data:image/svg+xml;base64,'+btoa(svg);await img.decode();const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);return {rgba:Array.from(ctx.getImageData(0,0,width,height).data),png:canvas.toDataURL('image/png').split(',')[1]};},{svg,width,height});
    const stride=Math.ceil(width*3/4)*4,bmp=Buffer.alloc(54+stride*height);bmp.write('BM');bmp.writeUInt32LE(bmp.length,2);bmp.writeUInt32LE(54,10);bmp.writeUInt32LE(40,14);bmp.writeInt32LE(width,18);bmp.writeInt32LE(height,22);bmp.writeUInt16LE(1,26);bmp.writeUInt16LE(24,28);bmp.writeUInt32LE(stride*height,34);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){const src=(y*width+x)*4,dst=54+(height-1-y)*stride+x*3;bmp[dst]=pixels.rgba[src+2];bmp[dst+1]=pixels.rgba[src+1];bmp[dst+2]=pixels.rgba[src];}
    writeFileSync(new URL(`../src-tauri/icons/${name}.bmp`,import.meta.url),bmp);
    if(process.env.BRANDING_PREVIEW_DIR){mkdirSync(process.env.BRANDING_PREVIEW_DIR,{recursive:true});writeFileSync(`${process.env.BRANDING_PREVIEW_DIR}/${name}.png`,Buffer.from(pixels.png,'base64'));}
  }
} finally {await browser.close();}
