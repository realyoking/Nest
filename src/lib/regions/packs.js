// Region packs (Run 11, 2026-10-19). Data only — no network, no keys. Every region WITHOUT a pack gets GLOBAL (+ EU base for
// EU members). Facts and sources:
// - Emergency numbers: checked against Wikipedia "List of emergency telephone numbers" (read 2026-10-19).
// - First day of week / date + time format: CLDR via Intl.Locale#getWeekInfo and Intl.DateTimeFormat in Node 22 (7 = Sunday, 1 = Monday).
// - Public holidays: HK = live 1823 feed (api/_hk.js); CN/SG/JP/KR/US/GB/AU/CA/DE/FR = ./holidays.js (Nager.Date, nationwide only);
//   MO/TW/IN/MY = link to the official source only (no static dates, nothing invented).
// - School terms: hints only (no dates) + official education-ministry links.
// - Weather: HK = live Hong Kong Observatory in the app; elsewhere a link to the national weather service (no live data).
// Links are home pages of official / operator sites; CN uses Amap / Baidu / 12306 (no Google-only services).

export const EU = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];
// Euro area (Bulgaria joined on 2026-01-01).
export const EURO = ['AT', 'BE', 'BG', 'HR', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PT', 'SK', 'SI', 'ES'];

const L = (label, url, zh) => ({ label, url, ...(zh ? { zh } : {}) });

export const GLOBAL = {
  id: 'GLOBAL', units: 'metric', temp: 'C', firstDay: 1, clock: '24h', currency: '', locale: 'en',
  emergency: { note: 'Use the local emergency number. 112 reaches emergency services from mobile phones in many countries, but not everywhere.' },
  exams: [], school: { hint: 'School year and exams depend on the country and school.' },
  transport: [], weather: null, holidays: { source: 'none' }, lang: 'en', live: {},
};

export const EU_BASE = {
  ...GLOBAL, id: 'EU', firstDay: 1, clock: '24h',
  emergency: { all: '112', note: '112 is the EU-wide emergency number (police, ambulance, fire).' },
};

export const PACKS = {
  HK: {
    locale: 'zh-HK', tz: 'Asia/Hong_Kong', currency: 'HKD', units: 'metric', temp: 'C', firstDay: 7, clock: '12h', lang: 'zh-Hant',
    emergency: { all: '999', note: '999 for police, ambulance and fire (112 from mobiles also connects).' },
    exams: ['HKDSE (Hong Kong Diploma of Secondary Education, levels 1–5**)', 'school internal exams / TSA'],
    school: { hint: 'School year September to July; class suspensions follow EDB announcements.', url: 'https://www.edb.gov.hk' },
    transport: [L('MTR', 'https://www.mtr.com.hk', '港鐵'), L('KMB', 'https://www.kmb.hk', '九巴'), L('Citybus', 'https://www.citybus.com.hk', '城巴')],
    weather: L('Hong Kong Observatory', 'https://www.hko.gov.hk', '香港天文台'),
    holidays: { source: '1823', url: 'https://www.1823.gov.hk' },
    live: { transport: true, weather: true, warnings: true, holidays: true, goOut: true, schoolNotices: true },
  },
  MO: {
    locale: 'zh-MO', tz: 'Asia/Macau', currency: 'MOP', units: 'metric', temp: 'C', firstDay: 7, clock: '12h', lang: 'zh-Hant',
    emergency: { all: '999', note: '999 (110 or 112 from mobiles redirect to 999).' },
    exams: ['Joint Admission Examination for Macao Four Higher Education Institutions (四高校聯合入學考試)'],
    school: { hint: 'School year September to July; see DSEDJ for each year\'s calendar.', url: 'https://www.dsedj.gov.mo' },
    transport: [L('DSAT (bus info)', 'https://www.dsat.gov.mo', '交通事務局'), L('Macao Light Rapid Transit', 'https://www.mlm.com.mo', '澳門輕軌')],
    weather: L('SMG (Macao Meteorological and Geophysical Bureau)', 'https://www.smg.gov.mo', '地球物理氣象局'),
    holidays: { source: 'link', url: 'https://www.gov.mo' },
  },
  CN: {
    locale: 'zh-CN', tz: 'Asia/Shanghai', currency: 'CNY', units: 'metric', temp: 'C', firstDay: 1, clock: '24h', lang: 'zh-Hans', noGoogle: true,
    emergency: { police: '110', ambulance: '120', fire: '119', note: '110 police, 120 ambulance, 119 fire, 122 traffic accidents.' },
    exams: ['Zhongkao (中考, senior-high entrance)', 'Gaokao (高考, national college entrance exam)'],
    school: { hint: 'Two semesters: about September–January and February/March–July; each province / city publishes its own calendar.', url: 'http://www.moe.gov.cn' },
    transport: [L('Amap (高德地图)', 'https://www.amap.com'), L('Baidu Maps (百度地图)', 'https://map.baidu.com'), L('China Railway 12306', 'https://www.12306.cn')],
    weather: L('China Meteorological Administration', 'https://weather.cma.cn', '中國氣象局'),
    holidays: { source: 'static', url: 'https://www.gov.cn' },
  },
  TW: {
    locale: 'zh-TW', tz: 'Asia/Taipei', currency: 'TWD', units: 'metric', temp: 'C', firstDay: 7, clock: '12h', lang: 'zh-Hant',
    emergency: { police: '110', ambulance: '119', fire: '119', note: '110 police, 119 ambulance and fire (112 from mobiles).' },
    exams: ['Comprehensive Assessment Program for Junior High (國中教育會考)', 'General Scholastic Ability Test (學測)', 'Advanced Subjects Test (分科測驗)'],
    school: { hint: 'Two semesters: about late August/September–January and February–June.', url: 'https://www.edu.tw' },
    transport: [L('Taipei Metro', 'https://www.metro.taipei', '臺北捷運'), L('Taiwan Railway', 'https://www.railway.gov.tw', '臺鐵'), L('Taiwan High Speed Rail', 'https://www.thsrc.com.tw', '台灣高鐵')],
    weather: L('Central Weather Administration', 'https://www.cwa.gov.tw', '中央氣象署'),
    holidays: { source: 'link', url: 'https://www.dgpa.gov.tw' },
  },
  SG: {
    locale: 'en-SG', tz: 'Asia/Singapore', currency: 'SGD', units: 'metric', temp: 'C', firstDay: 7, clock: '12h', lang: 'en',
    emergency: { police: '999', ambulance: '995', fire: '995', note: '999 police, 995 ambulance and fire; 1777 non-emergency ambulance.' },
    exams: ['PSLE', 'GCE O-Level (replaced by the Singapore-Cambridge Secondary Education Certificate from 2027)', 'GCE A-Level'],
    school: { hint: 'School year January to November in four terms.', url: 'https://www.moe.gov.sg' },
    transport: [L('LTA MyTransport', 'https://www.mytransport.sg'), L('SBS Transit', 'https://www.sbstransit.com.sg'), L('SMRT', 'https://www.smrt.com.sg')],
    weather: L('Meteorological Service Singapore', 'https://www.weather.gov.sg'),
    holidays: { source: 'static', url: 'https://www.mom.gov.sg' },
  },
  JP: {
    locale: 'ja-JP', tz: 'Asia/Tokyo', currency: 'JPY', units: 'metric', temp: 'C', firstDay: 7, clock: '24h', lang: 'en',
    emergency: { police: '110', ambulance: '119', fire: '119', note: '110 police, 119 ambulance and fire, 118 coast guard.' },
    exams: ['High-school entrance exams (高校入試)', 'Common Test for University Admissions (大学入学共通テスト)'],
    school: { hint: 'School year April to March, usually three terms.', url: 'https://www.mext.go.jp' },
    transport: [L('NAVITIME', 'https://www.navitime.co.jp'), L('JR East', 'https://www.jreast.co.jp')],
    weather: L('Japan Meteorological Agency', 'https://www.jma.go.jp', '日本氣象廳'),
    holidays: { source: 'static', url: 'https://www8.cao.go.jp/chosei/shukujitsu/gaiyou.html' },
  },
  KR: {
    locale: 'ko-KR', tz: 'Asia/Seoul', currency: 'KRW', units: 'metric', temp: 'C', firstDay: 7, clock: '12h', lang: 'en',
    emergency: { police: '112', ambulance: '119', fire: '119', note: '112 police, 119 ambulance and fire.' },
    exams: ['College Scholastic Ability Test (CSAT, 수능)'],
    school: { hint: 'School year March to February in two semesters.', url: 'https://www.moe.go.kr' },
    transport: [L('Naver Map', 'https://map.naver.com'), L('KakaoMap', 'https://map.kakao.com')],
    weather: L('Korea Meteorological Administration', 'https://www.weather.go.kr'),
    holidays: { source: 'static', url: 'https://www.mois.go.kr' },
  },
  US: {
    locale: 'en-US', tz: 'America/New_York', currency: 'USD', units: 'imperial', temp: 'F', firstDay: 7, clock: '12h', lang: 'en',
    emergency: { all: '911', note: '911 for police, ambulance and fire; 988 suicide and crisis line.' },
    exams: ['SAT', 'ACT', 'AP exams', 'state standardized tests (vary by state)'], grades: 'letter grades A–F and GPA',
    school: { hint: 'School year about August/September to May/June; calendars are set by each school district.' },
    transport: [L('MTA (New York)', 'https://new.mta.info'), L('Transit app', 'https://transitapp.com')],
    weather: L('National Weather Service', 'https://www.weather.gov'),
    holidays: { source: 'static', note: 'Federal holidays; state holidays vary.' },
  },
  GB: {
    locale: 'en-GB', tz: 'Europe/London', currency: 'GBP', units: 'uk', temp: 'C', firstDay: 1, clock: '24h', lang: 'en',
    emergency: { all: '999 or 112', note: '999 or 112 for police, ambulance, fire and coastguard; 111 non-emergency NHS; 101 non-emergency police.' },
    exams: ['GCSE (grades 9–1)', 'A-level', 'Scotland: National 5 and Highers'],
    school: { hint: 'School year September to July in three terms with half-term breaks; dates are set by each council or school.', url: 'https://www.gov.uk/school-term-holiday-dates' },
    transport: [L('TfL (London)', 'https://tfl.gov.uk'), L('National Rail', 'https://www.nationalrail.co.uk')],
    weather: L('Met Office', 'https://www.metoffice.gov.uk'),
    holidays: { source: 'static', note: 'UK-wide bank holidays only; England, Scotland, Wales and Northern Ireland add their own.', url: 'https://www.gov.uk/bank-holidays' },
  },
  AU: {
    locale: 'en-AU', tz: 'Australia/Sydney', currency: 'AUD', units: 'metric', temp: 'C', firstDay: 1, clock: '12h', lang: 'en',
    emergency: { all: '000', note: '000 for police, ambulance and fire (112 also works from mobiles).' },
    exams: ['NAPLAN', 'ATAR (via the HSC in NSW, VCE in Victoria, QCE in Queensland, …)'],
    school: { hint: 'School year late January/February to December in four terms; dates are set by each state and territory.' },
    transport: [L('Transport for NSW', 'https://transportnsw.info'), L('PTV (Victoria)', 'https://www.ptv.vic.gov.au')],
    weather: L('Bureau of Meteorology', 'https://www.bom.gov.au'),
    holidays: { source: 'static', note: 'National holidays only; states and territories add their own.' },
  },
  CA: {
    locale: 'en-CA', tz: 'America/Toronto', currency: 'CAD', units: 'metric', temp: 'C', firstDay: 7, clock: '12h', lang: 'en',
    emergency: { all: '911', note: '911 for police, ambulance and fire; 988 suicide crisis line.' },
    exams: ['provincial diploma requirements and exams (vary by province)'],
    school: { hint: 'School year September to June; calendars are set by each province and school board.' },
    transport: [L('TTC (Toronto)', 'https://www.ttc.ca'), L('Transit app', 'https://transitapp.com')],
    weather: L('Environment Canada weather', 'https://weather.gc.ca'),
    holidays: { source: 'static', note: 'National holidays only; provinces add their own.' },
  },
  DE: {
    locale: 'de-DE', tz: 'Europe/Berlin', currency: 'EUR', units: 'metric', temp: 'C', firstDay: 1, clock: '24h', lang: 'en', eu: true,
    emergency: { police: '110', ambulance: '112', fire: '112', note: '110 police, 112 ambulance and fire.' },
    exams: ['Abitur', 'Mittlerer Schulabschluss'], grades: 'grades 1 (best) to 6',
    school: { hint: 'School year August/September to June/July; holidays (Schulferien) differ by federal state.', url: 'https://www.kmk.org' },
    transport: [L('Deutsche Bahn', 'https://www.bahn.de')],
    weather: L('Deutscher Wetterdienst', 'https://www.dwd.de'),
    holidays: { source: 'static', note: 'Nationwide holidays only; each federal state adds its own.' },
  },
  FR: {
    locale: 'fr-FR', tz: 'Europe/Paris', currency: 'EUR', units: 'metric', temp: 'C', firstDay: 1, clock: '24h', lang: 'en', eu: true,
    emergency: { police: '17', ambulance: '15', fire: '18', note: '112 (EU-wide), 17 police, 15 SAMU medical, 18 fire.' },
    exams: ['Diplôme national du brevet', 'Baccalauréat'], grades: 'marks out of 20',
    school: { hint: 'School year September to early July; holidays follow zones A, B and C.', url: 'https://www.education.gouv.fr' },
    transport: [L('SNCF Connect', 'https://www.sncf-connect.com'), L('RATP (Paris)', 'https://www.ratp.fr')],
    weather: L('Météo-France', 'https://meteofrance.com'),
    holidays: { source: 'static' },
  },
  IN: {
    locale: 'en-IN', tz: 'Asia/Kolkata', currency: 'INR', units: 'metric', temp: 'C', firstDay: 7, clock: '12h', lang: 'en',
    emergency: { all: '112', note: '112 single emergency number; 100 police, 102/108 ambulance and 101 fire also used.' },
    exams: ['CBSE / CISCE (ICSE, ISC) / state board exams', 'JEE', 'NEET'],
    school: { hint: 'Academic year usually April–March (CBSE) or June–April, depending on the board and state.' },
    transport: [L('IRCTC (Indian Railways)', 'https://www.irctc.co.in'), L('Delhi Metro', 'https://www.delhimetrorail.com')],
    weather: L('India Meteorological Department', 'https://mausam.imd.gov.in'),
    holidays: { source: 'link', url: 'https://www.india.gov.in' },
  },
  MY: {
    locale: 'ms-MY', tz: 'Asia/Kuala_Lumpur', currency: 'MYR', units: 'metric', temp: 'C', firstDay: 1, clock: '12h', lang: 'en',
    emergency: { all: '999', note: '999 for police, ambulance and fire (112 from mobiles).' },
    exams: ['SPM (Sijil Pelajaran Malaysia)', 'STPM'],
    school: { hint: 'See the Ministry of Education calendar for the current school session.', url: 'https://www.moe.gov.my' },
    transport: [L('MyRapid (Prasarana)', 'https://myrapid.com.my'), L('KTMB', 'https://www.ktmb.com.my')],
    weather: L('MetMalaysia', 'https://www.met.gov.my'),
    holidays: { source: 'link', url: 'https://www.malaysia.gov.my' },
  },
};
export const PACK_IDS = Object.keys(PACKS);
