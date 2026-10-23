import sharp from 'sharp';
import {PDFParse} from 'pdf-parse';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {Slide} from '../contracts.ts';

const escape=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
function lines(text:string,width:number,max:number):string[]{const result:string[]=[];let line='';for(const word of text.split(/\s+/)){if((line+' '+word).length>width&&line){result.push(line);line=word;}else line+=(line?' ':'')+word;}if(line)result.push(line);if(result.length>max)throw Object.assign(new Error('Texto excede o espaço do slide; reduza antes de exportar.'),{statusCode:422});return result;}
export async function renderSlide(slide:Slide,color:string,index=0,image?:Buffer):Promise<Buffer>{
 const accent=/^#[0-9a-f]{6}$/i.test(color)?color:'#8057f5';
 const title=lines(slide.title,27,5),body=lines(slide.body,49,13);
 let photo='';if(image){const safe=await sharp(image,{limitInputPixels:20_000_000}).resize(920,380,{fit:'cover'}).png().toBuffer();photo=`<image href="data:image/png;base64,${safe.toString('base64')}" x="80" y="840" width="920" height="380"/>`;if(body.length>7)throw Object.assign(new Error('Reduza o texto a 7 linhas para usar imagem neste layout.'),{statusCode:422});}
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350"><rect width="1080" height="1350" fill="#131723"/><rect x="80" y="86" width="92" height="12" rx="6" fill="${accent}"/><text x="80" y="210" fill="#ffffff" font-family="sans-serif" font-weight="bold" font-size="62">${title.map((v,i)=>`<tspan x="80" dy="${i?76:0}">${escape(v)}</tspan>`).join('')}</text><text x="80" y="${250+title.length*76}" fill="#d8deeb" font-family="sans-serif" font-size="34">${body.map((v,i)=>`<tspan x="80" dy="${i?49:0}">${escape(v)}</tspan>`).join('')}</text>${photo}<text x="1000" y="1290" fill="${accent}" text-anchor="end" font-size="28" font-family="sans-serif">${index+1}</text></svg>`;
 return sharp(Buffer.from(svg)).png().toBuffer();
}
export async function extractPdf(bytes:Buffer):Promise<string>{if(bytes.length>20_000_000)throw new Error('PDF excede 20 MB.');const parser=new PDFParse({data:bytes});try {const result=await parser.getText();const text=result.text.trim().slice(0,100_000);if(text.length<20)throw new Error('PDF sem texto extraível; envie transcrição.');return text;}finally{await parser.destroy();}}
async function command(args:string[],timeoutMs=120_000):Promise<void>{return new Promise((resolve,reject)=>{const proc=spawn('ffmpeg',args,{windowsHide:true,stdio:'ignore'});const timer=setTimeout(()=>{proc.kill();reject(new Error('Renderização excedeu o tempo limite.'));},timeoutMs);proc.once('error',e=>{clearTimeout(timer);reject(e);});proc.once('close',code=>{clearTimeout(timer);code===0?resolve():reject(new Error('FFmpeg não concluiu a renderização.'));});});}
export async function videoCapability():Promise<boolean>{try {await command(['-version'],4_000);return true;}catch{return false;}}
export async function renderVideo(slides:Slide[],durations:number[],color:string):Promise<Buffer>{
 if(!slides.length||slides.length>12||durations.length!==slides.length||durations.some(d=>!Number.isFinite(d)||d<2||d>15))throw Object.assign(new Error('Vídeo exige 1–12 cenas com duração de 2–15 segundos.'),{statusCode:422});
 if(!await videoCapability())throw Object.assign(new Error('FFmpeg indisponível no servidor; instale para renderizar vídeo.'),{statusCode:503});
 const folder=await mkdtemp(join(tmpdir(),'socialengine-video-'));try {
  for(let i=0;i<slides.length;i++)await writeFile(join(folder,`slide-${i}.png`),await renderSlide(slides[i],color,i));
  const sequence=slides.map((_s,i)=>`file 'slide-${i}.png'\nduration ${durations[i]}\n`).join('')+`file 'slide-${slides.length-1}.png'\n`;
  await writeFile(join(folder,'input.txt'),sequence);
  await command(['-y','-f','concat','-safe','1','-i',join(folder,'input.txt'),'-vf','scale=1080:1350,setsar=1','-c:v','libx264','-pix_fmt','yuv420p','-r','30','-movflags','+faststart',join(folder,'output.mp4')]);
  return await readFile(join(folder,'output.mp4'));
 }finally{await rm(folder,{recursive:true,force:true});}
}
