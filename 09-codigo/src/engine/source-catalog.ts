export interface SuggestedTrendSource {
  id:string; name:string; publisher:string; category:string; description:string;
  url:string; referenceUrl:string; type:'rss'; language:'en'; region:string;
  keywords:string[]; intervalMinutes:number; accessNote:string;freshnessNote?:string;
  sourceKind:'editorial'|'forum_topics'|'social_posts'|'search_trends';
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
 ['bbc-world','BBC · World','BBC','Notícias','Acontecimentos internacionais e contexto para pautas.','https://feeds.bbci.co.uk/news/world/rss.xml','world,society,policy'],
 ['mit-ai','MIT · Artificial Intelligence','MIT News','Tecnologia e IA','Pesquisa em IA; resultados acadêmicos exigem contexto.','https://news.mit.edu/rss/topic/artificial-intelligence2','artificial intelligence,machine learning,AI'],
 ['mit-health','MIT · Health Sciences','MIT News','Saúde','Novas pesquisas em saúde e tecnologias médicas.','https://news.mit.edu/rss/topic/health-sciences-and-technology','health,medical,research'],
 ['mit-business','MIT · Business & Management','MIT News','Negócios','Gestão, organizações e resultados de pesquisa.','https://news.mit.edu/rss/topic/business','business,management,organization'],
 ['mit-climate','MIT · Climate & Sustainability','MIT News','Ciência e ambiente','Clima, sustentabilidade e soluções em pesquisa.','https://news.mit.edu/rss/topic/climate-change','climate,sustainability,energy'],
 ['mit-education','MIT · Education','MIT News','Educação','Ensino, aprendizagem e novas experiências educacionais.','https://news.mit.edu/rss/topic/education','education,learning,teaching'],
 ['google-ai','Google · AI','Google','Tecnologia e IA','Anúncios de IA do próprio fornecedor; perspectiva institucional.','https://blog.google/technology/ai/rss/','AI,Gemini,model'],
 ['google-research','Google Research','Google','Tecnologia e IA','Pesquisas publicadas pelo laboratório do fornecedor.','https://research.google/blog/rss/','research,machine learning,AI'],
 ['techcrunch','TechCrunch','TechCrunch','Negócios','Startups, investimento e mercado de tecnologia.','https://techcrunch.com/feed/','startup,funding,technology'],
 ['techcrunch-ai','TechCrunch · AI','TechCrunch','Tecnologia e IA','Produtos, empresas e investimentos em inteligência artificial.','https://techcrunch.com/category/artificial-intelligence/feed/','AI,model,artificial intelligence'],
 ['techcrunch-social','TechCrunch · Social','TechCrunch','Redes sociais','Notícias sobre plataformas e creators; não é coleta de perfis ou hashtags.','https://techcrunch.com/category/social/feed/','creator,social,Instagram'],
 ['verge','The Verge','The Verge','Tecnologia e IA','Produtos digitais, tecnologia e cultura da internet.','https://www.theverge.com/rss/index.xml','technology,AI,platform'],
 ['npr-health','NPR · Health','NPR','Saúde','Cobertura jornalística de saúde e políticas públicas.','https://feeds.npr.org/103537970/rss.xml','health,medicine,research'],
 ['npr-culture','NPR · Culture','NPR','Cultura e lifestyle','Cultura, livros, entretenimento e comportamento.','https://feeds.npr.org/1008/rss.xml','culture,book,music'],
 ['smithsonian','Smithsonian Magazine','Smithsonian','Cultura e lifestyle','História, cultura, natureza e descobertas.','https://www.smithsonianmag.com/rss/latest_articles/','history,culture,science'],
 ['buffer','Buffer · Resources','Buffer','Marketing e creators','Estratégias e novidades para redes sociais e criadores.','https://buffer.com/resources/rss/','social,creator,marketing'],
 ['wordpress','WordPress News','WordPress','Marketing e creators','Publicação, blogs e evolução do WordPress.','https://wordpress.org/news/feed/','WordPress,blog,publishing'],
 ['npr-business','NPR · Business','NPR','Negócios','Economia, consumo e empresas no noticiário americano.','https://feeds.npr.org/1006/rss.xml','business,economy,consumer'],
 ['npr-food','NPR · Food','NPR','Cultura e lifestyle','Alimentação, hábitos e cultura à mesa.','https://feeds.npr.org/1053/rss.xml','food,cooking,culture'],
 ['npr-science','NPR · Science','NPR','Ciência e ambiente','Ciência e descobertas explicadas ao público geral.','https://feeds.npr.org/1007/rss.xml','science,research,discovery'],
 ['npr-news','NPR · Top Stories','NPR','Notícias','Principais notícias internacionais e americanas para contextualizar pautas.','https://feeds.npr.org/1001/rss.xml','news,world,society'],
 ['al-jazeera','Al Jazeera · News','Al Jazeera','Notícias','Cobertura internacional com foco em acontecimentos globais.','https://www.aljazeera.com/xml/rss/all.xml','world,news,international'],
 ['social-media-today','Social Media Today','Social Media Today','Redes sociais','Cobertura editorial das plataformas, recursos e estratégias sociais.','https://www.socialmediatoday.com/feeds/news/','social,creator,platform'],
 ['mastodon-official','Mastodon · Official account','Mastodon','Redes sociais','Publicações da conta oficial no Mastodon por RSS; não representa toda a rede.','https://mastodon.social/@Mastodon.rss','Mastodon,social,community'],
 ['hacker-news','Hacker News','Hacker News','Fóruns','Tópicos e links enviados pela comunidade; não importa todos os comentários.','https://news.ycombinator.com/rss','startup,technology,software'],
 ['discourse-meta','Discourse Meta','Discourse','Fóruns','Tópicos públicos do fórum sobre comunidades online e moderação.','https://meta.discourse.org/latest.rss','community,forum,moderation'],
 ['lions-roar','Lion’s Roar','Lion’s Roar','Espiritualidade','Perspectiva budista: ensinamentos, meditação e vida cotidiana.','https://www.lionsroar.com/feed/','Buddhism,meditation,compassion'],
 ['tiny-buddha','Tiny Buddha','Tiny Buddha','Espiritualidade','Relatos pessoais e reflexões sobre propósito, relações e autoconhecimento.','https://tinybuddha.com/feed/','mindfulness,purpose,relationships'],
 ['mindful','Mindful','Mindful','Espiritualidade','Atenção plena e práticas contemplativas em uma perspectiva secular.','https://www.mindful.org/feed/','mindfulness,meditation,awareness'],
 ['nomadic-matt','Nomadic Matt','Nomadic Matt','Viagens','Viagens econômicas, roteiros e experiências pessoais; confira conteúdos patrocinados.','https://www.nomadicmatt.com/feed/','travel,budget,destination'],
 ['travel-off-path','Travel Off Path','Travel Off Path','Viagens','Destinos, novidades e mudanças para viajantes internacionais.','https://www.traveloffpath.com/feed/','travel,tourism,destination'],
 ['skift','Skift','Skift','Viagens','Negócios do turismo, hospitalidade e mudanças no comportamento de viagem.','https://skift.com/feed/','travel,hospitality,tourism'],
 ['bahai-teachings','Baha’i Teachings','Baha’i Teachings','Espiritualidade','Perspectiva bahá’í: propósito, unidade e reflexões espirituais.','https://bahaiteachings.org/feed/','spirituality,faith,purpose'],
 ['nyt-world','The New York Times · World','The New York Times','Notícias','Manchetes e resumos internacionais; artigos completos podem exigir assinatura.','https://rss.nytimes.com/services/xml/rss/nyt/World.xml','world,news,international'],
 ['ft-world','Financial Times · World','Financial Times','Notícias','Economia e política internacional; conteúdo integral pode exigir assinatura.','https://www.ft.com/world?format=rss','economy,world,markets'],
 ['dw-world','Deutsche Welle · English','Deutsche Welle','Notícias','Cobertura internacional em inglês a partir da emissora alemã.','https://rss.dw.com/rdf/rss-en-all','world,Europe,news'],
 ['france24','France 24 · English','France 24','Notícias','Notícias internacionais em inglês da emissora francesa.','https://www.france24.com/en/rss','world,news,international'],
 ['google-trends-us','Google Trends · United States','Google Trends','Tendências','Pesquisas em alta no Google nos EUA; consultas, links e estimativas, sem texto de reportagem.','https://trends.google.com/trending/rss?geo=US','news,technology,business,travel'],
 ['google-trends-gb','Google Trends · United Kingdom','Google Trends','Tendências','Pesquisas em alta no Google no Reino Unido; não equivale a tendências do YouTube.','https://trends.google.com/trending/rss?geo=GB','news,technology,business,travel'],
];

const featured=['npr-news','social-media-today','hacker-news','lions-roar','travel-off-path','mit-ai','bbc-health','buffer','techcrunch'];
const priority=(id:string)=>{const index=featured.indexOf(id);return index<0?featured.length:index;};
export const trendSourceCatalog:SuggestedTrendSource[]=entries.sort((a,b)=>priority(a[0])-priority(b[0])).map(([id,name,publisher,category,description,url,words])=>({
  id,name,publisher,category,description,url,type:'rss',language:'en',region:publisher==='Google Trends'?new URL(url).searchParams.get('geo')!:'Global',
  sourceKind:publisher==='Google Trends'?'search_trends':id==='mastodon-official'?'social_posts':category==='Fóruns'?'forum_topics':'editorial',
  keywords:words.split(','),intervalMinutes:360,
  ...(id==='npr-health'?{freshnessNote:'Verificação de 23/10/2026: último item encontrado em 12/01/2026; útil como referência, sem atualização recente confirmada.'}:id==='nomadic-matt'?{freshnessNote:'Verificação de 23/10/2026: último item encontrado em 28/07/2026. Publicação irregular; combine com fontes atualizadas.'}:{}),
  referenceUrl:publisher==='Google Trends'?'https://support.google.com/trends/answer/3076011?hl=en':publisher==='BBC'?'https://www.bbc.co.uk/usingthebbc/terms/':publisher==='MIT News'?'https://news.mit.edu/terms-of-use':publisher==='NPR'?'https://www.npr.org/':new URL(url).origin,
  accessNote:publisher==='BBC'?'A BBC exige permissão para uso comercial dos feeds; obtenha autorização antes de ativar.':publisher==='MIT News'?'Consulte a política de atribuição do MIT News. Imagens têm condições próprias e não são importadas pelo catálogo.':'Consulte as condições do editor para monitoramento e uso comercial. O catálogo não concede licença de republicação.',
}));
