import { CONTACT_EMAIL } from '../src/contact.js';
// Copy for the prerendered public pages. Hand-written English + Hong Kong written Chinese (書面語, checked by
// test/seo.test.mjs with the same rules as test/zh-hk.test.mjs). 简体中文 is generated from zh-Hant at build time
// (src/lib/hans.js). Facts only from the real app: src/lib/plans.js, src/data/changelog.js, README feature notes.
// Links inside text: [label](@page) → same-language page ('' = home), [label](https://…) → external, [label](/path) → as is.
// Section keys: h, p (string|array), ul, cards [[title, text]], steps [[title, text]], table {head, rows}, faq [[q, a]],
// img {name, alt}, plans/changelog/plugins (rendered from app data), facts [[label, value]], links [[label, href]], note.

import ja from './locales/ja.js';
import ko from './locales/ko.js';
import es from './locales/es.js';
import fr from './locales/fr.js';
import de from './locales/de.js';
import ptBR from './locales/pt-BR.js';
import idn from './locales/id.js';
import vi from './locales/vi.js';
import th from './locales/th.js';

const en = {
  ui: {
    nav: { demo: 'Demo', features: 'Features', pricing: 'Pricing', faq: 'FAQ', plugins: 'Plugins', changelog: 'Changelog', blog: 'Blog', status: 'Status' },
    start: 'Start free', signIn: 'Sign in', openApp: 'Enter app', home: 'Home', compare: 'Compare', blog: 'Blog', language: 'Language', menu: 'Menu', published: 'Published', readMore: 'Read the post',
    skip: 'Skip to content', made: 'Made in Hong Kong', terms: 'Terms', privacy: 'Privacy', contact: 'Contact',
    footerAbout: 'Nest is a free AI family app for students and parents around the world.',
    perMonth: '/month', perYear: '/year', free: 'Free', aiDay: '{d} AI messages a day · {w} a week (per family)', members: 'Up to {n} members',
    yearly: 'or HK${y} a year (17% off)', comingSoon: 'Coming soon — join the waitlist in the app', available: 'Available now',
    category: { theme: 'Theme', productivity: 'Productivity', study: 'Study' }, version: 'Version',
    vsChatgpt: 'Nest vs ChatGPT for homework',
  },
  pages: {
    '': {
      title: 'Nest — free AI family app for students and parents',
      description: 'Nest is a free AI family app for students and parents: homework tutor, revision quizzes, reminders, family memory and a shared calendar in one place. Made in Hong Kong.',
      eyebrow: 'For families everywhere',
      h1: 'The AI helper for your family.',
      lead: 'Nest is a free AI family app for students and parents: a homework tutor, reminders, family memory and a shared calendar in one place, with local info for your country or region.',
      sections: [
        { h: 'What Nest does', cards: [
          ['Homework tutor', 'Snap a question. Nest gives hints one step at a time and shows the answer only when you tap Reveal. It can draw diagrams, graphs and charts.'],
          ['Revision quizzes', 'Turn a topic or your notes into a quick quiz to check what you know before a test or dictation.'],
          ['AI agent', 'Say “remind me to pay the lunch fee on Friday” and it is done — with Undo. Deleting or inviting always asks first.'],
          ['Family memory', 'Allergies, uniform sizes, class times, where things are. Save it once and anyone in the family can ask.'],
          ['Reminders & notifications', 'Reminders for one person or the whole family, with push notifications on iPhone, Android and desktop and quiet hours.'],
          ['Calendar', 'Google and Apple (iCloud) calendars in one day, week or month view, plus public holidays for your region.'],
          ['School email & Classroom', 'Connect Gmail and Google Classroom (read-only). Nest finds notices, reply slips, fees and deadlines and suggests reminders.'],
          ['Local info for your region', 'Choose your country or region: Nest adds its public holidays, transport and weather links, emergency numbers and exam system. Hong Kong also gets live weather warnings and bus and MTR arrival times.'],
        ] },
        { h: 'Who Nest is for', cards: [
          ['Parents', 'One place for school notices, fees, appointments and who needs to do what — with reminders that reach the right person.'],
          ['Students', 'Homework help that teaches instead of handing over answers, revision quizzes and a countdown to the next test.'],
          ['The whole family', 'A shared memory and calendar so nobody has to ask “where is the remote?” or “when is piano?” twice.'],
        ] },
        { h: 'How it works', steps: [
          ['Create your family', 'Sign up with Google or email. It takes under a minute and costs nothing.'],
          ['Invite everyone', 'Share a link or a six-character code (valid for seven days). Each member gets a role: parent or student.'],
          ['Hand it to Nest', 'Ask in plain words in English, Chinese or one of 12 languages. Optionally connect school email and calendars.'],
        ] },
        { h: 'Pricing', p: 'Nest is free to use. The Free plan includes 100 AI messages a day and 400 a week for one family of up to three members. Starter and Pro plans with more capacity are coming soon. [See pricing](@pricing).' },
        { h: 'Quick facts', facts: [
          ['What it is', 'An AI family app (web app, installable on iPhone, iPad, Android and desktop)'],
          ['For', 'Students and parents in any country or region'],
          ['Price', 'Free plan; paid plans coming soon'],
          ['Languages', 'English, Traditional Chinese (Hong Kong written Chinese), Simplified Chinese, Japanese, Korean, Spanish, French, German, Portuguese (Brazil), Indonesian, Vietnamese and Thai'],
          ['Website', 'https://nesty.cyou'],
        ] },
      ],
    },
    features: {
      title: 'Features — homework tutor, reminders, family memory | Nest',
      description: 'Everything Nest does: AI homework tutor with hints, revision quizzes, an AI agent for reminders, shared family memory, calendar, school email and local info for your country or region.',
      h1: 'Features',
      lead: 'Nest brings the everyday jobs of family life into one calm app: homework help, revision, reminders, family memory, calendars and school email.',
      sections: [
        { h: 'Homework tutor — hints, not answers', img: { name: 'tutor', alt: 'Nest homework tutor guiding a maths question step by step' }, ul: [
          'Type or photograph a question; the tutor guides one step at a time.',
          'The answer appears only when you tap “Reveal answer”, then a similar practice question is one tap away.',
          'Draws diagrams in the chat: light refraction and reflection, lenses and mirrors, forces, circuits, function graphs with sliders, bar, pie and line charts.',
          'Maths is typeset properly, and visuals work in dark mode and on phones.',
        ] },
        { h: 'Revision quizzes', ul: ['Make a quiz from a topic or your notes in seconds.', 'Instant feedback on each answer, so revision before tests and dictations is quick.'] },
        { h: 'AI agent', img: { name: 'agent', alt: 'Nest AI agent creating a reminder from a chat message' }, ul: [
          'Adds and edits reminders, saves details to family memory and changes settings when you ask.',
          'Low-risk actions run with Undo; deleting, inviting or removing a member always asks you to confirm.',
          'Answers factual questions with a Wikipedia lookup and shows the sources.',
          'Reads attached photos, PDFs and Word files — for example a school notice — and suggests a reminder.',
        ] },
        { h: 'Family memory', img: { name: 'memory', alt: 'Nest family memory answering where the TV remote is' }, ul: ['One shared memory for the family: allergies, sizes, class times, where things are.', 'Ask in everyday words; answers show who saved the detail and when.'] },
        { h: 'Reminders, notifications and the daily brief', ul: [
          'Reminders for yourself, one member or everyone; Nest suggests them from school notices and bills.',
          'Push notifications on iPhone and iPad (after adding Nest to the Home Screen, iOS 16.4+), Android and desktop.',
          'A morning brief around 7 am and an evening “tomorrow” brief around 7 pm Hong Kong time; quiet hours are respected.',
          'Birthdays, homework deadlines and tests can notify you too.',
        ] },
        { h: 'Calendar', ul: ['Day, week and month views in Hong Kong time.', 'Connect Google Calendar (all your calendars, several accounts) and Apple iCloud calendars; add and edit events.', 'Hong Kong public holidays built in; family members can choose to share their calendar with the family.'] },
        { h: 'Connections: Gmail, Google Classroom, Drive', img: { name: 'connections', alt: 'Nest connections page with Gmail, Calendar and Classroom' }, ul: [
          'Gmail, Classroom and Drive are read-only. Nest looks for school notices, reply slips, tests, homework and fees.',
          'Suggestions arrive as cards you accept, edit or dismiss — nothing is added without you.',
          'Disconnect any account at any time; that also revokes Nest’s access at Google.',
        ] },
        { h: 'Local info by country or region', ul: [
          'Pick your country or region on a globe (all ISO 3166-1 countries and regions). You can change it any time in Settings.',
          'Local packs for Hong Kong, Macao, mainland China, Taiwan, Singapore, Japan, South Korea, the US, the UK, Australia, Canada, Germany, France, India and Malaysia: public holidays or official holiday links, transport and weather links, emergency numbers and exam systems for the homework tutor. Other regions get general settings.',
          'Hong Kong: Hong Kong Observatory warnings and forecasts, class suspension notices, school holiday dates (Education Bureau example calendar) and live KMB, Citybus and MTR arrival times with a “when to leave” card.',
        ] },
        { h: 'Family, roles and privacy', img: { name: 'parent', alt: 'Nest family page with members and invites' }, ul: [
          'Members, roles and invites on one page; invite with a link or a six-character code valid for seven days.',
          'Family data is only accessible to members of that family. Connected Google access is stored encrypted and used only for your own requests.',
          'Export your data as a JSON file from Settings.',
        ] },
        { h: 'Plugins and languages', p: 'Install sandboxed plugins such as themes, a countdown and a Pomodoro timer from the [Plugin Store](@plugins). Nest works in 12 languages — English, Traditional Chinese (Hong Kong written Chinese), Simplified Chinese, Japanese, Korean, Spanish, French, German, Portuguese (Brazil), Indonesian, Vietnamese and Thai — and the AI replies in the language you choose.' },
      ],
    },
    pricing: {
      title: 'Pricing — free plan, Starter and Pro | Nest',
      description: 'Nest is free: 100 AI messages a day for one family of up to 3 members. Starter (HK$38/month) and Pro (HK$78/month) with more capacity are coming soon.',
      h1: 'Simple, honest pricing',
      lead: 'Start free. Every family is on the Free plan today; paid plans are not live yet and nothing is charged.',
      sections: [
        { h: 'Plans', plans: true },
        { h: 'How usage works', ul: [
          'Limits are per family and shown in the app as a percentage, never as raw counts.',
          'Daily usage resets at 00:00 and weekly usage every Monday at 00:00, Hong Kong time.',
          'Yearly billing costs 17% less than paying monthly (Starter HK$378/year, Pro HK$777/year) once paid plans launch.',
        ] },
        { h: 'Beta offer', p: 'During the beta, the first 10 families can get Pro free for one month at [nesty.cyou/beta](/beta). No card is needed.' },
      ],
    },
    faq: {
      title: 'FAQ — questions about Nest, the AI family app | Nest',
      description: 'Answers about Nest: is it free, does the homework tutor give answers, which languages, how to invite family, privacy, notifications and devices.',
      h1: 'Frequently asked questions',
      lead: 'Short answers about Nest, the free AI family app for students and parents.',
      sections: [
        { h: 'Questions', faq: [
          ['What is Nest?', 'Nest is a free AI family app for students and parents. It combines a homework tutor, revision quizzes, an AI agent, reminders, a shared family memory and a calendar in one place.'],
          ['Is Nest free?', 'Yes. The Free plan includes 100 AI messages a day and 400 a week for one family of up to three members. Starter and Pro plans are coming soon; you can join the waitlist in the app.'],
          ['Does the homework tutor just give the answer?', 'No. It gives hints step by step so the student thinks it through, and shows the answer only when you tap “Reveal answer”.'],
          ['Which languages does Nest support?', 'The website and the AI replies are available in 12 languages: English, Traditional Chinese (standard Hong Kong written Chinese), Simplified Chinese, Japanese, Korean, Spanish, French, German, Portuguese (Brazil), Indonesian, Vietnamese and Thai. The app is fully translated into English and Chinese; in the newer languages the main screens are translated and the rest is shown in English for now.'],
          ['How do I invite my family?', 'Open the Family page and share an invite link or a six-character code. Invites are valid for seven days.'],
          ['Is my family’s data private?', 'Family data is only accessible to members of your family. Access to connected Google accounts is stored encrypted, used only for your own requests, and you can disconnect at any time.'],
          ['Does Nest read my email?', 'Only if you connect Gmail, and only read-only. Nest looks for school notices, deadlines, homework and bills and suggests reminders that you accept or dismiss.'],
          ['Which devices does Nest work on?', 'Any modern browser on iPhone, iPad, Android, Mac or Windows. You can add Nest to your Home Screen to open it like an app and get notifications.'],
          ['Can Nest send notifications on iPhone?', 'Yes, on iOS 16.4 or later after adding Nest to the Home Screen from Safari. Then turn on notifications in Settings.'],
          ['Does Nest work outside Hong Kong?', 'Yes. You choose your country or region when you sign up, and Nest uses it for public holidays, transport and weather links, emergency numbers, exam systems and AI answers. Live weather warnings and MTR and bus times are available in Hong Kong only. Reminder times and usage resets currently follow Hong Kong time.'],
          ['Can Nest draw diagrams?', 'Yes. The AI can draw physics diagrams (refraction, forces, circuits, lenses), function graphs, charts and simple illustrations right in the chat. It cannot create photos.'],
          ['How do I contact Nest?', 'Email ' + CONTACT_EMAIL + ' or use Help & feedback in the app’s account menu.'],
        ] },
      ],
    },
    plugins: {
      title: 'Plugin Store — themes and tools for Nest | Nest',
      description: 'Add themes, fonts, a countdown, a Pomodoro timer and more to Nest. Plugins run in a sandbox and only get the permissions you approve.',
      h1: 'Plugins',
      lead: 'The Nest Plugin Store adds themes, tabs, Home widgets and small automations. Every plugin runs in a sandbox and only gets the permissions you approve.',
      sections: [
        { h: 'Plugins by Nest', plugins: true },
        { h: 'How plugins stay safe', ul: [
          'Plugins run in a locked-down sandbox, separate from your account; private chats and family memory have no plugin API at all.',
          'Before installing you see every permission a plugin asks for, such as reading or adding reminders.',
          'Plugins not reviewed by Nest show a clear warning; reviewed ones are marked Safe.',
          'Creators can build their own plugins in Nest Studio, with AI help, and submit them for review.',
        ] },
      ],
    },
    changelog: {
      title: 'Changelog — what’s new in Nest | Nest',
      description: 'Every Nest update with its date (Hong Kong time): new features, fixes and improvements to the AI family app.',
      h1: 'Changelog',
      lead: 'What changed in Nest, newest first. Dates are Hong Kong calendar dates.',
      sections: [{ changelog: true }],
    },
    blog: {
      title: 'Blog — Nest, the AI family app | Nest',
      description: 'Posts from the Nest team: how Nest compares with other AI tools, homework help and family organisation.',
      h1: 'Blog',
      lead: 'Notes from the Nest team about homework help, family organisation and how Nest compares with other AI tools.',
      sections: [{ posts: true }],
    },
    'blog/nest-vs-chatgpt': {
      date: '2026-10-19',
      title: 'Nest vs ChatGPT for homework help — an honest comparison | Nest',
      description: 'How Nest and ChatGPT compare for homework help and family use: step-by-step tutoring, quizzes, parent controls, reminders, school email, local info and price.',
      h1: 'Nest vs ChatGPT for homework help',
      lead: 'Both can help a student with homework. ChatGPT is a general-purpose AI assistant from OpenAI. Nest is a free family app for students and parents that pairs a homework tutor with reminders, family memory and a shared calendar.',
      sections: [
        { h: 'At a glance', table: { head: ['', 'Nest', 'ChatGPT'], rows: [
          ['Made for', 'Families: students and parents together', 'Anyone; a general-purpose assistant'],
          ['Step-by-step homework help', 'Yes — hints first, the answer only when you tap Reveal', 'Yes — Study Mode uses guiding questions and step-by-step support'],
          ['Practice quizzes', 'Yes — revision quizzes', 'Yes — quizzes'],
          ['Diagrams and graphs', 'Yes — physics diagrams, function graphs, charts', 'Yes — Learning Visualizations for maths and science'],
          ['Parent features', 'A family with parent and student roles, invites, shared reminders', 'Parental controls for linked teen accounts (quiet hours, study hours, safety notifications)'],
          ['Shared family memory and reminders', 'Yes — one memory and reminders for the whole family', 'Built around each person’s own account'],
          ['School email and Google Classroom', 'Reads connected Gmail and Classroom (read-only) for notices, deadlines and homework', 'Not focused on school notices'],
          ['Local information', 'Holidays, transport and weather links, emergency numbers and exam systems for your region; live warnings and MTR and bus times in Hong Kong', 'General knowledge and web search'],
          ['Languages', 'Traditional Chinese (Hong Kong written), Simplified Chinese, English', 'Many languages'],
          ['Price', 'Free plan; paid plans coming soon', 'Free tier and paid plans'],
        ] } },
        { h: 'When ChatGPT is the better choice', ul: [
          'You want one assistant for everything — writing, coding, research and study — not just family life.',
          'You want OpenAI’s teen experience with parent-managed study hours and safety notifications.',
          'You need help in a language Nest does not support.',
        ] },
        { h: 'When Nest is the better choice', ul: [
          'You want homework help and the rest of family admin in the same place: reminders, family memory, calendars and school email.',
          'Parents and children share one family space with roles, rather than separate accounts.',
          'You want local information for your region, and replies in Traditional Chinese, Simplified Chinese or English.',
          'You want to start free with no card.',
        ] },
        { h: 'Using both', p: 'Many families can use both: ChatGPT as a general assistant, and Nest as the family’s shared home for homework, reminders and school life. [Try Nest free](/auth?mode=up).' },
        { note: 'ChatGPT features are as described by OpenAI in “Introducing ChatGPT for Teens” (18 August 2026, https://openai.com/index/chatgpt-for-teens) and the OpenAI Help Center. Features change — check OpenAI for the latest. Nest is not affiliated with OpenAI; ChatGPT is a trademark of OpenAI.' },
      ],
    },
  },
};

const zh = {
  ui: {
    nav: { demo: '示範', features: '功能', pricing: '價格', faq: '常見問題', plugins: '插件', changelog: '更新日誌', blog: '網誌', status: '狀態' },
    start: '免費開始', signIn: '登入', openApp: '進入應用', home: '主頁', compare: '比較', blog: '網誌', language: '語言', menu: '選單', published: '發佈日期', readMore: '閱讀全文',
    skip: '跳至內容', made: '於香港製作', terms: '服務條款', privacy: '私隱政策', contact: '聯絡',
    footerAbout: 'Nest 是為世界各地學生及家長而設的免費 AI 家庭應用程式。',
    perMonth: '/月', perYear: '/年', free: '免費', aiDay: '每日 {d} 則 · 每週 {w} 則 AI 訊息（每個家庭）', members: '最多 {n} 位成員',
    yearly: '或每年 HK${y}（年付慳 17%）', comingSoon: '即將推出 —— 可在應用程式內加入等候名單', available: '現已可用',
    category: { theme: '主題', productivity: '效率', study: '學習' }, version: '版本',
    vsChatgpt: 'Nest 與 ChatGPT 比較（功課）',
  },
  pages: {
    '': {
      title: 'Nest — 為學生及家長而設的免費 AI 家庭應用程式',
      description: 'Nest 是為學生及家長而設的免費 AI 家庭應用程式：功課導師、溫習測驗、提醒、家庭記憶及共用日曆，集中在一個地方。於香港製作。',
      eyebrow: '為世界各地的家庭而設',
      h1: '全家人的 AI 助理。',
      lead: 'Nest 是為學生及家長而設的免費 AI 家庭應用程式：功課導師、提醒、家庭記憶及共用日曆集中在一個地方，並按你的國家或地區提供本地資訊。',
      sections: [
        { h: 'Nest 可以做甚麼', cards: [
          ['功課導師', '影相上傳題目，Nest 逐步給提示，只在按下「顯示答案」時才公開答案，並可直接畫出圖解、函數圖像及圖表。'],
          ['溫習測驗', '把課題或筆記變成小測驗，在測驗或默書前檢查自己掌握了多少。'],
          ['AI 助理', '說一句「星期五提我交午膳費」，事情就辦好，並可復原。刪除或邀請等操作一定會先請你確認。'],
          ['家庭記憶', '過敏、校服尺碼、上課時間、東西放在哪裏。記下一次，全家都可以查問。'],
          ['提醒及通知', '為自己、某位成員或全家設定提醒，iPhone、Android 及電腦均可接收推送通知，並設有免打擾時段。'],
          ['日曆', '以日、週或月檢視 Google 及 Apple（iCloud）日曆，並顯示你所在地區的公眾假期。'],
          ['學校電郵及 Classroom', '連接 Gmail 及 Google Classroom（只作讀取），Nest 會找出通告、回條、費用及限期，並建議提醒。'],
          ['所在地的本地資訊', '選擇國家或地區後，Nest 會加入當地公眾假期、交通及天氣連結、緊急電話及考試制度；香港更提供即時天氣警告，以及巴士及港鐵到站時間。'],
        ] },
        { h: 'Nest 適合誰', cards: [
          ['家長', '學校通告、費用、約會及分工集中在一處，提醒會送到負責的家人手上。'],
          ['學生', '教你思考而不是直接給答案的功課幫手、溫習測驗，以及下一個測驗的倒數。'],
          ['全家人', '共用的記憶及日曆，不用再重複問「遙控器在哪裏？」或「鋼琴課是甚麼時候？」。'],
        ] },
        { h: '如何開始', steps: [
          ['建立家庭', '以 Google 或電郵註冊，一分鐘內完成，完全免費。'],
          ['邀請家人', '分享邀請連結或六位邀請碼（七天內有效），每位成員可設定為家長或學生。'],
          ['交給 Nest', '以中文、英文或其他支援的語言直接提問，亦可按需要連接學校電郵及日曆。'],
        ] },
        { h: '價格', p: 'Nest 可免費使用。免費方案每個家庭每日有 100 則、每週有 400 則 AI 訊息，一個家庭最多 3 位成員。用量更多的 Starter 及 Pro 方案即將推出。[查看價格](@pricing)。' },
        { h: '基本資料', facts: [
          ['是甚麼', 'AI 家庭應用程式（網頁應用程式，可安裝於 iPhone、iPad、Android 及電腦）'],
          ['對象', '任何國家或地區的學生及家長'],
          ['價格', '設有免費方案；付費方案即將推出'],
          ['語言', '英文、繁體中文（香港書面語）、简体中文、日文、韓文、西班牙文、法文、德文、葡萄牙文（巴西）、印尼文、越南文及泰文'],
          ['網址', 'https://nesty.cyou'],
        ] },
      ],
    },
    features: {
      title: '功能 —— 功課導師、提醒、家庭記憶 | Nest',
      description: 'Nest 的所有功能：會給提示的 AI 功課導師、溫習測驗、幫你設定提醒的 AI 助理、家庭記憶、日曆、學校電郵，以及按國家或地區提供的本地資訊。',
      h1: '功能',
      lead: 'Nest 把家庭生活的日常事務集中在一個安靜的應用程式：功課、溫習、提醒、家庭記憶、日曆及學校電郵。',
      sections: [
        { h: '功課導師 —— 給提示，不給答案', img: { name: 'tutor', alt: 'Nest 功課導師逐步引導一條數學題' }, ul: [
          '輸入或拍攝題目，導師逐步引導思考。',
          '只有按下「顯示答案」才會公開答案，之後可一按練習類似題目。',
          '可在對話中直接畫圖：光的折射及反射、透鏡及面鏡、受力圖、電路、可拉動參數的函數圖像，以及棒形圖、圓形圖及折線圖。',
          '數學算式正確排版，圖像支援深色模式及手機闊度。',
        ] },
        { h: '溫習測驗', ul: ['數秒內按課題或筆記建立測驗。', '每題即時回饋，測驗及默書前溫習更快。'] },
        { h: 'AI 助理', img: { name: 'agent', alt: 'Nest AI 助理按對話新增提醒' }, ul: [
          '按你的要求新增或修改提醒、把資料記入家庭記憶及更改設定。',
          '低風險操作會直接執行並可復原；刪除、邀請或移除成員一定會先請你確認。',
          '回答事實問題時會查閱維基百科並列出來源。',
          '可閱讀附上的相片、PDF 及 Word 檔案（例如學校通告），並建議提醒。',
        ] },
        { h: '家庭記憶', img: { name: 'memory', alt: 'Nest 家庭記憶回答遙控器放在哪裏' }, ul: ['全家共用一個記憶庫：過敏、尺碼、上課時間、東西放在哪裏。', '用平常說話的方式查問，答案會顯示由誰、在何時記下。'] },
        { h: '提醒、通知及每日摘要', ul: [
          '為自己、某位成員或全家設定提醒；Nest 會從學校通告及帳單中建議提醒。',
          'iPhone 及 iPad（加至主畫面後，iOS 16.4 或以上）、Android 及電腦均可接收推送通知。',
          '香港時間早上約 7 時的今日摘要，以及晚上約 7 時的「明天」摘要；會遵守免打擾時段。',
          '生日、功課限期及測驗亦可通知你。',
        ] },
        { h: '日曆', ul: ['以香港時間顯示日、週及月檢視。', '連接 Google 日曆（所有日曆、多個帳戶）及 Apple iCloud 日曆，可新增及修改活動。', '內置香港公眾假期；家庭成員可選擇與家人分享自己的日曆。'] },
        { h: '連接：Gmail、Google Classroom、Drive', img: { name: 'connections', alt: 'Nest 連接頁面，顯示 Gmail、日曆及 Classroom' }, ul: [
          'Gmail、Classroom 及 Drive 只作讀取。Nest 會找出學校通告、回條、測驗、功課及費用。',
          '建議以卡片顯示，由你接受、修改或略過 —— 未經你同意不會新增任何內容。',
          '可隨時中斷連接任何帳戶，同時會撤銷 Nest 在 Google 的存取權。',
        ] },
        { h: '按國家或地區提供本地資訊', ul: [
          '在地球儀上選擇你的國家或地區（涵蓋所有 ISO 3166-1 國家及地區），之後可隨時在「設定」更改。',
          '香港、澳門、中國內地、台灣、新加坡、日本、南韓、美國、英國、澳洲、加拿大、德國、法國、印度及馬來西亞設有本地資訊套件：公眾假期或官方假期連結、交通及天氣連結、緊急電話，以及供功課導師參考的考試制度；其他地區使用通用設定。',
          '香港：香港天文台天氣警告及預報、停課消息、學校假期（教育局示例校曆表），以及九巴、城巴及港鐵實時到站時間和「何時出門」卡片。',
        ] },
        { h: '家庭、角色及私隱', img: { name: 'parent', alt: 'Nest 家庭頁面，顯示成員及邀請' }, ul: [
          '成員、角色及邀請集中在一頁；以連結或六位邀請碼邀請家人，七天內有效。',
          '家庭資料只限該家庭的成員存取。已連接的 Google 存取權經加密儲存，只用於你本人的要求。',
          '可在設定中把資料匯出為 JSON 檔案。',
        ] },
        { h: '插件及語言', p: '可在[插件商店](@plugins)安裝在沙盒中執行的插件，例如主題、倒數及番茄鐘。Nest 支援 12 種語言，包括英文、繁體中文（香港書面語）、简体中文、日文、韓文、西班牙文、法文、德文、葡萄牙文（巴西）、印尼文、越南文及泰文，AI 會以你選擇的語言回覆。' },
      ],
    },
    pricing: {
      title: '價格 —— 免費方案、Starter 及 Pro | Nest',
      description: 'Nest 免費：每個家庭每日 100 則 AI 訊息，最多 3 位成員。用量更多的 Starter（每月 HK$38）及 Pro（每月 HK$78）即將推出。',
      h1: '簡單透明的價格',
      lead: '先免費使用。現時所有家庭均使用免費方案；付費方案尚未推出，不會收取任何費用。',
      sections: [
        { h: '方案', plans: true },
        { h: '用量如何計算', ul: [
          '用量以家庭計算，在應用程式內以百分比顯示，不會顯示實際次數。',
          '每日用量於香港時間 00:00 重設，每週用量於每星期一 00:00 重設。',
          '付費方案推出後，年付比月付便宜 17%（Starter 每年 HK$378，Pro 每年 HK$777）。',
        ] },
        { h: 'Beta 優惠', p: 'Beta 期間，首 10 個家庭可在 [nesty.cyou/beta](/beta) 免費獲得一個月 Pro，無需信用卡。' },
      ],
    },
    faq: {
      title: '常見問題 —— 關於 Nest AI 家庭應用程式 | Nest',
      description: '關於 Nest 的解答：是否免費、功課導師會否直接給答案、支援哪些語言、如何邀請家人、私隱、通知及裝置。',
      h1: '常見問題',
      lead: '關於 Nest —— 為學生及家長而設的免費 AI 家庭應用程式 —— 的簡短解答。',
      sections: [
        { h: '問題', faq: [
          ['Nest 是甚麼？', 'Nest 是為學生及家長而設的免費 AI 家庭應用程式，把功課導師、溫習測驗、AI 助理、提醒、家庭記憶及日曆集中在一個地方。'],
          ['Nest 是否免費？', '是。免費方案每個家庭每日有 100 則、每週有 400 則 AI 訊息，一個家庭最多 3 位成員。Starter 及 Pro 方案即將推出，可在應用程式內加入等候名單。'],
          ['功課導師會直接給答案嗎？', '不會。導師會逐步提示，引導學生自行思考，只有在你按下「顯示答案」時才會公開答案。'],
          ['Nest 支援哪些語言？', '網站及 AI 回覆支援 12 種語言：英文、繁體中文（香港通行書面語）、简体中文、日文、韓文、西班牙文、法文、德文、葡萄牙文（巴西）、印尼文、越南文及泰文。應用程式已完整提供中英文版本；較新加入的語言已翻譯主要畫面，其餘部分暫時以英文顯示。'],
          ['如何邀請家人？', '在「家庭」頁面分享邀請連結或六位邀請碼，有效期為七天。'],
          ['家庭資料是否私密？', '家庭資料只限你的家庭成員存取。已連接 Google 帳戶的存取權經加密儲存，只用於你本人的要求，並可隨時中斷連接。'],
          ['Nest 會讀取我的電郵嗎？', '只有在你連接 Gmail 後才會讀取，而且只作讀取。Nest 會找出學校通告、限期、功課及帳單，並建議提醒，由你接受或略過。'],
          ['Nest 可以在哪些裝置使用？', 'iPhone、iPad、Android、Mac 或 Windows 上的新版瀏覽器均可使用。把 Nest 加至主畫面，便可像應用程式一樣開啟並接收通知。'],
          ['iPhone 可以收到 Nest 的通知嗎？', '可以。iOS 16.4 或以上，先在 Safari 把 Nest 加至主畫面，再在設定中開啟通知。'],
          ['香港以外可以使用 Nest 嗎？', '可以。註冊時選擇你的國家或地區，Nest 會據此提供公眾假期、交通及天氣連結、緊急電話、考試制度及 AI 回答。即時天氣警告及港鐵和巴士到站時間只適用於香港。提醒時間及用量重設目前以香港時間計算。'],
          ['Nest 可以畫圖嗎？', '可以。AI 可在對話中直接畫出物理圖解（折射、受力、電路、透鏡）、函數圖像、圖表及簡單插圖，但不能製作相片。'],
          ['如何聯絡 Nest？', '請電郵至 ' + CONTACT_EMAIL + '，或使用應用程式帳戶選單內的「幫助及意見回饋」。'],
        ] },
      ],
    },
    plugins: {
      title: '插件商店 —— Nest 的主題及工具 | Nest',
      description: '為 Nest 加入主題、字款、倒數、番茄鐘等。插件在沙盒中執行，只會獲得你批准的權限。',
      h1: '插件',
      lead: 'Nest 插件商店可加入主題、分頁、主頁小工具及簡單的自動化。每個插件都在沙盒中執行，只會獲得你批准的權限。',
      sections: [
        { h: 'Nest 官方插件', plugins: true },
        { h: '插件如何保障安全', ul: [
          '插件在受限的沙盒中執行，與你的帳戶分隔；私人對話及家庭記憶完全沒有插件介面。',
          '安裝前會列出插件要求的每項權限，例如讀取或新增提醒。',
          '未經 Nest 審核的插件會顯示清楚的警告；已審核的插件會標示為「安全」。',
          '創作者可在 Nest Studio 借助 AI 製作自己的插件，並提交審核。',
        ] },
      ],
    },
    changelog: {
      title: '更新日誌 —— Nest 最新動態 | Nest',
      description: 'Nest AI 家庭應用程式每次更新的日期（香港時間），以及新功能、修正及改進的詳細內容。',
      h1: '更新日誌',
      lead: 'Nest 的最新變化，由新至舊排列。日期為香港日期。',
      sections: [{ changelog: true }],
    },
    blog: {
      title: '網誌 — Nest AI 家庭應用程式 | Nest',
      description: 'Nest 團隊的文章：Nest 與其他 AI 工具的比較、功課幫助及家庭管理。',
      h1: '網誌',
      lead: 'Nest 團隊關於功課幫助、家庭管理，以及 Nest 與其他 AI 工具比較的文章。',
      sections: [{ posts: true }],
    },
    'blog/nest-vs-chatgpt': {
      date: '2026-10-19',
      title: 'Nest 與 ChatGPT 比較：功課幫手 —— 客觀比較 | Nest',
      description: 'Nest 與 ChatGPT 在功課及家庭用途上的比較：逐步教學、測驗、家長功能、提醒、學校電郵、本地資訊及價格。',
      h1: 'Nest 與 ChatGPT 比較：功課幫手',
      lead: '兩者都可以幫學生做功課。ChatGPT 是 OpenAI 推出的通用 AI 助理；Nest 是為學生及家長而設的免費家庭應用程式，把功課導師與提醒、家庭記憶及共用日曆結合。',
      sections: [
        { h: '一覽', table: { head: ['', 'Nest', 'ChatGPT'], rows: [
          ['對象', '家庭：學生與家長一起使用', '所有人；通用 AI 助理'],
          ['逐步功課教學', '有 —— 先給提示，按「顯示答案」才公開答案', '有 —— Study Mode 以引導問題及逐步支援教學'],
          ['練習測驗', '有 —— 溫習測驗', '有 —— 測驗'],
          ['圖解及圖像', '有 —— 物理圖解、函數圖像、圖表', '有 —— 數學及科學的 Learning Visualizations'],
          ['家長功能', '家庭設有家長及學生角色、邀請及共用提醒', '已連結青少年帳戶的家長監控（停用時段、學習時段、安全通知）'],
          ['共用家庭記憶及提醒', '有 —— 全家共用記憶及提醒', '以個人帳戶為主'],
          ['學校電郵及 Google Classroom', '讀取已連接的 Gmail 及 Classroom（只作讀取），找出通告、限期及功課', '並非以學校通告為重點'],
          ['本地資訊', '所在地區的假期、交通及天氣連結、緊急電話及考試制度；香港另有即時警告及港鐵和巴士時間', '一般知識及網上搜尋'],
          ['語言', '繁體中文（香港書面語）、简体中文、英文', '多種語言'],
          ['價格', '設有免費方案；付費方案即將推出', '設有免費版及付費方案'],
        ] } },
        { h: '較適合用 ChatGPT 的情況', ul: [
          '你想要一個處理所有事情的助理 —— 寫作、編程、研究及學習 —— 而不只是家庭生活。',
          '你想使用 OpenAI 的青少年版，由家長管理學習時段及安全通知。',
          '你需要 Nest 未有支援的語言。',
        ] },
        { h: '較適合用 Nest 的情況', ul: [
          '你想把功課與其他家庭事務放在同一處：提醒、家庭記憶、日曆及學校電郵。',
          '家長與子女共用一個設有角色的家庭空間，而不是各自使用獨立帳戶。',
          '你需要所在地區的本地資訊，並以繁體中文、简体中文或英文回覆。',
          '你想免費開始，無需信用卡。',
        ] },
        { h: '兩者並用', p: '不少家庭可以兩者並用：ChatGPT 作通用助理，Nest 作全家處理功課、提醒及學校事務的共用空間。[免費試用 Nest](/auth?mode=up)。' },
        { note: 'ChatGPT 的功能根據 OpenAI〈Introducing ChatGPT for Teens〉（2026年8月18日，https://openai.com/index/chatgpt-for-teens）及 OpenAI 說明中心的描述。功能或會改變，請以 OpenAI 最新資料為準。Nest 與 OpenAI 並無關聯；ChatGPT 是 OpenAI 的商標。' },
      ],
    },
  },
};

// Run 14: the added languages (seo/locales/<id>.js — hand-written, natural copy). A locale page REPLACES the English page;
// any page or ui key a locale lacks falls back to English (never blank). Blog posts are not translated here.
const LOCALES = { ja, ko, es, fr, de, 'pt-BR': ptBR, id: idn, vi, th };
const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
export function mergeCopy(base, over) {
  if (!isObj(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = isObj(v) && isObj(base?.[k]) ? mergeCopy(base[k], v) : v;
  return out;
}
export const COPY = { en, 'zh-Hant': zh, ...Object.fromEntries(Object.entries(LOCALES).map(([k, v]) => [k, mergeCopy(en, v)])) };

// First-party plugins (mirrors src/lib/plugins/seeds.js; text only, no code).
export const PLUGINS = [
  { id: 'sky-theme', name: 'Sky', nameZh: '天空', category: 'theme', en: 'A soft sky behind your whole Nest — clear day, warm sunset or a starry night.', zh: '為整個 Nest 換上柔和的天空背景 —— 晴朗白天、溫暖日落或星空夜晚。' },
  { id: 'dark-mode', name: 'Midnight', nameZh: '深夜模式', category: 'theme', en: 'A calm dark mode for late-night revision. Soft grey or true black for OLED screens.', zh: '夜晚溫習更舒服的深色模式。可選柔和深灰或 OLED 純黑。' },
  { id: 'rounded-fonts', name: 'Rounded Fonts', nameZh: '圓體字款', category: 'theme', en: 'Friendly rounded typefaces for every page. Chinese text stays in Noto Sans TC.', zh: '為每一頁換上親切的圓體英文字款，中文保持思源黑體。' },
  { id: 'countdown', name: 'Countdown', nameZh: '倒數', category: 'productivity', en: 'A tab that counts down to exams, trips and birthdays. Optional reminder the day before.', zh: '新增一個分頁，倒數考試、旅行和生日。可選在前一天提醒你。' },
  { id: 'pomodoro', name: 'Pomodoro', nameZh: '番茄鐘', category: 'study', en: 'Focus in 25-minute blocks with short breaks. Counts your pomodoros for the day.', zh: '以 25 分鐘為一節專注溫習，中間小休。記錄今天完成了多少個番茄。' },
  { id: 'daily-quote', name: 'Daily Quote', nameZh: '每日金句', category: 'study', en: 'A short, encouraging quote on your Home every day — in Chinese or English.', zh: '每天在主頁顯示一句鼓勵的話，中英文皆可。' },
];
