import {useState} from 'react';
import {Check,ExternalLink,Plus,Search} from 'lucide-react';
import {discoveryDirectory} from '../../src/engine/discovery-directory';
import {sourceIdentity,trendSourceCatalog,type SuggestedTrendSource} from '../../src/engine/source-catalog';

const accessLabels={feed:'RSS verificado',api:'API · integração pendente',license:'Autorização comercial necessária',unavailable:'Coleta não validada',manual:'Consulta no site oficial'};
export function DiscoveryDirectory({urls,canAdd,busy,select}:{urls:string[];canAdd:boolean;busy:boolean;select:(source:SuggestedTrendSource)=>void}){
  const [query,setQuery]=useState(''),[group,setGroup]=useState('all');
  const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const groups=[...new Set(discoveryDirectory.map(provider=>provider.group))];
  const filtered=discoveryDirectory.filter(provider=>(group==='all'||group===provider.group)&&normalize([provider.name,provider.group,provider.description].join(' ')).includes(normalize(query.trim())));
  const installed=new Set(urls.map(sourceIdentity));
  return <>
    <p className="suggestion-category-note">Notícias dão contexto; comunidades mostram repercussão; ferramentas oferecem sinais ou ajudam na pesquisa. Somente as opções com RSS verificado podem ser adicionadas por aqui. As demais indicam a condição de acesso e não estão conectadas.</p>
    <div className="list-filters"><div className="search"><Search size={17}/><input aria-label="Buscar agência, rede ou ferramenta" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Reuters, Reddit, Google Trends…"/></div><select aria-label="Tipo de fonte de descoberta" value={group} onChange={event=>setGroup(event.target.value)}><option value="all">Todos os tipos</option>{groups.map(value=><option key={value}>{value}</option>)}</select></div>
    <p className="micro" role="status">{filtered.length} opção(ões) · acesso revisado em 23/10/2026 · RSS público não concede licença de reutilização</p>
    <div className="suggestion-grid">{filtered.map(provider=>{
      const source=provider.access==='feed'?trendSourceCatalog.find(value=>value.id===provider.sourceId):undefined;
      const added=source&&installed.has(sourceIdentity(source.url));
      return <article className="suggestion-card" key={provider.id}>
        <span className="badge">{provider.group}</span><h3>{provider.name}</h3><span className={`badge ${source?'success':'neutral'}`}>{accessLabels[provider.access]}</span>
        <p>{provider.description}</p><p className="micro">{provider.note}</p>
        <div className="discovery-links"><a href={provider.url} target="_blank" rel="noreferrer">Abrir site <ExternalLink size={12}/></a><a href={provider.referenceUrl} target="_blank" rel="noreferrer">Acesso e condições <ExternalLink size={12}/></a></div>
        {source&&<button className={added?'':'primary'} disabled={!canAdd||busy||added} aria-label={`${added?'Adicionada':'Adicionar'} ${provider.name}`} onClick={()=>select(source)}>{added?<Check size={15}/>:<Plus size={15}/>} {added?'Já adicionada':'Revisar e adicionar RSS'}</button>}
      </article>;
    })}</div>
    {!filtered.length&&<p className="muted">Nenhuma opção para essa busca. Experimente outro nome ou tipo de fonte.</p>}
    <p className="micro">Nenhuma consulta paga, conta externa ou assinatura é criada ao explorar este diretório. Licença, aprovação e implementação dos conectores pendentes precisam ser resolvidas antes da coleta automática.</p>
  </>;
}
