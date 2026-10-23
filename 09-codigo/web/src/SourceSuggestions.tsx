import {useState} from 'react';
import {Check,ExternalLink,Plus,Search} from 'lucide-react';
import {trendSourceCatalog,sourceIdentity,type SuggestedTrendSource} from '../../src/engine/source-catalog';

export function SourceSuggestions({urls,canAdd,busy,select}:{urls:string[];canAdd:boolean;busy:boolean;select:(source:SuggestedTrendSource)=>void}){
  const [search,setSearch]=useState(''),[category,setCategory]=useState('all'),[limit,setLimit]=useState(9);
  const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const categories=[...new Set(trendSourceCatalog.map(source=>source.category))];
  const filtered=trendSourceCatalog.filter(source=>(category==='all'||source.category===category)&&normalize([source.name,source.description,source.category,...source.keywords].join(' ')).includes(normalize(search.trim())));
  const installed=new Set(urls.map(sourceIdentity));
  return <section className="panel source-suggestions" aria-label="Fontes sugeridas">
    <div className="section-heading"><div><span className="eyebrow">AMPLIE SEU RADAR</span><h2>Fontes sugeridas em inglês</h2><p>{trendSourceCatalog.length} feeds selecionados · escolha as origens que fazem sentido para o seu nicho.</p></div><span className="badge success">RSS / Atom</span></div>
    <p className="muted">Notícias, pesquisas e novidades para descobrir pautas. Cada influenciador escolhe suas fontes e palavras-chave; nada é ativado automaticamente. A frequência de publicação varia por editor.</p>
    <div className="list-filters"><div className="search"><Search size={17}/><input aria-label="Buscar fontes sugeridas" placeholder="Busque IA, saúde, creators…" value={search} onChange={e=>{setSearch(e.target.value);setLimit(9);}}/></div><select aria-label="Categoria das fontes sugeridas" value={category} onChange={e=>{setCategory(e.target.value);setLimit(9);}}><option value="all">Todos os temas</option>{categories.map(value=><option key={value}>{value}</option>)}</select></div>
    <p className="micro" role="status">{filtered.length} fonte(s) encontrada(s) · {installed.size} endereço(s) já monitorado(s) neste espaço</p>
    <div className="suggestion-grid">{filtered.slice(0,limit).map(source=>{
      const added=installed.has(sourceIdentity(source.url));return <article className="suggestion-card" key={source.id}>
        <div className="suggestion-meta"><span className="badge">{source.category}</span><span className="micro">EN · Global</span></div>
        <h3>{source.name}</h3><p>{source.description}</p><small className="wrap muted">{new URL(source.url).hostname}</small>
        <details><summary>Condições de uso</summary><p className="micro">{source.accessNote}</p><a href={source.referenceUrl} target="_blank" rel="noreferrer">Consultar editor <ExternalLink size={12}/></a></details>
        {source.publisher==='BBC'&&<span className="micro warning-text">Uso comercial exige permissão da BBC.</span>}
        <button className={added?'':'primary'} disabled={!canAdd||busy||added} onClick={()=>select(source)} aria-label={`${added?'Adicionada':'Adicionar'} ${source.name}`}>{added?<Check size={15}/>:<Plus size={15}/>} {added?'Já adicionada':'Adicionar fonte'}</button>
      </article>;
    })}</div>
    {!filtered.length&&<p className="muted">Nenhuma sugestão para essa busca. Experimente outro termo ou adicione seu próprio feed em “Monitorar fonte”.</p>}
    {limit<filtered.length&&<button className="suggestion-more" onClick={()=>setLimit(value=>value+9)}>Mostrar mais fontes ({filtered.length-limit})</button>}
    <p className="micro">Até 30 fontes por influenciador. O catálogo não concede licença de republicação. Confira as condições do editor antes de ativar. Para dados de popularidade de redes sociais, serão necessários conectores próprios.</p>
  </section>;
}
