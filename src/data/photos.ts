import { FEED_RAW, FEED_SHUFFLE_TAGS } from "./feed";

/**
 * Curated Unsplash photos (free Unsplash License only, no Unsplash+), grouped by subject.
 * Rows are "image-path|username|display name". Images are hotlinked from images.unsplash.com
 * as the Unsplash guidelines require, and every use credits the photographer.
 */
const RAW = `
#woman
1580489944761-15a19d654956|jakenackos|Jake Nackos
1531746020798-e6953c6e8e04|jimmyferminphotography|Jimmy Fermin
1786555937872-66bf2c2bc4f3|itsjakekling|Jake Kling
1534528741775-53994a69daeb|aiony|Aiony Haust
1544005313-94ddf0286df2|cikstefan|Štefan Štefančík
1772989665252-7cb41ae759cc|alexcrphoto|Alexander Aguero
#man
1500648767791-00dcc994a43e|juricakoletic|Jurica Koletić
1506794778202-cad84cf45f1d|albertdera|Albert Dera
1776781205743-33b4c1106adc|spliff_dj_joe|Dwayne joe
1560250097-0b93528c311a|linkedinsalesnavigator|LinkedIn Sales Solutions
1522556189639-b150ed9c4330|vincefleming|Vince Fleming
1770944661192-525922cba093|___atmos|Caroline Badran
#fashion
1574015974293-817f0ebebb74|armedshutter|Ayo Ogunseinde
1562151270-c7d22ceb586a|goh|Hong Nguyen
1768595583026-01106c88aa10|beckysherburn|Becky Sherburn
1596993100471-c3905dafa78e|molllteaser|Molly Mears
1580478491436-fd6a937acc9e|nicolasladinosilva|Nicolas Ladino Silva
1779406970957-71df0abe57f8|olaszkolda|ola szkolda
#bw
1620122303020-87ec826cf70d|yash_mevawala|Yash mevawala
1597871040916-4b4c20ba08dd|rawctus|Ramin Talebi
1778405953873-413e3d5d8915|kylepetzer|Kyle Petzer
1508184964240-ee96bb9677a7|zulmaury|Zulmaury Saavedra
1542887800-faca0261c9e1|i_am_nah|Nahid Hatami
1774254379298-e8f28f8b03af|ragnarbeaverson|Ragnar Beaverson
#face
1557296387-5358ad7997bb|itsomidarmin|Omid Armin
1597826322461-9b11d306d08f|gryffyn1|gryffyn m
1653507770647-62b4c87d9796|frankflores|Frank Flores
1675773051474-55c4b7d2cf53|itsomidarmin|Omid Armin
1542131597-a4390333d136|iiced|Hichem Dahmani
1641832288775-b870b2d9affb|robleo1963|Roberto Leone
#fire
1618325508550-951512a1e82d|tobbes_rd|Tobias Rademacher
1543005472-1b1d37fa4eae|maxim_tajer|Maxim Tajer
1776320644111-f72194d35eb8|kipfarl|Julian Rösner
1546182208-1e70985e2bf3|photografi_chi|Chirag Nayak
1470549584009-d347338fc0ff|chuttersnap|CHUTTERSNAP
1768036479438-bcb9c9a8c2f2|fakurian|Milad Fakurian
#palms
1514125669375-59ee3985d08b|petefogden|Peter Fogden
1573261289561-d584b9e07feb|joshmillerdp|Josh Miller
1771512198657-603100c5aba0|bennieray|Bennie Bates
1535392432937-a27c36ec07b5|jordanfmcqueen|Jordan McQueen
1506953823976-52e1fdc0149a|mvdheuvel|Maarten van den Heuvel
1770932537107-d5a98aa2a702|ao__space|Alexey O
#flower
1606041008023-472dfb5e530f|aarngiri|AARN GIRI
1538998073820-4dfa76300194|zoltantasi|Zoltan Tasi
1786285848556-5c439a7ca6fd|dpkvishwakarma04|Deepak Vishwakarma
1615280825886-fa817c0a06cc|babybluecat|Jei Lee
1525310072745-f49212b5ac6d|hanchenxu|Han Chenxu
1770555765206-6614f340cd07|iatulp|Atul Pandey
#pinkflower
1582794543139-8ac9cb0f7b11|rikonavt|Rikonavt
1560790671-b76ca4de55ef|evieshaffer|Evie S.
1773126344177-8400ef6f3c45|film002|雙 film
1554486840-db3a33d9318e|anniespratt|Annie Spratt
1582794543462-0d7922e50cf5|rikonavt|Rikonavt
1773649349926-fec24b3a533e|film002|雙 film
#blossom
1493589976221-c2357c31ad77|reddfrancisco|Redd Francisco
1522748906645-95d8adfd52c7|ujitomo|TOMOKO UJI
1775522547738-30e2910b2a96|eyesofneia|Neia Bandeira
1538943186303-104afadcbb16|yustinus|Yustinus Subiakto
1618174168866-c66b9d68e983|yanliudesign|Yan Liu
1774258161364-0b87c4936968|nowbelov|Nowbelov
#mountain
1501786223405-6d024d7c3b8d|peter_mc_greats|Pietro De Grandi
1615729947596-a598e5de0ab3|danielakokina|Daniela Kokina
1764377724194-c4b7356a4851|marcozzolo90|Marco Grosso
1610892415063-d89a504ce049|jan_kohl|Jan Kohl
1613075019881-f475574c236a|blop135|Lucas F
1783159649991-3132773ba1ae|rafaelpeier|Rafael Peier
#desert
1511860810434-a92f84c6f01e|ferparmur|Fernando Paredes Murillo
1559767180-47d8f4919e5d|shot_by_teo|Matteo Di Iorio
1785270101227-b989c85cab00|rafaelpeier|Rafael Peier
1638732984528-f255c9714619|roofy_213|raouf bedrani
1506147854445-5a3f534191f8|davidgaviphoto|David Gavi
1781902835009-a1042ade0cba|rafaelpeier|Rafael Peier
#forest
1507041957456-9c397ce39c97|degleex|Degleex Ganzorig
1503435980610-a51f3ddfee50|filipz|Filip Zrnzević
1768471126957-df36ac318dc1|potokvarte|Hanna Lazar
1519821172144-4f87d85de2a1|david_bxl|David Bruyndonckx
1511207538754-e8555f2bc187|evgenievgenief|Evgeni Evgeniev
1774331510646-a1781c4a9713|ashford_marx|Ashford Marx
#ocean
1565214975484-3cfa9e56f914|unstable_affliction|Ivan Bandura
1505142468610-359e7d316be0|sotti|Shifaaz shamoon
1565643355044-000fbad87cc5|unstable_affliction|Ivan Bandura
1513553404607-988bf2703777|joelvodell|Joel Vodell
1528057212987-2ab71e3984f0|ninjason|Jason Leung
1505118380757-91f5f5632de0|sotti|Shifaaz shamoon
#citynight
1580895456895-cfdf02e4c23f|jfnlife|Juan Felipe
1541336032412-2048a678540d|timovaknar|Timo Wagner
1774979300738-5c8c05e1db6b|madeline_sd|Madeline Liu
1514439827219-9137a0b99245|vantheman|Van Mendoza
1601042879364-f3947d3f9c16|valentinbvs|Valentin BEAUVAIS
1562351778-a451cb11dc90|trapnation|Andre Benz
#neon
1550275994-cdc89cd1948f|bruthethe|Bruno Thethe
1773684532031-0274fbbd727d|helloimnik|Nik
1544365558-35aa4afcf11f|juliusdrost|Julius Drost
1500462918059-b1a0cb512f1d|efekurnaz|Efe Kurnaz
1763396519853-28ca56230bda|thaoag|Thao Nguyen
1617751218806-9077a9093d8b|solenfeyissa|Solen Feyissa
#tower
1534237710431-e2fc698436d0|heysupersimi|Simone Hutsch
1512403754473-27835f7b9984|storybyphil|Phil Desforges
1764193875912-0f0a64874344|lui_and_nic|Luise and Nic
1428366890462-dd4baecf492b|bendumond|Ben Dumond
1508385082359-f38ae991e8f2|matosem|Kevin Matos
1541447271487-09612b3f49f7|bormot|Alexandr Bormotin
#highway
1542705959-878ca346eb20|ericwebr|Eric Weber
1603638725730-233a04d9dca4|brechtdenil|Brecht Denil
1767538109936-8dfc5600f81e|peek_a_boo_who|Tao Yuan
1661277801555-51388fbbe9fd|fivestd|Five STD
1582745177104-71733881745f|dominikhofbauer|dominik hofbauer
1761897526071-5e29319b4751|benjamin_chambon|Benjamin Chambon
#street
1546636889-ba9fdd63583e|joshhild|Josh Hild
1488034976201-ffbaa99cbf5c|matthewhenry|Matthew Henry
1765779038142-054a9f8c2268|bookslope|Takashi Sakamoto
1620259570543-31964aa22586|leronep|Lerone Pieters
1598966835412-6de6f92c243d|raysontjr|Rayson Tan
1757492166964-518d2c8b9f41|branislavrodman|Branislav Rodman
#car
1579211897956-297c1150469a|theodorrr|Theodor Vasile
1587750113469-d2ba02441e8f|bradleycdunn|Bradley Dunn
1770739539144-083d566adf81|clementproust|clement proust
1532751203793-812308a10d8e|aahubs|Aaron Huber
1536168483275-f5736f5c844b|soaresbrubs|Bruna Soares
1579211897986-63e1fcd564e0|theodorrr|Theodor Vasile
#architecture
1479839672679-a46483c0e7c8|joelfilip|Joel Filipe
1527576539890-dfa815648363|joakimnadell|Joakim Nådell
1759898897021-9f706f5768dc|ryunosuke_kikuno|Ryunosuke Kikuno
1518005020951-eccb494ad742|photohunter|Jimmy Chang
1548248823-ce16a73b6d49|timstief|Tim Stief
1759899564526-ed590258cb4d|ryunosuke_kikuno|Ryunosuke Kikuno
#stilllife
1518895949257-7621c3c786d7|tirzavandijk|Tirza van Dijk
1605116817845-efa88545b509|molnj|Jocelyn Morales
1762969217496-32d784e7e557|nationalgallery|National Gallery of Art
1641083993161-4240941837e6|twalton|Townsend Walton
1608415123476-aca7a5da0abe|molnj|Jocelyn Morales
1763493324006-6e6a160a7446|nationalgallery|National Gallery of Art
#sculpture
1548811579-017cf2a4268b|jacc|Jack Hamilton
1601887389937-0b02c26b602c|jacktthunter|Jack Hunter
1767257147797-9628b6c3d934|nationalgallery|National Gallery of Art
1593283590172-adfce2adf213|jianxiangwuph|Jianxiang Wu
1571033690858-b336bfa1dd0f|wilhelmgunkel|Wilhelm Gunkel
1786709287840-d6de3883ef1f|iamguragai|Bikash Guragai
#sky
1513002749550-c59d786b8e6c|taylorvanriper925|Taylor Van Riper
1597571063304-81f081944ee8|iccup|iccup
1786905413066-fd16bd7ed1ea|sofia_induct|Inc inductgroup
1548266652-99cf27701ced|cspek|Chris Nguyen
1560837616-fee1f3d8753a|wzimmermann|Wolf Zimmermann
1783180340813-1fb4efc59a76|niklasjonasson|Niklas Jonasson
#meadow
1591695143819-de437ca3006c|zaneinei|Zane Priedīte
1593617589445-a9cb66fbae15|lisaleo|Lisa Yount
1780380069585-4703916d9ea4|timdavhen|Timothy Cohen
1564914138497-fc25707b9065|studiopizza|Studio Pizza
1599758417353-3b66f35e5d79|creati8e|Sergey Chuprin
1766049882204-ccda1e2e69e9|corinna_01|Corinna
#tree
1518495973542-4542c06a5843|jeremybishop|Jeremy Bishop
1520262494112-9fe481d36ec3|fabulu75|Fabrice Villard
1779049624287-90ff257b2fc7|skstrannik|Sergej
1545308562-050974fb9ac4|thejmoore|Jon Moore
1618277779512-fbe781205465|wx1993|Raychan
1785681107001-363a5fddda5d|hayden_p02|Hayden Patmore
#room
1721395290083-895bf53d6178|lisaanna195|Lisa Anna
1704310546522-59f10c7ec294|jmuniz|Joel Muniz
1597293544475-16730f31a638|ulyanka_ginger|Uliana Koliasa
1664995156397-99bd42f5a8ab|zhpix|Pascal Meier
1704920110270-5c107519cdc4|zaareer|yaman zaareer
1519806870789-d65fc19601fa|bernardhermant|Bernard Hermant
#concert
1563841930606-67e2bce48b78|muneebs|Muneeb S
1565035010268-a3816f98589a|tijsvl|Tijs van Leur
1758550445758-165aeab5b26e|martzzl|Marcel Strauß
1590721791974-d6c8ca43f6bc|kelmoquete|Kelvin Moquete
1509824227185-9c5a01ceba0d|jordonsconner|Jordon Conner
1778694277291-8369c5afb8aa|wamstudio|Romain Gal
#dancer
1547153760-18fc86324498|morganpetroskiphoto|Morgan Petroski
1697661086713-1f196d82891e|_karsten|Karsten Winegeart
1761882619891-6529ff92df0a|_karsten|Karsten Winegeart
1495791185843-c73f2269f669|hudsonhintze|Hudson Hintze
1540324155974-7523202daa3f|drewcolins|Drew Colins
1767565221432-552acb20b8d9|vitaliyshev89|Vitaliy Shevchenko
#lips
1666594171486-858f82f5b191|binkievitz|Michał Bińkiewicz
1584457361626-06effef61a7c|enginakyurt|engin akyurt
1758605456769-7f3d0939f623|kkalerry|Klara Kulikova
1549153052-247abe00d6d9|obcesar|Cesar La Rosa
1654374504608-67c4cfe65fca|justatony|Tony Litvyak
1758605456630-4883bdc0a07a|kkalerry|Klara Kulikova
#hands
1617069897015-7d27a76232ed|figmentprints|Cat Han
1786014894707-6fe6cab16a09|metropolitanmuseum|The Metropolitan Museum of Art
1587365403481-1120a2e0287f|jorgerojas|Jorge Rojas
1596180316165-0974ef954468|sindy_suessengut|Sindy Süßengut
1765691622563-a57c825c8223|alinachernovol|Alina Chernovolova
1541976844346-f18aeac57b06|youssefnaddam|youssef naddam
#horse
1593179449458-e0d43d512551|diefotolui|Luisa Peter
1598974357801-cbca100e65d3|sirloinchop|Pieter van Noorden
1784874939734-cf0f5f7929c9|timmossholder|Tim Mossholder
1557374800-8ba4ccd60e9d|danielbonillao|Daniel Bonilla
1599053581540-248ea75b59cb|diefotolui|Luisa Peter
1777863073427-63ea42020da9|alexandermassph|Alexander Mass
#butterfly
1599631438215-75bc2640feb8|aarngiri|AARN GIRI
1533048324814-79b0a31982f1|kageyama|Yuichi Kageyama
1763909130902-5059b18bda4a|alexandermassph|Alexander Mass
1564514476902-542f8c30121e|munich0307|Anne Lambeck
1535068484622-7a077e5aa558|aaronburden|Aaron Burden
1767755587303-7321592352a0|allecgomes|Allec Gomes
#smoke
1696255400336-05e8eb84f01a|kristinokarlsen|Kristin O Karlsen
1616684553549-d8c5873a1876|onthesearchforpineapples|Colin Lloyd
1761807633470-8c57d3c54404|anevans|Anna Evans
1547070451-ce386c65160a|dayday95|Damon Lam
1585644156378-72d15fa33be5|corina_rainer_|Corina Rainer
1776042449321-e53269895668|ninjason|Jason Leung
#fruit
1601004890684-d8cbf643f5f2|allecgomes|Allec Gomes
1559181567-c3190ca9959b|picoftasty|Mae Mu
1759921037282-1467a5e125ef|busraaksoy00|Büsra Aksoy
1550258987-190a2d41a8ba|thisisnando|Fernando Andrade
1557800636-894a64c1696f|picoftasty|Mae Mu
1764630350810-2846f769ad25|sandym10|Sandy Millar
#beach
1414609245224-afa02bfb3fda|grafixgurl247|Rachel Cook
1588001832198-c15cff59b078|allthestories|Storiès
1782858310632-39e5a3f57968|sgreer|Scott Greer
1601562219653-0f16522227b3|jrpischke|Jason Pischke
1559494007-9f5847c49d94|cristofer|Cristofer Maximilian
1561571994-3c61c554181a|saiph|Saiph Muhammad
#subway
1529179307417-ca83d48bd790|ashkya|Robert Tudor
1556624651-1f527cdf6508|leronep|Lerone Pieters
1784550806181-92a104a66ac1|justalifein|Ruben Mavarez
1557089289-57d5c9f4f0c4|molliesivaram|Mollie Sivaram
1522850403397-b0c8f2f75451|liamburnettblue|Liam Burnett-Blue
1778404562764-b89f10396339|tanyabarrow|T
#greenhouse
1573709386836-c54798c06761|sjaunzeme|Sabīne Jaunzeme
1573143033275-0c49551f5788|anniespratt|Annie Spratt
1786372815417-64f2ab9478a2|perlamutrs|Elvira Blumfelde
1615671524827-c1fe3973b648|farmsteadphoto|Zoe Richardson
1505210448888-9bd04f8f875c|anniespratt|Annie Spratt
1772907952251-09e722aafa6a|christopherstites|Christopher Stites
#vase
1612196808214-b8e1d6145a8c|mathildelangevin|Mathilde Langevin
1582131503261-fca1d1c0589f|linhlee|Linh Le
1631125915902-d8abe9225ff2|yana_hurska|Yana Hurska
1588874133473-d6d9c9dd4f31|larisabirta|Larisa Birta
1772630204917-5e649dcb0d68|nataliekinnear|Natalie Kinnear
1643569556871-91ec60671ed7|molnj|Jocelyn Morales
#celltower
1557174360-3f4f7c724501|veverkolog|Dušan veverkolog
1614157561595-dc25d28cfa85|julian21|Julian
1768699504864-7c8e99cb3c33|vally123|Vally Mulford
1613752327185-87894bb431fb|roninfehr|Douglas Fehr
1544955448-6346fb3cadc9|jslate01|Joshua Slate
1782055984204-43c6cdfb99b1|skstrannik|Sergej
`;

export interface Photo {
  /** Stable key, e.g. "fire:2". */
  key: string;
  tag: string;
  path: string;
  username: string;
  name: string;
}

const UTM = "utm_source=armgdn-monitor&utm_medium=referral";

export const PHOTOS: Photo[] = [];
export const PHOTO_TAGS: string[] = [];
{
  let tag = "";
  let i = 0;
  for (const line of (RAW + FEED_RAW).split("\n")) {
    if (!line.trim()) continue;
    if (line.startsWith("#")) { tag = line.slice(1).trim(); i = 0; PHOTO_TAGS.push(tag); continue; }
    const [path, username, name] = line.split("|");
    PHOTOS.push({ key: `${tag}:${i++}`, tag, path: `photo-${path}`, username, name: name || username });
  }
}
const BY_KEY = new Map(PHOTOS.map((p) => [p.key, p]));

export function getPhoto(key: string): Photo | undefined {
  return BY_KEY.get(key);
}

/** Imgix-backed URL. Width is snapped to a few sizes so the browser cache is shared. */
export function photoUrl(p: Photo, width: number, height?: number): string {
  const w = [240, 400, 800, 1600, 2400].find((s) => s >= width) ?? 2400;
  const h = height ? `&h=${Math.round((height / width) * w)}&fit=crop&crop=faces,entropy` : "";
  return `https://images.unsplash.com/${p.path}?w=${w}${h}&q=80&auto=format`;
}

export const profileUrl = (p: Photo) => `https://unsplash.com/@${p.username}?${UTM}`;
export const UNSPLASH_URL = `https://unsplash.com/?${UTM}`;

/** Editorial feed photos: the pool for the default image and for shuffle. */
export const SHUFFLE_POOL: Photo[] = PHOTOS.filter((p) => FEED_SHUFFLE_TAGS.includes(p.tag));

/**
 * Shuffle bag: every photo in the pool is drawn once before any repeats, in a fresh random
 * order each round, and the order survives reloads so the first image differs every visit.
 */
let bag: string[] = [];
const BAG_KEY = "monitor.shufflebag";
function refill() {
  bag = SHUFFLE_POOL.map((p) => p.key);
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
}
try {
  const saved = JSON.parse(localStorage.getItem(BAG_KEY) || "[]");
  if (Array.isArray(saved)) bag = saved.filter((k) => typeof k === "string" && BY_KEY.has(k));
} catch { /* storage blocked */ }

export function randomPhoto(exclude?: string): Photo {
  if (!bag.length) refill();
  let key = bag.pop()!;
  if (key === exclude) { if (!bag.length) refill(); key = bag.pop()!; }
  try { localStorage.setItem(BAG_KEY, JSON.stringify(bag)); } catch { /* storage blocked */ }
  return BY_KEY.get(key) ?? SHUFFLE_POOL[0];
}

/** Deterministic pick from a tag pool (stable per library item). */
export function photoFrom(tags: string[], seed: string): string {
  const pool = PHOTOS.filter((p) => tags.includes(p.tag));
  if (!pool.length) return PHOTOS[0].key;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return pool[(h >>> 0) % pool.length].key;
}
