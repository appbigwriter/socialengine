import {useState} from 'react';
import {Check,ExternalLink,Plus,Search} from 'lucide-react';
import {trendSourceCatalog,sourceIdentity,type SuggestedTrendSource} from '../../src/engine/source-catalog';
import {discoveryDirectory} from '../../src/engine/discovery-directory';
import {DiscoveryDirectory} from './DiscoveryDirectory';

const sourceKinds={editorial:'Conteúdo editorial',forum_topics:'Tópicos de fórum',social_posts:'Publicações da conta',search_trends:'Buscas em alta'};
const categoryNotes:Record<string,string>={
  'Notícias':'Cobertura jornalística para acompanhar acontecimentos e encontrar contexto para novas pautas.',
  'Redes sociais':'Os cartões distinguem notícias sobre plataformas de publicações de uma conta via RSS. Instagram, TikTok e outras redes exigem conectores próprios para coletar perfis, hashtags e popularidade.',
  'Fóruns':'Tópicos e links compartilhados em comunidades públicas. O feed pode não incluir comentários; relatos e opiniões precisam ser verificados.',
  'Espiritualidade':'Fontes com perspectivas declaradas: tradições religiosas, reflexões pessoais e práticas contemplativas seculares. Escolha conforme a linha editorial do influenciador.',
  'Viagens':'Destinos, roteiros, viagens econômicas e notícias de turismo. Experiências pessoais e cobertura do setor aparecem identificadas na descrição.',
  'Tendências':'O RSS do Google Trends lista consultas em alta por país. Estimativas aproximadas de buscas não equivalem a crescimento calculado, índice de interesse 0–100 ou tendências do YouTube.',
};

export function SourceSuggestions({urls,canAdd,busy,select}:{urls:string[];canAdd:boolean;busy:boolean;select:(source:SuggestedTrendSource)=>void}){
  const [search,setSearch]=useState(''),[category,setCategory]=useState('all'),[limit,setLimit]=useState(9);
  const [directory,setDirectory]=useState(false);
  const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const categories=[...new Set(trendSourceCatalog.map(source=>source.category))];
  const filtered=trendSourceCatalog.filter(source=>(category==='all'||source.category===category)&&normalize([source.name,source.description,source.category,...source.keywords].join(' ')).includes(normalize(search.trim())));
  const installed=new Set(urls.map(sourceIdentity));
  if(directory)return <section className="panel source-suggestions" aria-label="Diretório de descoberta"><div className="section-heading"><div><span className="eyebrow">FONTES E CANAIS DE DESCOBERTA</span><h2>Agências, redes e ferramentas</h2><p>{discoveryDirectory.length} opções com acesso e cobertura identificados.</p></div><button onClick={()=>setDirectory(false)}>Voltar aos feeds</button></div><DiscoveryDirectory urls={urls} canAdd={canAdd} busy={busy} select={select}/></section>;
  return <section className="panel source-suggestions" aria-label="Fontes sugeridas">
    <div className="section-heading"><div><span className="eyebrow">AMPLIE SEU RADAR</span><h2>Fontes sugeridas em inglês</h2><p>{trendSourceCatalog.length} feeds selecionados · escolha as origens que fazem sentido para o seu nicho.</p></div><span className="badge success">RSS / Atom</span></div>
    <p className="muted">Notícias, pesquisas e novidades para descobrir pautas. Cada influenciador escolhe suas fontes e palavras-chave; nada é ativado automaticamente. A frequência de publicação varia por editor.</p>
    <button className="discovery-open" onClick={()=>setDirectory(true)}>Explorar agências, redes e ferramentas ({discoveryDirectory.length})</button>
    <div className="list-filters"><div className="search"><Search size={17}/><input aria-label="Buscar fontes sugeridas" placeholder="Busque IA, saúde, creators…" value={search} onChange={e=>{setSearch(e.target.value);setLimit(9);}}/></div><select aria-label="Categoria das fontes sugeridas" value={category} onChange={e=>{setCategory(e.target.value);setLimit(9);}}><option value="all">Todos os temas</option>{categories.map(value=><option key={value}>{value}</option>)}</select></div>
    {categoryNotes[category]&&<p className="suggestion-category-note">{categoryNotes[category]}</p>}
    <p className="micro" role="status">{filtered.length} fonte(s) encontrada(s) · {installed.size} endereço(s) já monitorado(s) neste espaço</p>
    <div className="suggestion-grid">{filtered.slice(0,limit).map(source=>{
      const added=installed.has(sourceIdentity(source.url));return <article className="suggestion-card" key={source.id}>
        <div className="suggestion-meta"><span className="badge">{source.category}</span><span className="micro">EN · {source.region}</span></div>
        <h3>{source.name}</h3><span className="micro">{sourceKinds[source.sourceKind]}</span><p>{source.description}</p><small className="wrap muted">{new URL(source.url).hostname}</small>
        <details><summary>Condições de uso</summary><p className="micro">{source.accessNote}</p><a href={source.referenceUrl} target="_blank" rel="noreferrer">Consultar editor <ExternalLink size={12}/></a></details>
        {source.publisher==='BBC'&&<span className="micro warning-text">Uso comercial exige permissão da BBC.</span>}
        {source.freshnessNote&&<p className="micro">{source.freshnessNote}</p>}
        <button className={added?'':'primary'} disabled={!canAdd||busy||added} onClick={()=>select(source)} aria-label={`${added?'Adicionada':'Adicionar'} ${source.name}`}>{added?<Check size={15}/>:<Plus size={15}/>} {added?'Já adicionada':'Adicionar fonte'}</button>
      </article>;
    })}</div>
    {!filtered.length&&<p className="muted">Nenhuma sugestão para essa busca. Experimente outro termo ou adicione seu próprio feed em “Monitorar fonte”.</p>}
    {limit<filtered.length&&<button className="suggestion-more" onClick={()=>setLimit(value=>value+9)}>Mostrar mais fontes ({filtered.length-limit})</button>}
    <p className="micro">Até 30 fontes por influenciador. O catálogo não concede licença de republicação. Confira as condições do editor antes de ativar. Para dados de popularidade de redes sociais, serão necessários conectores próprios.</p>
  </section>;
}
