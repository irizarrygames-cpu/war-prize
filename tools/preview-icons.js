// Renders the app icon at the sizes a phone actually draws it, plus the maskable one
// cropped to a circle the way Android does. Run: node tools/preview-icons.js
//
// Worth having because an icon is always designed at 512 and always LOOKED AT at 48.
// The first version of the 7 read perfectly at full size and turned into a T further
// down. Writes store/icon-preview.png; nothing ships from here.
//
// Reads PNGs back with zlib and an un-filter pass -- same no-dependency rule as the
// rest of tools/.

const fs=require('fs'), zlib=require('zlib'), path=require('path');
function readPNG(file){
  const buf=fs.readFileSync(file);
  let p=8, w=0,h=0, idat=[];
  while(p<buf.length){
    const len=buf.readUInt32BE(p), type=buf.toString('ascii',p+4,p+8);
    if(type==='IHDR'){ w=buf.readUInt32BE(p+8); h=buf.readUInt32BE(p+12); }
    if(type==='IDAT') idat.push(buf.slice(p+8,p+8+len));
    p+=12+len;
  }
  const raw=zlib.inflateSync(Buffer.concat(idat));
  const stride=w*4+1, px=Buffer.alloc(w*h*4);
  let prev=Buffer.alloc(w*4);
  for(let y=0;y<h;y++){
    const f=raw[y*stride]; const line=raw.slice(y*stride+1,y*stride+1+w*4);
    const cur=Buffer.alloc(w*4);
    for(let i=0;i<w*4;i++){
      const a=i>=4?cur[i-4]:0, b=prev[i], c=i>=4?prev[i-4]:0; let v=line[i];
      if(f===1)v+=a; else if(f===2)v+=b; else if(f===3)v+=Math.floor((a+b)/2);
      else if(f===4){const pa=Math.abs(b-c),pb=Math.abs(a-c),pc=Math.abs(a+b-2*c);v+=(pa<=pb&&pa<=pc)?a:(pb<=pc?b:c);}
      cur[i]=v&255;
    }
    cur.copy(px,y*w*4); prev=cur;
  }
  return {w,h,px};
}
const CRC=(()=>{const t=new Int32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c;}return t;})();
function crc32(b){let c=0xffffffff;for(let i=0;i<b.length;i++)c=CRC[(c^b[i])&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function chunk(t,d){const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const b=Buffer.concat([Buffer.from(t,'ascii'),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc32(b));return Buffer.concat([l,b,c]);}
function writePNG(f,w,h,px){const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=6;
  const st=w*4+1, raw=Buffer.alloc(st*h);
  for(let y=0;y<h;y++){raw[y*st]=0;px.copy(raw,y*st+1,y*w*4,(y+1)*w*4);}
  fs.writeFileSync(f,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]));}

const src=readPNG(path.join(__dirname,'..','icon-512.png'));
const mask=readPNG(path.join(__dirname,'..','icon-maskable-512.png'));
function sample(img,size){
  const out=Buffer.alloc(size*size*4);
  const k=img.w/size;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    let r=0,g=0,b=0,n=0;
    for(let sy=Math.floor(y*k);sy<Math.floor((y+1)*k);sy++)
      for(let sx=Math.floor(x*k);sx<Math.floor((x+1)*k);sx++){
        const i=(sy*img.w+sx)*4; r+=img.px[i];g+=img.px[i+1];b+=img.px[i+2];n++;}
    const i=(y*size+x)*4;
    out[i]=Math.round(r/n);out[i+1]=Math.round(g/n);out[i+2]=Math.round(b/n);out[i+3]=255;
  }
  return out;
}
// a strip: 48, 72, 96, 128 of the normal icon, then the maskable one circle-cropped
const sizes=[48,72,96,128];
const W=640,H=150;
const canvas=Buffer.alloc(W*H*4);
for(let i=0;i<W*H;i++){canvas[i*4]=245;canvas[i*4+1]=245;canvas[i*4+2]=248;canvas[i*4+3]=255;}
let ox=12;
for(const s of sizes){
  const im=sample(src,s);
  const oy=Math.round((H-s)/2);
  for(let y=0;y<s;y++)for(let x=0;x<s;x++){
    const si=(y*s+x)*4, di=((oy+y)*W+(ox+x))*4;
    canvas[di]=im[si];canvas[di+1]=im[si+1];canvas[di+2]=im[si+2];
  }
  ox+=s+14;
}
// maskable, cropped to a circle the way Android does
const ms=128, mi=sample(mask,ms), oy=Math.round((H-ms)/2);
for(let y=0;y<ms;y++)for(let x=0;x<ms;x++){
  const dx=x-ms/2, dy=y-ms/2;
  if(dx*dx+dy*dy > (ms/2)*(ms/2)) continue;
  const si=(y*ms+x)*4, di=((oy+y)*W+(ox+x))*4;
  canvas[di]=mi[si];canvas[di+1]=mi[si+1];canvas[di+2]=mi[si+2];
}
writePNG(path.join(__dirname,'..','store','icon-preview.png'),W,H,canvas);
console.log('wrote store/icon-preview.png  (48, 72, 96, 128 + maskable circle-cropped)');
