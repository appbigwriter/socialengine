export const CHARACTER_KIT_LIMIT=50000;
export interface CharacterKit {text:string;filename?:string}
export interface PersonaFields {name?:string;niche?:string;audience?:string;objectives?:string;timezone?:string;brand?:{color?:string;voice?:string};blog?:{language?:string}}
const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const plain=(s:string)=>s.replace(/\*\*|__/g,'').replace(/^>\s?/gm,'').trim();

/** Reads declared persona fields; document text is data, never executable instructions. */
export function parseCharacterKit(raw:string):{fields:PersonaFields;detected:string[]}{
  const text=raw.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').trim();
  if(!text)throw new Error('Adicione o texto do Character Kit.');
  if(text.length>CHARACTER_KIT_LIMIT)throw new Error('O Character Kit deve ter até 50.000 caracteres.');
  const values=new Map<string,string>();
  let section:string|undefined;
  for(const line of text.split('\n')){
    const heading=line.match(/^#{1,6}\s+(.*)/);
    if(heading){section=normalize(plain(heading[1]).replace(/^\d+[.\s]+/,''));if(!values.has(section))values.set(section,'');continue;}
    const pair=plain(line).replace(/^[-*]\s+/,'').match(/^([^:\n]{2,65}):\s*(.+)$/);
    if(pair&&!values.has(normalize(pair[1])))values.set(normalize(pair[1]),plain(pair[2]));
    if(section)values.set(section,[values.get(section),line].filter(Boolean).join('\n').trim());
  }
  const pick=(keys:string[],max:number)=>{for(const key of keys){const v=values.get(key);if(v?.trim())return plain(v).slice(0,max);}return undefined;};
  const fields:PersonaFields={};
  fields.name=pick(['name','nome','nome do influenciador','nome da persona'],100);
  if(!fields.name){const title=text.match(/^#\s+(.+?)\s*(?:[—–|]\s*)?(?:character (?:bible|kit)|biblia d[ao] persona)/im);if(title)fields.name=plain(title[1]).replace(/[—–|\s]+$/,'').slice(0,100);}
  fields.niche=pick(['niche','nicho','nicho principal','public positioning','posicionamento publico','posicionamento','editorial focus'],250);
  fields.audience=pick(['audience','publico','publico alvo','target audience'],2000);
  fields.objectives=pick(['objectives','objetivos','primary promise','promessa principal','mission','missao'],2000);
  const voice=pick(['tom de voz','tone of voice','voice formula','formula de voz','voice','voz'],2000);
  const palette=pick(['cor da marca','brand color','color','cor','paleta','palette'],250)?.match(/#[a-f0-9]{6}\b/i)?.[0];
  if(voice||palette)fields.brand={...(voice?{voice}:{}),...(palette?{color:palette}:{})};
  const zone=pick(['timezone','fuso horario'],100);if(zone){try{new Intl.DateTimeFormat('pt-BR',{timeZone:zone});fields.timezone=zone;}catch{/* Keep the current timezone when the document does not declare a valid one. */}}
  const language=pick(['language','idioma','publishing language'],20);if(language&&/^[a-z]{2,3}(?:-[a-z]{2,4})?$/i.test(language))fields.blog={language};
  for(const key of Object.keys(fields) as (keyof PersonaFields)[])if(fields[key]===undefined)delete fields[key];
  return {fields,detected:Object.keys(fields)};
}
