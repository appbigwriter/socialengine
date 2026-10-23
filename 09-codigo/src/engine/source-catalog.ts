export interface SuggestedTrendSource {
  id:string; name:string; publisher:string; category:string; description:string;
  url:string; referenceUrl:string; type:'rss'; language:'en'; region:string;
  keywords:string[]; intervalMinutes:number; accessNote:string;
}

/** Stable identity for the directory UI; the server also validates public URLs. */
export function sourceIdentity(input:string):string {
  try{const url=new URL(input);url.hash='';for(const key of [...url.searchParams.keys()])if(/^(utm_|fbclid|gclid)/i.test(key))url.searchParams.delete(key);url.searchParams.sort();return url.href;}catch{return input;}
}

// A directory, never tenant subscriptions. Adding still requires the normal review form.
const entries:[string,string,string,string,string,string,string][]=[
 ['bbc-tech','BBC · Technology','BBC','Tecnologia e IA','Tecnologia, plataformas digitais e novos produtos.','https://feeds.bbci.co.uk/news/technology/rss.xml','technology,AI,social media'],
 ['bbc-business','BBC · Business','BBC','Negócios','Empresas, economia e mudanças no consumo.','https://feeds.bbci.co.uk/news/business/rss.xml','business,economy,consumer'],
 ['bbc-science','BBC · Science & Environment','BBC','Ciência e ambiente','Descobertas científicas e questões ambientais.','https://feeds.bbci.co.uk/news/science_and_environment/rss.xml','science,climate,environment'],
 ['bbc-health','BBC · Health','BBC','Saúde','Notícias de saúde para investigar com fontes científicas.','https://feeds.bbci.co.uk/news/health/rss.xml','health,research,wellbeing'],
 ['bbc-culture','BBC · Entertainment & Arts','BBC','Cultura e lifestyle','Cinema, música e acontecimentos culturais.','https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml','film,music,culture'],
 ['bbc-world','BBC · World','BBC','Atualidades','Acontecimentos internacionais e contexto para pautas.','https://feeds.bbci.co.uk/news/world/rss.xml','world,society,policy'],
 ['mit-ai','MIT · Artificial Intelligence','MIT News','Tecnologia e IA','Pesquisa em IA; resultados acadêmicos exigem contexto.','https://news.mit.edu/rss/topic/artificial-intelligence2','artificial intelligence,machine learning,AI'],
 ['mit-health','MIT · Health Sciences','MIT News','Saúde','Novas pesquisas em saúde e tecnologias médicas.','https://news.mit.edu/rss/topic/health-sciences-and-technology','health,medical,research'],
 ['mit-business','MIT · Business & Management','MIT News','Negócios','Gestão, organizações e resultados de pesquisa.','https://news.mit.edu/rss/topic/business','business,management,organization'],
 ['mit-climate','MIT · Climate & Sustainability','MIT News','Ciência e ambiente','Clima, sustentabilidade e soluções em pesquisa.','https://news.mit.edu/rss/topic/climate-change','climate,sustainability,energy'],
 ['mit-education','MIT · Education','MIT News','Educação','Ensino, aprendizagem e novas experiências educacionais.','https://news.mit.edu/rss/topic/education','education,learning,teaching'],
 ['google-ai','Google · AI','Google','Tecnologia e IA','Anúncios de IA do próprio fornecedor; perspectiva institucional.','https://blog.google/technology/ai/rss/','AI,Gemini,model'],
 ['google-research','Google Research','Google','Tecnologia e IA','Pesquisas publicadas pelo laboratório do fornecedor.','https://research.google/blog/rss/','research,machine learning,AI'],
 ['techcrunch','TechCrunch','TechCrunch','Negócios','Startups, investimento e mercado de tecnologia.','https://techcrunch.com/feed/','startup,funding,technology'],
 ['techcrunch-ai','TechCrunch · AI','TechCrunch','Tecnologia e IA','Produtos, empresas e investimentos em inteligência artificial.','https://techcrunch.com/category/artificial-intelligence/feed/','AI,model,artificial intelligence'],
 ['techcrunch-social','TechCrunch · Social','TechCrunch','Marketing e creators','Mudanças nas plataformas e na economia dos criadores.','https://techcrunch.com/category/social/feed/','creator,social,Instagram'],
 ['verge','The Verge','The Verge','Tecnologia e IA','Produtos digitais, tecnologia e cultura da internet.','https://www.theverge.com/rss/index.xml','technology,AI,platform'],
 ['npr-health','NPR · Health','NPR','Saúde','Cobertura jornalística de saúde e políticas públicas.','https://feeds.npr.org/103537970/rss.xml','health,medicine,research'],
 ['npr-culture','NPR · Culture','NPR','Cultura e lifestyle','Cultura, livros, entretenimento e comportamento.','https://feeds.npr.org/1008/rss.xml','culture,book,music'],
 ['smithsonian','Smithsonian Magazine','Smithsonian','Cultura e lifestyle','História, cultura, natureza e descobertas.','https://www.smithsonianmag.com/rss/latest_articles/','history,culture,science'],
 ['buffer','Buffer · Resources','Buffer','Marketing e creators','Estratégias e novidades para redes sociais e criadores.','https://buffer.com/resources/rss/','social,creator,marketing'],
 ['wordpress','WordPress News','WordPress','Marketing e creators','Publicação, blogs e evolução do WordPress.','https://wordpress.org/news/feed/','WordPress,blog,publishing'],
 ['npr-business','NPR · Business','NPR','Negócios','Economia, consumo e empresas no noticiário americano.','https://feeds.npr.org/1006/rss.xml','business,economy,consumer'],
 ['npr-food','NPR · Food','NPR','Cultura e lifestyle','Alimentação, hábitos e cultura à mesa.','https://feeds.npr.org/1053/rss.xml','food,cooking,culture'],
 ['npr-science','NPR · Science','NPR','Ciência e ambiente','Ciência e descobertas explicadas ao público geral.','https://feeds.npr.org/1007/rss.xml','science,research,discovery'],
];

const featured=['mit-ai','buffer','npr-health','techcrunch','google-ai','smithsonian','wordpress','verge','bbc-tech'];
const priority=(id:string)=>{const index=featured.indexOf(id);return index<0?featured.length:index;};
export const trendSourceCatalog:SuggestedTrendSource[]=entries.sort((a,b)=>priority(a[0])-priority(b[0])).map(([id,name,publisher,category,description,url,words])=>({
  id,name,publisher,category,description,url,type:'rss',language:'en',region:'Global',
  keywords:words.split(','),intervalMinutes:360,
  referenceUrl:publisher==='BBC'?'https://www.bbc.co.uk/usingthebbc/terms/':publisher==='MIT News'?'https://news.mit.edu/terms-of-use':publisher==='NPR'?'https://www.npr.org/':new URL(url).origin,
  accessNote:publisher==='BBC'?'A BBC exige permissão para uso comercial dos feeds; obtenha autorização antes de ativar.':publisher==='MIT News'?'Consulte a política de atribuição do MIT News. Imagens têm condições próprias e não são importadas pelo catálogo.':'Consulte as condições do editor para monitoramento e uso comercial. O catálogo não concede licença de republicação.',
}));
