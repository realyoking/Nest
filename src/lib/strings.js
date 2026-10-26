// All UI copy. zh-Hant is formal written Chinese (書面語), not Cantonese colloquial.
export const STRINGS = {
  'zh-Hant': {
    lang: { zh: '繁體中文', en: 'English', label: '語言' },
    common: {
      signIn: '登入', signUp: '註冊', signOut: '登出', start: '免費開始', openApp: '進入應用',
      save: '儲存', cancel: '取消', delete: '刪除', add: '新增', edit: '編輯', done: '完成', next: '下一步', back: '返回',
      loading: '載入中…', comingSoon: '即將推出', copy: '複製', copied: '已複製', retry: '重試', close: '關閉',
      search: '搜尋', confirm: '確認', send: '傳送', new: '新增', today: '今天', tomorrow: '明天', overdue: '已逾期',
      everyone: '全家', optional: '可選', or: '或', error: '發生錯誤，請稍後再試。', noData: '暫時未有資料',
      student: '學生', parent: '家長', owner: '擁有人', you: '你',
    },
    nav: { day: '一天', try: '試一試', features: '功能', pricing: '價格', faq: '常見問題' },
    landing: {
      // Kept for the sign-in side panel.
      h1a: '全家人的', h1b: 'AI 助理。',
      sub: '功課、溫習、家事、提醒，一個地方處理。Nest 記得家中大小事，並在適當時候提醒你。',
      cover: {
        issue: '第 01 期', kicker: '一個家的一天',
        lines: ['一個家，', '每天有', '一千件小事。'], catch: 'Nest 替你接住。',
        sub: '為世界各地家庭而設的 AI 助理：記得家中大小事，在適當時候提醒，並陪孩子一步一步想通功課。',
        cue: '向下看看一天', tap: '輕按蛋',
        ticker: ['午膳費', '中文默書', '校服尺碼 140', '花生過敏', '鋼琴課 10:00', '秋季旅行回條', '圖書館還書', '遙控器', '家長日', '補習時間', '游泳課', '防疫注射紀錄'],
        caught: '已記住',
      },
      day: {
        label: '一天', title: '由早到晚，Nest 都在。',
        chapters: [
          { time: '07:15', part: '早上', who: '媽媽', title: '出門前，先提醒。', body: '回條、午膳費、默書，到期前自動提醒負責的家人。',
            scene: { app: 'Nest', when: '現在', note: '今天須交秋季旅行回條', sub: '已放進 Ethan 的書包了嗎？', done: '已完成' } },
          { time: '16:30', part: '放學', who: 'Ethan', title: '給提示，不給答案。', body: '影相上傳題目，Nest 逐步引導，答案只在按下時才出現。',
            scene: { q: '3x + 5 = 20', label: '功課導師', hints: ['兩邊同時減去 5。', '得出 3x = 15，兩邊再除以 3。', '代回原式檢查一次。'], answer: 'x = 5', locked: '按下才顯示答案' } },
          { time: '19:45', part: '晚飯後', who: '爸爸', title: '全家共用的記憶。', body: '過敏、尺碼、東西放在哪裏，記下一次，全家隨時查問。',
            scene: { ask: '遙控器放在哪裏？', answer: '電視櫃左邊第二個抽屜。', source: '來自家庭記憶 · 媽媽於星期二記下' } },
          { time: '21:30', part: '夜深', who: 'Nest', title: '比你早一步。', body: '從已連接的學校電郵及日曆中找出要辦的事，主動建議提醒。',
            scene: { from: '學校電郵', title: '10 月 28 日秋季旅行', body: '需自備午餐及水壺，回條須於星期三前交回。', add: '新增提醒', skip: '略過', added: '已新增 · 星期一 07:00' } },
        ],
        outro: '全家睡了。Nest 仍然記得。',
      },
      try: {
        label: '試一試', title: ['不用登入，', '現在就試。'], note: '以下為示範內容，並非真實 AI 回覆。',
        tabs: { hw: '功課提示', mem: '家庭記憶' },
        hw: {
          questions: [
            { chip: '方程', q: '3x + 5 = 20，求 x。', hints: ['等號兩邊同時減去 5，會得到甚麼？', '現在是 3x = 15。要求 x，兩邊應同時除以甚麼？', '把答案代回原式：3 × ? + 5 是否等於 20？'], answer: 'x = 5' },
            { chip: '分數', q: '3/4 + 1/8 = ?', hints: ['兩個分數的分母不同，先找出公分母。', '4 和 8 的最小公倍數是 8。3/4 可以寫成多少/8？', '3/4 = 6/8，再加上 1/8。'], answer: '7/8' },
            { chip: '英文', q: 'She ___ (go) to school yesterday.', hints: ['留意句末的 yesterday，應該用甚麼時態？', '是過去式。go 是不規則動詞。', 'go 的過去式不是 goed，想想另一個字。'], answer: 'went' },
          ],
          next: '下一個提示', reveal: '顯示答案', again: '換一題', hint: '提示 {n}', think: '先想一想，再看下一步。', answer: '答案',
        },
        mem: {
          prompt: '選一個問題', from: '來自家庭記憶',
          items: [
            ['遙控器放在哪裏？', '電視櫃左邊第二個抽屜。', '媽媽 · 星期二'],
            ['Ethan 的校服尺碼是多少？', '校服 140，皮鞋 US 4。', '媽媽 · 九月'],
            ['鋼琴課是甚麼時候？', '逢星期六上午 10 時，地點沙田。', '爸爸 · 上星期'],
            ['Ethan 有沒有食物過敏？', '有。Ethan 對花生過敏，外出用膳須留意。', '媽媽 · 開學前'],
          ],
        },
      },
      index: {
        label: '功能', title: 'Nest 會做的事。',
        items: [
          ['功課導師', '逐步提示，引導思考；需要時才顯示答案。'],
          ['溫習測驗', '貼上筆記或影相，即時生成記憶卡及選擇題。'],
          ['家庭記憶', '記下一次，全家隨時查詢。'],
          ['提醒', '按成員分配事項及到期日，不再錯過。'],
          ['AI 主動通知', '從學校電郵及日曆找出要辦的事。'],
          ['連接帳戶', 'Gmail、Google 日曆及 Classroom，只作讀取。'],
        ],
      },
      plans: {
        title: ['先免費，', '需要更多才升級。'], sub: '免費方案的用量每日及每週重設。Starter 有 3 倍用量，Pro 有 8 倍。付費方案即將推出，現可加入等候名單。', link: '查看價格',
      },
      faqTitle: '常見問題',
      faq: [
        ['Nest 是否免費？', '是。免費方案包括基本 AI 用量（每日及每週重設）、一個家庭及最多三位成員。付費方案即將推出，可先加入等候名單。'],
        ['功課導師會直接給答案嗎？', '不會。導師會先逐步提示，引導孩子自行思考；只有在你按下「顯示答案」時才會公開答案。'],
        ['我的資料安全嗎？', '家庭資料只限家庭成員存取。已連接帳戶的授權只保存在你的瀏覽器工作階段內，不會儲存在我們的伺服器。'],
        ['支援哪些語言？', 'AI 回覆及網站支援 12 種語言，包括繁體中文（書面語）、简体中文、英文、日文、韓文、西班牙文、法文、德文、葡萄牙文、印尼文、越南文及泰文，可隨時切換。'],
        ['如何邀請家人？', '在「家庭」頁面產生邀請連結或邀請碼，有效期為七天。'],
      ],
      final: { title: ['今晚，', '交給 Nest。'], sub: '免費建立家庭，一分鐘內完成。', steps: ['建立家庭', '邀請家人', '交給 Nest'] },
    },
    footer: { terms: '服務條款', privacy: '私隱政策', pricing: '價格', rights: '版權所有', made: '於香港製作' },
    pricing: {
      title: '簡單透明的價格。', sub: '先免費使用，需要更多時才升級。',
      monthly: '每月', yearly: '每年', save: '年付慳 17%', perMonth: '/月', perYear: '/年', approxMonth: '約 HK${n}/月', billedYearly: '按年收費', billing: '付款週期',
      current: '目前方案', choose: '選擇', free: '免費開始',
      early: '付款功能尚未開放，現時所有家庭均使用免費方案。加入等候名單，推出時我們會以電郵通知你。',
      names: { free: '免費', starter: 'Starter', pro: 'Pro' },
      desc: { free: '適合初次體驗', starter: '適合日常使用的家庭', pro: '適合需要全面協助的家庭' },
      features: {
        free: ['基本 AI 用量，每日及每週重設', '一個家庭，最多 3 位成員', '功課導師及溫習測驗', '家庭記憶及提醒'],
        starter: ['3 倍 AI 用量', '最多 6 位成員', '連接 Gmail 及 Google 日曆', '提醒及到期通知'],
        pro: ['8 倍 AI 用量', '最多 10 位成員', 'AI 主動通知', '連接所有帳戶', '家長儀表板'],
      },
      capacity: { free: '1×', starter: '3×', pro: '8×' }, capacityLabel: 'AI 用量',
      fine: '每日 {d} 則 · 每週 {w} 則 AI 訊息', usageNote: '用量以百分比顯示，每日 00:00 及每週一 00:00（香港時間）重設。',
      members: '位成員',
    },
    auth: {
      titleIn: '歡迎回來。', titleUp: '建立帳戶。', titleReset: '重設密碼。', noAccount: '還未有帳戶？', signUpLink: '立即註冊', haveAccount: '已有帳戶？', signInLink: '登入', resetHint: '輸入電郵，我們會寄出重設密碼的連結。', showPw: '顯示密碼', hidePw: '隱藏密碼', tourLabel: 'Nest 功能介紹',
      google: '以 Google 繼續', apple: '以 Apple 繼續', email: '電郵', password: '密碼', name: '顯示名稱',
      submitIn: '登入', submitUp: '建立帳戶', submitReset: '傳送重設連結',
      toUp: '還未有帳戶？註冊', toIn: '已有帳戶？登入', forgot: '忘記密碼？',
      resetSent: '重設連結已傳送至你的電郵。', agree: '繼續即表示你同意《服務條款》及《私隱政策》。',
      errors: {
        'auth/invalid-credential': '電郵或密碼不正確。', 'auth/wrong-password': '電郵或密碼不正確。',
        'auth/user-not-found': '找不到此帳戶。', 'auth/email-already-in-use': '此電郵已被註冊。',
        'auth/weak-password': '密碼最少需要 6 個字元。', 'auth/invalid-email': '電郵格式不正確。',
        'auth/popup-closed-by-user': '登入視窗已關閉。', 'auth/too-many-requests': '嘗試次數過多，請稍後再試。',
        'auth/network-request-failed': '網絡連線失敗。',
        'auth/popup-blocked': '瀏覽器封鎖了登入視窗，請再試一次。', 'auth/unauthorized-domain': '此網址未獲准登入，請改用 nesty.cyou。',
        'auth/account-exists-with-different-credential': '此電郵已用其他方式註冊，請以原本的方式登入。', 'auth/user-mismatch': '所選的 Google 帳戶與目前登入的帳戶不同。',
        'auth/web-storage-unsupported': '瀏覽器設定阻止了登入，請關閉私密瀏覽後再試。', 'auth/user-disabled': '此帳戶已被停用。',
        generic: '暫時未能登入，請稍後再試。',
      },
    },
    onboarding: {
      step: '第 {n} 步，共 {total} 步',
      welcomeTitle: '歡迎來到 Nest。', welcomeSub: '只需一分鐘，為你的家庭設定好一切。',
      choiceTitle: '建立或加入家庭', create: '建立新家庭', createSub: '你將成為家庭擁有人。',
      join: '加入現有家庭', joinSub: '輸入家人提供的邀請碼或連結。',
      familyName: '家庭名稱', familyNamePh: '例如：陳家', code: '邀請碼或邀請連結', codePh: '例如：K7Q2MD',
      invalidCode: '邀請碼無效或已過期。', full: '此家庭的成員人數已達上限。',
      roleTitle: '你是？', displayName: '你的稱呼', displayNamePh: '例如：媽媽、Ethan',
      connectTitle: '連接帳戶', connectSub: '可稍後在「連接」頁面設定。', skip: '略過',
      planTitle: '選擇方案', planSub: '付款功能尚未開放，現時可免費使用。Starter 及 Pro 可先加入等候名單。',
      doneTitle: '一切準備就緒。', doneSub: '你的家庭已設定完成。', enter: '進入 Nest',
      joiningAs: '你將加入「{name}」',
    },
    app: {
      nav: { home: '今天', agent: 'AI 助理', tutor: '功課導師', quiz: '溫習測驗', memory: '家庭記憶', reminders: '提醒', family: '家庭', connections: '連接', usage: '用量', settings: '設定', more: '更多' },
      greetingMorning: '早安', greetingAfternoon: '午安', greetingEvening: '晚上好',
    },
    home: {
      summary: '今日摘要', refresh: '重新整理', lastRun: '上次更新：{time}', summaryEmpty: '按「生成」讓 Nest 為你整理今天的重點。', generate: '生成',
      dueSoon: '即將到期', noDue: '未來七天沒有到期事項。', quick: '快捷操作',
      qa: { ask: '問 AI 助理', homework: '影相問功課', quiz: '建立測驗', remind: '新增提醒', memory: '記下事項', invite: '邀請家人' },
      inbox: 'AI 主動通知', inboxEmpty: '連接 Gmail 或日曆後，Nest 會在這裏主動提出建議。', addReminder: '新增提醒', dismiss: '略過',
      inboxScanning: '正在檢查已連接帳戶…', added: '已加入提醒',
    },
    agent: {
      title: 'AI 助理', newChat: '新對話', placeholder: '問 Nest 任何事…', empty: '今天可以幫你甚麼？',
      suggestions: ['今個星期有甚麼要準備？', '幫我記下：Ethan 對花生過敏', '提醒我星期五交午膳費', '建議一個適合親子的週末活動'],
      history: '對話記錄', noHistory: '還未有對話', actionReminder: '提醒', actionMemory: '記憶', confirmAdd: '加入', addedOk: '已加入',
      limit: 'AI 用量已達上限。', limitDay: '今天的 AI 用量已用完，將於今晚 00:00 重設。', limitWeek: '本週 AI 用量已用完，將於星期一 00:00 重設。', deleteChat: '刪除對話', untitled: '新對話',
    },
    tutor: {
      title: '功課導師', sub: '上傳題目相片或輸入題目，導師會逐步提示。',
      upload: '上傳相片', camera: '影相', typePh: '輸入題目，或補充說明…', start: '開始',
      nextHint: '下一個提示', reveal: '顯示答案', similar: '類似題目', newQ: '新題目', replyPh: '說說你的想法或下一步…',
      revealMsg: 'REVEAL_ANSWER：請顯示完整答案及解題步驟。', similarMsg: 'SIMILAR_QUESTION：請出一條類似的練習題。', hintMsg: '請給我下一個提示。',
      removeImage: '移除相片',
    },
    quiz: {
      title: '溫習測驗', sub: '貼上筆記或上傳相片，Nest 會生成記憶卡及選擇題。',
      notesPh: '在此貼上筆記……', generate: '生成測驗', generating: '正在生成…',
      flashcards: '記憶卡', test: '選擇題', flip: '按卡片翻轉', score: '得分', weak: '需要加強', retake: '再做一次', newQuiz: '新測驗',
      check: '下一題', finish: '完成', correct: '正確', wrong: '不正確', history: '過往成績', noHistory: '還未有測驗紀錄', of: '／',
    },
    memory: {
      title: '家庭記憶', sub: '記下家中重要的事，全家都可查詢。',
      addPh: '例如：Ethan 的校服尺碼是 140', tagPh: '分類（可選）', search: '搜尋記憶', ask: '問 Nest', askPh: '例如：Ethan 對甚麼過敏？',
      empty: '還未有記憶。新增第一條吧。', by: '由 {name} 新增',
    },
    reminders: {
      title: '提醒', sub: '按成員分配事項及到期日。', titlePh: '事項，例如：交午膳費', due: '到期日', member: '負責成員',
      empty: '沒有提醒。', all: '全部', open: '未完成', done: '已完成', markDone: '標記完成',
    },
    family: {
      title: '家庭', members: '成員', invite: '邀請家人', inviteSub: '產生邀請連結或邀請碼，七天內有效。',
      generate: '產生邀請', link: '邀請連結', code: '邀請碼', expires: '有效至 {date}', active: '有效邀請', revoke: '撤銷',
      remove: '移除', makeParent: '設為家長', makeStudent: '設為學生', leave: '離開家庭', limit: '成員 {n}／{max}',
      full: '已達方案成員上限。', rename: '重新命名', removeConfirm: '確定移除此成員？',
    },
    join: {
      title: '加入家庭', invitedTo: '你獲邀加入', signInFirst: '請先登入以接受邀請。', accept: '接受邀請', invalid: '此邀請無效或已過期。',
      already: '你已經是此家庭的成員。', otherFamily: '你目前屬於另一個家庭。接受邀請將會離開原有家庭。',
    },
    connections: {
      title: '連接', sub: '連接帳戶，讓 Nest 讀取通告、日程及功課。所有授權只作讀取，並會加密保存在你的帳戶中，重新安裝或換新裝置後登入即自動恢復。',
      connect: '連接', connected: '已連接', reconnect: '重新授權', disconnect: '中斷連接', preview: '最近資料',
      sessionNote: '此帳戶需要重新授權一次，之後會保持連接。', restoring: '正在恢復…', upgradeNote: 'Google 連接已升級為長期連接：請為下列帳戶按一次「重新授權」，之後重新安裝應用程式或換新裝置亦會自動恢復。', unverified: 'Google 可能顯示「應用程式未經驗證」，按「進階」→「前往」即可繼續。',
      desc: {
        gmail: '學校通告及重要電郵', googlecalendar: '即將舉行的活動', googleclassroom: '功課及到期日', googledrive: '最近的文件',
        outlook: 'Microsoft 電郵', teams: '班級頻道訊息', notion: '筆記及待辦事項', whatsapp: '家庭群組', discord: '學習群組', telegram: '通知訊息', applecalendar: 'iCloud 日曆',
      },
      noItems: '沒有找到最近資料。',
      accountsTitle: 'Google 帳戶', accountsSub: '可連接多於一個 Google 帳戶，例如個人帳戶及學校帳戶，再為每項服務選擇使用哪個帳戶。',
      addFirst: '連接 Google 帳戶', addAnother: '新增另一個帳戶', removeAccount: '移除帳戶', noAccounts: '尚未連接任何 Google 帳戶。',
      active: '已授權', expired: '需要重新授權', unused: '未用於任何服務', using: '使用帳戶',
      tapToUse: '按此使用此帳戶', tapToStop: '按此停止使用此帳戶', pickAccount: '在上方選擇要使用的帳戶',
      connectedN: '已連接 {n} 個帳戶', accountAdded: '已連接 {email}', accountRemoved: '已移除帳戶',
      removeTitle: '移除帳戶？', removeBody: 'Nest 將停止讀取 {email} 的資料，並在所有服務中取消選擇此帳戶。你可隨時重新連接。',
      err403: '未獲授權或相關 API 未啟用（403）',
      schoolNote: '學校帳戶：如學校管理員封鎖未經驗證的應用程式，Google 會拒絕連接，請向學校查詢。',
      short: { gmail: 'Gmail', googlecalendar: '日曆', googleclassroom: 'Classroom', googledrive: 'Drive' },
      oauthErr: {
        cancelled: '已取消連接。', blocked: '此 Google 帳戶不允許連接 Nest，可能已被學校或機構管理員封鎖。請改用其他帳戶，或向管理員查詢。',
        expired: '連接逾時或已失效，請再按一次「連接」。', noEmail: '未能讀取此帳戶的電郵地址，請再試一次並允許存取。',
        network: '網絡連線失敗，請檢查網絡後再試。', generic: '暫時未能連接 Google 帳戶，請稍後再試。',
      },
    },
    usage: {
      title: '用量', sub: '全家共用的 AI 用量，按香港時間計算。', today: '今天已用 {p}%', week: '本週已用 {p}%',
      todayShort: '今天', weekShort: '本週', resetDay: '今晚 00:00 重設', resetWeek: '{when} 00:00 重設',
      perMember: '本週按成員', perMemberSub: '各成員佔本週全家用量的比例。', upgrade: '升級方案', plan: '目前方案',
      capacity: '{x} 倍基本用量', capacityFree: '基本用量', full: '已用完', tz: '香港時間',
      explain: '每則 AI 訊息都會計入今天及本週的用量。任何一項到達 100% 時，AI 功能會暫停，直至重設。',
    },
    settings: {
      title: '設定', profile: '個人資料', displayName: '顯示名稱', role: '身分', language: '語言', plan: '方案', account: '帳戶',
      deleteAccount: '刪除帳戶', deleteConfirm: '確定刪除帳戶？此操作無法復原。', deleteOwner: '你是家庭擁有人，擁有權將轉移給另一位成員。', saved: '已儲存',
    },
    legal: { updated: '最後更新：2026 年 10 月 17 日' },
  },

  en: {
    lang: { zh: '繁體中文', en: 'English', label: 'Language' },
    common: {
      signIn: 'Sign in', signUp: 'Sign up', signOut: 'Sign out', start: 'Start free', openApp: 'Enter app',
      save: 'Save', cancel: 'Cancel', delete: 'Delete', add: 'Add', edit: 'Edit', done: 'Done', next: 'Next', back: 'Back',
      loading: 'Loading…', comingSoon: 'Coming soon', copy: 'Copy', copied: 'Copied', retry: 'Retry', close: 'Close',
      search: 'Search', confirm: 'Confirm', send: 'Send', new: 'New', today: 'Today', tomorrow: 'Tomorrow', overdue: 'Overdue',
      everyone: 'Everyone', optional: 'Optional', or: 'or', error: 'Something went wrong. Please try again.', noData: 'Nothing here yet',
      student: 'Student', parent: 'Parent', owner: 'Owner', you: 'You',
    },
    nav: { day: 'A day', try: 'Try it', features: 'Features', pricing: 'Pricing', faq: 'FAQ' },
    landing: {
      h1a: 'The AI helper', h1b: 'for your family.',
      sub: 'Homework, revision, chores and reminders in one place. Nest remembers the details of family life and reminds you at the right time.',
      cover: {
        issue: 'Issue 01', kicker: 'A day in one family',
        lines: ['A family is', 'a thousand', 'small things.'], catch: 'Nest catches them.',
        sub: 'An AI helper for families everywhere. It remembers the details, reminds the right person at the right time, and walks kids through homework one step at a time.',
        cue: 'Scroll through a day', tap: 'Tap the egg',
        ticker: ['Lunch fee', 'Dictation', 'Uniform size 140', 'Peanut allergy', 'Piano 10:00', 'Trip reply slip', 'Library books', 'The remote', 'Parents\' day', 'Tutoring', 'Swimming', 'Vaccine record'],
        caught: 'Caught',
      },
      day: {
        label: 'A day', title: 'Morning to night, Nest is there.',
        chapters: [
          { time: '07:15', part: 'Morning', who: 'Mum', title: 'A nudge before the door.', body: 'Reply slips, lunch fees, dictation. The right person is reminded before it is due.',
            scene: { app: 'Nest', when: 'now', note: 'Trip reply slip is due today', sub: 'Is it in Ethan\'s school bag?', done: 'Done' } },
          { time: '16:30', part: 'After school', who: 'Ethan', title: 'Hints, not answers.', body: 'Snap a question. Nest guides step by step, and the answer only shows when you ask.',
            scene: { q: '3x + 5 = 20', label: 'Homework tutor', hints: ['Take 5 from both sides.', 'Now 3x = 15. Divide both sides by 3.', 'Plug it back in to check.'], answer: 'x = 5', locked: 'Tap to reveal' } },
          { time: '19:45', part: 'After dinner', who: 'Dad', title: 'One memory for everyone.', body: 'Allergies, sizes, where things live. Save it once and anyone can ask.',
            scene: { ask: 'Where is the TV remote?', answer: 'Second drawer, left side of the TV cabinet.', source: 'From family memory · saved by Mum on Tuesday' } },
          { time: '21:30', part: 'Late', who: 'Nest', title: 'One step ahead.', body: 'Finds what needs doing in connected school mail and calendars, and suggests a reminder.',
            scene: { from: 'School email', title: 'Autumn trip, 28 October', body: 'Bring a packed lunch and a bottle. Reply slip due Wednesday.', add: 'Add reminder', skip: 'Skip', added: 'Added · Mon 07:00' } },
        ],
        outro: 'The family sleeps. Nest still remembers.',
      },
      try: {
        label: 'Try it', title: ['No sign-in.', 'Try it now.'], note: 'This is a demo with sample content, not a live AI reply.',
        tabs: { hw: 'Homework', mem: 'Memory' },
        hw: {
          questions: [
            { chip: 'Equation', q: 'Solve 3x + 5 = 20.', hints: ['What do you get if you take 5 from both sides?', 'Now 3x = 15. What should you divide both sides by?', 'Check it: does 3 × ? + 5 equal 20?'], answer: 'x = 5' },
            { chip: 'Fractions', q: '3/4 + 1/8 = ?', hints: ['The denominators differ. Find a common one first.', 'The lowest common multiple of 4 and 8 is 8. 3/4 is how many eighths?', '3/4 = 6/8. Now add 1/8.'], answer: '7/8' },
            { chip: 'English', q: 'She ___ (go) to school yesterday.', hints: ['Look at "yesterday". Which tense is it?', 'Past tense. "Go" is irregular.', 'It is not "goed". Think of another word.'], answer: 'went' },
          ],
          next: 'Next hint', reveal: 'Reveal answer', again: 'Another one', hint: 'Hint {n}', think: 'Think first, then take the next step.', answer: 'Answer',
        },
        mem: {
          prompt: 'Pick a question', from: 'From family memory',
          items: [
            ['Where is the TV remote?', 'Second drawer, left side of the TV cabinet.', 'Mum · Tuesday'],
            ['What is Ethan\'s uniform size?', 'Uniform 140, shoes US 4.', 'Mum · September'],
            ['When is piano class?', 'Saturdays at 10 am, in Sha Tin.', 'Dad · last week'],
            ['Does Ethan have any food allergies?', 'Yes. Ethan is allergic to peanuts; take care when eating out.', 'Mum · before term'],
          ],
        },
      },
      index: {
        label: 'Features', title: 'What Nest does.',
        items: [
          ['Homework tutor', 'Step-by-step hints; the answer only when you ask.'],
          ['Study quiz', 'Notes or a photo become flashcards and a quiz.'],
          ['Family memory', 'Save it once, anyone can ask.'],
          ['Reminders', 'Tasks and due dates for each member.'],
          ['Proactive AI', 'Finds what needs doing in school mail and calendars.'],
          ['Connected accounts', 'Gmail, Google Calendar and Classroom, read-only.'],
        ],
      },
      plans: {
        title: ['Start free.', 'Upgrade when you need more.'], sub: 'Free usage resets every day and every week. Starter has 3× the capacity, Pro 8×. Paid plans are coming soon — join the waitlist.', link: 'See pricing',
      },
      faqTitle: 'Questions',
      faq: [
        ['Is Nest free?', 'Yes. The Free plan includes base AI usage (resets daily and weekly), one family and up to three members. Paid plans are coming soon; you can join the waitlist now.'],
        ['Does the tutor just give answers?', 'No. It gives hints step by step so your child thinks it through, and only reveals the answer when you tap "Reveal answer".'],
        ['Is my data safe?', 'Family data is only accessible to family members. Connected-account access stays in your browser session and is never stored on our servers.'],
        ['Which languages are supported?', '12 languages for the website and AI replies: English, Traditional Chinese (formal written), Simplified Chinese, Japanese, Korean, Spanish, French, German, Portuguese, Indonesian, Vietnamese and Thai. Switch any time.'],
        ['How do I invite family?', 'Generate an invite link or code on the Family page. Invites are valid for seven days.'],
      ],
      final: { title: ['Tonight,', 'hand it to Nest.'], sub: 'Create your family for free in under a minute.', steps: ['Create a family', 'Invite everyone', 'Hand it to Nest'] },
    },
    footer: { terms: 'Terms', privacy: 'Privacy', pricing: 'Pricing', rights: 'All rights reserved', made: 'Made in Hong Kong' },
    pricing: {
      title: 'Simple, honest pricing.', sub: 'Start free. Upgrade when you need more.',
      monthly: 'Monthly', yearly: 'Yearly', save: 'Save 17% yearly', perMonth: '/mo', perYear: '/yr', approxMonth: '≈ HK${n}/mo', billedYearly: 'billed yearly', billing: 'Billing',
      current: 'Current plan', choose: 'Choose', free: 'Start free',
      early: 'Payments are not live yet, so every family is on the Free plan for now. Join the waitlist and we will email you at launch.',
      names: { free: 'Free', starter: 'Starter', pro: 'Pro' },
      desc: { free: 'To try Nest out', starter: 'For everyday family use', pro: 'For families who want it all' },
      features: {
        free: ['Base AI capacity, resets daily and weekly', '1 family, up to 3 members', 'Homework tutor & study quiz', 'Family memory & reminders'],
        starter: ['3× the AI capacity', 'Up to 6 members', 'Gmail & Google Calendar', 'Reminders & due alerts'],
        pro: ['8× the AI capacity', 'Up to 10 members', 'Proactive AI agent', 'All connectors', 'Parent dashboard'],
      },
      capacity: { free: '1×', starter: '3×', pro: '8×' }, capacityLabel: 'AI capacity',
      fine: '{d} a day · {w} a week AI messages', usageNote: 'Usage shows as a percentage and resets daily at 00:00 and every Monday at 00:00 (Hong Kong time).',
      members: 'members',
    },
    auth: {
      titleIn: 'Welcome back.', titleUp: 'Create your account.', titleReset: 'Reset password.', noAccount: 'New to Nest?', signUpLink: 'Create an account', haveAccount: 'Have an account?', signInLink: 'Sign in', resetHint: 'Enter your email and we will send you a reset link.', showPw: 'Show password', hidePw: 'Hide password', tourLabel: 'Nest features',
      google: 'Continue with Google', apple: 'Continue with Apple', email: 'Email', password: 'Password', name: 'Display name',
      submitIn: 'Sign in', submitUp: 'Create account', submitReset: 'Send reset link',
      toUp: 'New here? Sign up', toIn: 'Have an account? Sign in', forgot: 'Forgot password?',
      resetSent: 'Reset link sent to your email.', agree: 'By continuing you agree to the Terms and Privacy Policy.',
      errors: {
        'auth/invalid-credential': 'Incorrect email or password.', 'auth/wrong-password': 'Incorrect email or password.',
        'auth/user-not-found': 'No account found.', 'auth/email-already-in-use': 'This email is already registered.',
        'auth/weak-password': 'Password must be at least 6 characters.', 'auth/invalid-email': 'Invalid email address.',
        'auth/popup-closed-by-user': 'The sign-in window was closed.', 'auth/too-many-requests': 'Too many attempts. Try again later.',
        'auth/network-request-failed': 'Network error.',
        'auth/popup-blocked': 'The browser blocked the sign-in window. Please try again.', 'auth/unauthorized-domain': 'Sign-in is not allowed on this address. Please use nesty.cyou.',
        'auth/account-exists-with-different-credential': 'This email is registered with another sign-in method. Use that method.', 'auth/user-mismatch': 'The Google account you picked is not the one you are signed in with.',
        'auth/web-storage-unsupported': 'Your browser settings blocked sign-in. Turn off private browsing and try again.', 'auth/user-disabled': 'This account has been disabled.',
        generic: 'Could not sign in right now. Please try again later.',
      },
    },
    onboarding: {
      step: 'Step {n} of {total}',
      welcomeTitle: 'Welcome to Nest.', welcomeSub: 'One minute to set everything up for your family.',
      choiceTitle: 'Create or join a family', create: 'Create a family', createSub: 'You will be the family owner.',
      join: 'Join a family', joinSub: 'Enter the invite code or link you were sent.',
      familyName: 'Family name', familyNamePh: 'e.g. The Chans', code: 'Invite code or link', codePh: 'e.g. K7Q2MD',
      invalidCode: 'This invite is invalid or has expired.', full: 'This family has reached its member limit.',
      roleTitle: 'You are a…', displayName: 'What should we call you?', displayNamePh: 'e.g. Mum, Ethan',
      connectTitle: 'Connect accounts', connectSub: 'You can do this later on the Connections page.', skip: 'Skip',
      planTitle: 'Choose a plan', planSub: 'Payments are not live yet. Nest is free for now — join the waitlist for Starter or Pro.',
      doneTitle: 'You are all set.', doneSub: 'Your family is ready.', enter: 'Enter Nest',
      joiningAs: 'You are joining "{name}"',
    },
    app: {
      nav: { home: 'Today', agent: 'AI Agent', tutor: 'Homework', quiz: 'Study quiz', memory: 'Memory', reminders: 'Reminders', family: 'Family', connections: 'Connections', usage: 'Usage', settings: 'Settings', more: 'More' },
      greetingMorning: 'Good morning', greetingAfternoon: 'Good afternoon', greetingEvening: 'Good evening',
    },
    home: {
      summary: 'Daily summary', refresh: 'Refresh', lastRun: 'Last updated {time}', summaryEmpty: 'Tap Generate and Nest will pull together today\'s essentials.', generate: 'Generate',
      dueSoon: 'Due soon', noDue: 'Nothing due in the next seven days.', quick: 'Quick actions',
      qa: { ask: 'Ask the agent', homework: 'Snap homework', quiz: 'Make a quiz', remind: 'Add reminder', memory: 'Save a detail', invite: 'Invite family' },
      inbox: 'Agent inbox', inboxEmpty: 'Connect Gmail or Calendar and Nest will suggest things here.', addReminder: 'Add reminder', dismiss: 'Dismiss',
      inboxScanning: 'Checking connected accounts…', added: 'Reminder added',
    },
    agent: {
      title: 'AI Agent', newChat: 'New chat', placeholder: 'Ask Nest anything…', empty: 'How can I help today?',
      suggestions: ['What do we need to prepare this week?', 'Remember: Ethan is allergic to peanuts', 'Remind me to pay the lunch fee on Friday', 'Suggest a family activity for the weekend'],
      history: 'History', noHistory: 'No chats yet', actionReminder: 'Reminder', actionMemory: 'Memory', confirmAdd: 'Add', addedOk: 'Added',
      limit: 'AI usage limit reached.', limitDay: 'Today\'s AI usage is used up. It resets tonight at 00:00.', limitWeek: 'This week\'s AI usage is used up. It resets on Monday at 00:00.', deleteChat: 'Delete chat', untitled: 'New chat',
    },
    tutor: {
      title: 'Homework tutor', sub: 'Upload a photo or type the question. The tutor guides you step by step.',
      upload: 'Upload photo', camera: 'Take photo', typePh: 'Type the question, or add a note…', start: 'Start',
      nextHint: 'Next hint', reveal: 'Reveal answer', similar: 'Similar question', newQ: 'New question', replyPh: 'Share your thinking or next step…',
      revealMsg: 'REVEAL_ANSWER: Please show the full answer with working.', similarMsg: 'SIMILAR_QUESTION: Please give me a similar practice question.', hintMsg: 'Please give me the next hint.',
      removeImage: 'Remove photo',
    },
    quiz: {
      title: 'Study quiz', sub: 'Paste notes or upload a photo. Nest makes flashcards and a multiple-choice quiz.',
      notesPh: 'Paste your notes here…', generate: 'Generate quiz', generating: 'Generating…',
      flashcards: 'Flashcards', test: 'Quiz', flip: 'Tap a card to flip', score: 'Score', weak: 'Work on', retake: 'Retake', newQuiz: 'New quiz',
      check: 'Next', finish: 'Finish', correct: 'Correct', wrong: 'Not quite', history: 'Past results', noHistory: 'No quizzes yet', of: '/',
    },
    memory: {
      title: 'Family memory', sub: 'Save what matters. Everyone in the family can find it.',
      addPh: 'e.g. Ethan\'s uniform size is 140', tagPh: 'Tag (optional)', search: 'Search memory', ask: 'Ask Nest', askPh: 'e.g. What is Ethan allergic to?',
      empty: 'No memories yet. Add the first one.', by: 'Added by {name}',
    },
    reminders: {
      title: 'Reminders', sub: 'Tasks by member, with due dates.', titlePh: 'Task, e.g. Pay lunch fee', due: 'Due', member: 'Member',
      empty: 'No reminders.', all: 'All', open: 'Open', done: 'Done', markDone: 'Mark done',
    },
    family: {
      title: 'Family', members: 'Members', invite: 'Invite family', inviteSub: 'Generate a link or code, valid for seven days.',
      generate: 'Create invite', link: 'Invite link', code: 'Invite code', expires: 'Valid until {date}', active: 'Active invites', revoke: 'Revoke',
      remove: 'Remove', makeParent: 'Make parent', makeStudent: 'Make student', leave: 'Leave family', limit: '{n} / {max} members',
      full: 'Member limit reached for this plan.', rename: 'Rename', removeConfirm: 'Remove this member?',
    },
    join: {
      title: 'Join a family', invitedTo: 'You have been invited to', signInFirst: 'Sign in to accept the invite.', accept: 'Accept invite', invalid: 'This invite is invalid or has expired.',
      already: 'You are already in this family.', otherFamily: 'You currently belong to another family. Accepting will leave it.',
    },
    connections: {
      title: 'Connections', sub: 'Connect accounts so Nest can read notices, events and homework. Access is read-only and stored encrypted with your account, so it comes back automatically after reinstalling or on a new device.',
      connect: 'Connect', connected: 'Connected', reconnect: 'Re-authorise', disconnect: 'Disconnect', preview: 'Recent items',
      sessionNote: 'This account needs to be re-authorised once; after that it stays connected.', restoring: 'Restoring…', upgradeNote: 'Google connections now stay connected long-term. Tap Re-authorise once for the accounts below — after that they come back automatically, even after reinstalling the app or on a new device.', unverified: 'Google may show "App not verified". Tap Advanced → Go to continue.',
      desc: {
        gmail: 'School notices and key emails', googlecalendar: 'Upcoming events', googleclassroom: 'Homework and due dates', googledrive: 'Recent documents',
        outlook: 'Microsoft mail', teams: 'Class channel messages', notion: 'Notes and to-dos', whatsapp: 'Family group', discord: 'Study groups', telegram: 'Notifications', applecalendar: 'iCloud calendar',
      },
      noItems: 'No recent items found.',
      accountsTitle: 'Google accounts', accountsSub: 'Link more than one Google account, such as a personal and a school account, then choose which account each service uses.',
      addFirst: 'Connect a Google account', addAnother: 'Add another account', removeAccount: 'Remove account', noAccounts: 'No Google account connected yet.',
      active: 'Active', expired: 'Needs re-authorising', unused: 'Not used by any service', using: 'Using account',
      tapToUse: 'Tap to use this account', tapToStop: 'Tap to stop using this account', pickAccount: 'Pick an account above',
      connectedN: '{n} accounts connected', accountAdded: 'Connected {email}', accountRemoved: 'Account removed',
      removeTitle: 'Remove account?', removeBody: 'Nest will stop reading data from {email} and unselect it for every service. You can connect it again at any time.',
      err403: 'Access not granted or API not enabled (403)',
      schoolNote: 'School accounts: if your school admin blocks unverified apps, Google will refuse the connection. Ask your school.',
      short: { gmail: 'Gmail', googlecalendar: 'Calendar', googleclassroom: 'Classroom', googledrive: 'Drive' },
      oauthErr: {
        cancelled: 'Connection cancelled.', blocked: 'This Google account is not allowed to connect to Nest. Your school or organisation admin may block it. Try another account or ask your admin.',
        expired: 'The connection timed out. Tap Connect again.', noEmail: 'Could not read this account\'s email address. Try again and allow access.',
        network: 'Network error. Check your connection and try again.', generic: 'Could not connect the Google account right now. Please try again later.',
      },
    },
    usage: {
      title: 'Usage', sub: 'AI usage shared by the whole family, in Hong Kong time.', today: '{p}% used today', week: '{p}% used this week',
      todayShort: 'Today', weekShort: 'This week', resetDay: 'Resets tonight at 00:00', resetWeek: 'Resets {when} 00:00',
      perMember: 'This week by member', perMemberSub: 'Each member\'s share of this week\'s family usage.', upgrade: 'Upgrade', plan: 'Current plan',
      capacity: '{x}× base capacity', capacityFree: 'Base capacity', full: 'Used up', tz: 'Hong Kong time',
      explain: 'Every AI message counts towards today and this week. When either reaches 100%, AI pauses until it resets.',
    },
    settings: {
      title: 'Settings', profile: 'Profile', displayName: 'Display name', role: 'Role', language: 'Language', plan: 'Plan', account: 'Account',
      deleteAccount: 'Delete account', deleteConfirm: 'Delete your account? This cannot be undone.', deleteOwner: 'You own this family; ownership will pass to another member.', saved: 'Saved',
    },
    legal: { updated: 'Last updated: 17 October 2026' },
  },
};

// ---- Additions (agent actions, settings, landing v3). Deep-merged into STRINGS above. ----
const EXTRA = {
  'zh-Hant': {
    nav: { try: '示範', features: '功能' },
    agent: {
      suggestions: ['今個星期有甚麼要準備？', '幫我記下：Ethan 對花生過敏', '提醒我星期五交午膳費', '把主題改為深色'],
      done: '已完成', undo: '復原', undone: '已復原', cancelled: '已取消', failed: '未能完成', openQuiz: '開始測驗',
      confirmDanger: '此操作會影響全家或無法自動還原，請確認。', confirmAsk: '你設定了每次操作前先確認。',
      act: {
        reminderCreate: '新增提醒', reminderUpdate: '修改提醒', reminderComplete: '標記完成', reminderReopen: '重新開啟', reminderDelete: '刪除提醒',
        memoryCreate: '記下事項', memoryUpdate: '修改記憶', memoryDelete: '刪除記憶', settings: '更改設定', invite: '產生邀請',
        memberRemove: '移除成員', connected: '讀取已連接帳戶', quiz: '建立測驗',
      },
      errors: {
        not_found: '找不到該項目，可能已被刪除。', owner_only: '只有家庭擁有人可以執行此操作。', cannot_remove_owner: '不能移除家庭擁有人。',
        not_connected: '尚未連接相關帳戶，請先到「連接」頁面設定。', reauth: '帳戶授權已失效，請到「連接」頁面重新授權。', nothing_to_change: '沒有需要修改的內容。',
        'permission-denied': '沒有權限執行此操作。',
      },
    },
    settings: {
      display: '語言及顯示', languageHint: 'AI 亦會以此語言回覆。', ai: 'AI 及導師', notifications: '通知', accounts: '已連接帳戶', manage: '管理',
      needsReauth: '需重新授權', notConnected: '未連接', signInWith: '登入方式', emailPw: '電郵及密碼',
      export: '匯出資料', exportHint: '匯出你的個人資料、家庭提醒及記憶、對話記錄及測驗成績（JSON 檔案）。',
      on: '開啟', off: '關閉',
      keys: {
        lang: '語言', theme: '主題', fontSize: '字體大小', replyStyle: 'AI 回覆風格', autonomy: 'AI 助理自主程度', tutorMode: '導師預設模式',
        tutorStrictness: '提示嚴格程度', inboxFreq: 'AI 主動通知頻率', notifyReminders: '提醒到期通知', notifyInbox: 'AI 主動通知',
        quietEnabled: '免打擾時段', quietStart: '開始', quietEnd: '結束', defaultReminderTime: '預設提醒時間',
      },
      hints: {
        replyStyle: '簡潔：重點為主；詳細：附步驟及例子。', autonomy: '低風險操作（新增提醒、記下事項、更改自己的設定）可自動完成，並可復原。',
        tutorMode: '提示：逐步引導；講解：先簡述概念再提示。', tutorStrictness: '嚴格：只給最小提示；寬鬆：卡住時給較多步驟。',
        inboxFreq: '檢查已連接帳戶並提出建議的次數。', quiet: '此時段內不會主動檢查或彈出通知。', defaultReminderTime: '只提供日期時使用的時間。',
      },
      vals: {
        'zh-Hant': '繁體中文', en: 'English', light: '淺色', dark: '深色', system: '跟隨系統', sm: '小', md: '標準', lg: '大',
        concise: '簡潔', detailed: '詳細', ask: '每次先問我', auto_low: '低風險自動', hints: '提示', explain: '講解',
        gentle: '寬鬆', standard: '標準', strict: '嚴格', off: '關閉', weekly: '每週', daily: '每日', twice: '每日兩次',
      },
    },
    push: {
      title: '推送通知', master: '在此裝置接收通知', masterHint: '提醒、功課限期、測驗、生日及每日摘要會以系統通知送到這部裝置。',
      status: { on: '已開啟', off: '未開啟', denied: '已被封鎖', unsupported: '不支援', needsInstall: '需先加到主畫面' },
      deniedHelp: '通知權限已被封鎖。請到瀏覽器或系統設定，允許 Nest 發送通知，然後再試。',
      unsupportedHelp: '此瀏覽器不支援推送通知。請改用最新版本的 Chrome、Edge、Firefox 或 Safari。',
      types: '通知類型',
      keys: { notifyReminders: '提醒到期', notifyHomework: '功課限期', notifyTests: '測驗及考試', notifyBirthdays: '家人生日', notifyBrief: '每日摘要' },
      hints: {
        notifyReminders: '指派給你或全家的提醒。', notifyHomework: '來自 Google Classroom，需先連接。',
        notifyTests: 'Classroom 項目，以及標題包含「測驗」「考試」「默書」的提醒。', notifyBirthdays: '在「家庭」頁面為成員加上生日。',
        notifyBrief: '早上 7 時，把當天的提醒、功課、測驗及生日合併成一則通知。',
      },
      test: '發送測試通知', testSent: '已發送測試通知，請留意通知欄。', testFail: '未能發送測試通知。', testNone: '此帳戶尚未有已登記的裝置。',
      devices: '已登記的裝置', thisDevice: '此裝置', noDevices: '尚未有裝置。開啟上方的通知，即可登記此裝置。', remove: '移除', removed: '已移除裝置', added: '已開啟此裝置的通知', turnedOff: '已關閉此裝置的通知',
      schedule: '摘要約於每天早上 7 時及晚上 7 時（香港時間）送出；應用程式開啟時，亦會即時提示即將到期的項目。免打擾時段內不會發送。',
      local: { reminder: '提醒到期', homework: '功課即將到期', test: '測驗即將舉行', birthday: '家人生日', birthdayBody: '今天是 {name} 的生日。' },
      errors: { denied: '通知權限已被封鎖。', dismissed: '未有授權通知。', unsupported: '此瀏覽器不支援推送通知。', needs_install: '請先把 Nest 加到主畫面。', generic: '未能開啟通知，請稍後再試。' },
    },
    install: {
      title: '加到主畫面', row: '把 Nest 加到主畫面', rowHint: '像 App 一樣從主畫面開啟、全螢幕顯示，並可接收通知。',
      open: '查看步驟', installBtn: '安裝 Nest', installed: '已安裝。你正在使用主畫面上的 Nest。', installedPill: '已安裝',
      iosWhy: 'iPhone 及 iPad 只容許已加到主畫面的網頁 App 發送通知（需要 iOS 16.4 或以上）。',
      iosOld: '你的 iOS 版本低於 16.4，暫時未能接收通知，但仍可加到主畫面使用。',
      iosOther: '建議使用 Safari 完成以下步驟。',
      iosSteps: ['點按 Safari 的「分享」按鈕（iPhone 在畫面底部，iPad 在右上角）。', '向下捲動，選擇「加至主畫面」。', '點按右上角的「新增」。', '從主畫面開啟 Nest，再到「設定」開啟通知。'],
      shareLabel: '分享', addLabel: '加至主畫面', addBtn: '新增',
      androidBody: '安裝後，Nest 會出現在主畫面及應用程式列表，並以獨立視窗開啟。',
      manual: '請在瀏覽器選單中選擇「安裝應用程式」或「加到主畫面」。',
      banner: '把 Nest 加到主畫面，便可接收提醒通知。', bannerInstall: '安裝 Nest，開啟更快，並可接收通知。', later: '稍後',
    },
    family: { birthday: '生日', birthdayHint: '可選，用於生日通知。', setBirthday: '設定生日', clear: '清除', birthdaySaved: '已儲存生日', birthdayFail: '未能儲存生日：伺服器規則尚未更新。' },
    shell: { dueSoon: '{n} 項提醒將於兩小時內到期', overdue: '{n} 項提醒已逾期' },
    lp: {
      eyebrow: '為世界各地的家庭而設', h1: ['全家人的', 'AI 助理。'],
      sub: 'Nest 是為學生及家長而設的免費 AI 家庭應用程式：功課導師、提醒、家庭記憶及共用日曆集中在一個地方，並按你的國家或地區提供本地資訊。',
      demoTag: '互動示範', demoUrl: 'nesty.cyou/app', demoNote: '這是真實的 Nest 介面，載入了示範資料。可隨意點擊、輸入及勾選，不會儲存任何內容。', reset: '重設示範',
      featLabel: '功能', featTitle: '每天用得著的幫手。',
      feats: {
        tutor: ['功課導師', '給提示，不給答案。', '影相上傳題目，導師逐步引導孩子思考。答案只在按下「顯示答案」後才出現，並可即時出一條類似題目練習。'],
        memory: ['家庭記憶', '記下一次，全家都知道。', '過敏、尺碼、課堂時間、東西放在哪裏。全家共用一個記憶庫，用平常說話的方式就能查問。'],
        agent: ['AI 助理', '說一句，事情就辦好。', '助理可直接新增或修改提醒、記下事項及更改設定，完成後顯示「復原」。刪除、邀請等重要操作會先請你確認。'],
        connections: ['連接帳戶', '學校電郵，不再錯過。', '連接 Gmail、Google 日曆及 Classroom（只作讀取），Nest 會找出通告、限期及功課，並主動建議提醒。'],
        parent: ['家庭', '家長一目了然。', '成員、角色及邀請集中在家庭頁面。邀請家人只需一條連結或六位邀請碼，七天內有效。'],
        usage: ['用量及價格', '先免費，需要更多才升級。', '免費方案的用量每日及每週重設，以百分比顯示。Starter 有 3 倍用量，Pro 有 8 倍。'],
      },
      themeDark: '切換至深色模式', themeLight: '切換至淺色模式', heroShotAlt: 'Nest 應用程式的「今天」頁面', pricingLink: '查看價格', demoOnly: '示範模式不會連接真實帳戶。登入後即可連接。', shotAlt: 'Nest 應用程式畫面：{name}',
    },
  },
  en: {
    nav: { try: 'Demo', features: 'Features' },
    agent: {
      suggestions: ['What do we need to prepare this week?', 'Remember: Ethan is allergic to peanuts', 'Remind me to pay the lunch fee on Friday', 'Switch to dark theme'],
      done: 'Done', undo: 'Undo', undone: 'Undone', cancelled: 'Cancelled', failed: 'Failed', openQuiz: 'Start quiz',
      confirmDanger: 'This affects the whole family or cannot be undone automatically. Please confirm.', confirmAsk: 'You asked to approve every action first.',
      act: {
        reminderCreate: 'New reminder', reminderUpdate: 'Edit reminder', reminderComplete: 'Mark done', reminderReopen: 'Reopen', reminderDelete: 'Delete reminder',
        memoryCreate: 'Save to memory', memoryUpdate: 'Edit memory', memoryDelete: 'Delete memory', settings: 'Change setting', invite: 'Create invite',
        memberRemove: 'Remove member', connected: 'Read connected accounts', quiz: 'Make a quiz',
      },
      errors: {
        not_found: 'Could not find that item — it may have been deleted.', owner_only: 'Only the family owner can do that.', cannot_remove_owner: 'The family owner cannot be removed.',
        not_connected: 'That account is not connected yet. Set it up on the Connections page.', reauth: 'Access has expired. Re-authorise on the Connections page.', nothing_to_change: 'Nothing to change.',
        'permission-denied': 'You do not have permission to do that.',
      },
    },
    settings: {
      display: 'Language & display', languageHint: 'The AI replies in this language too.', ai: 'AI & tutor', notifications: 'Notifications', accounts: 'Connected accounts', manage: 'Manage',
      needsReauth: 'Re-authorise', notConnected: 'Not connected', signInWith: 'Sign-in method', emailPw: 'Email & password',
      export: 'Export data', exportHint: 'Download your profile, family reminders and memory, chats and quiz results as a JSON file.',
      on: 'On', off: 'Off',
      keys: {
        lang: 'Language', theme: 'Theme', fontSize: 'Text size', replyStyle: 'AI reply style', autonomy: 'Agent autonomy', tutorMode: 'Default tutor mode',
        tutorStrictness: 'Hint strictness', inboxFreq: 'Proactive inbox', notifyReminders: 'Reminder alerts', notifyInbox: 'Agent inbox alerts',
        quietEnabled: 'Quiet hours', quietStart: 'From', quietEnd: 'Until', defaultReminderTime: 'Default reminder time',
      },
      hints: {
        replyStyle: 'Concise: the essentials. Detailed: steps and examples.', autonomy: 'Low-risk actions (add a reminder, save a detail, change your own setting) can run automatically, with Undo.',
        tutorMode: 'Hints: guide step by step. Explain: a short concept recap first.', tutorStrictness: 'Strict: smallest nudges only. Gentle: more steps when stuck.',
        inboxFreq: 'How often Nest scans connected accounts for suggestions.', quiet: 'No proactive scans or pop-up alerts during these hours.', defaultReminderTime: 'Used when only a date is given.',
      },
      vals: {
        'zh-Hant': '繁體中文', en: 'English', light: 'Light', dark: 'Dark', system: 'System', sm: 'Small', md: 'Standard', lg: 'Large',
        concise: 'Concise', detailed: 'Detailed', ask: 'Ask every time', auto_low: 'Low-risk automatic', hints: 'Hints', explain: 'Explain',
        gentle: 'Gentle', standard: 'Standard', strict: 'Strict', off: 'Off', weekly: 'Weekly', daily: 'Daily', twice: 'Twice a day',
      },
    },
    push: {
      title: 'Push notifications', master: 'Notifications on this device', masterHint: 'Reminders, homework deadlines, tests, birthdays and the daily brief arrive as system notifications on this device.',
      status: { on: 'On', off: 'Off', denied: 'Blocked', unsupported: 'Not supported', needsInstall: 'Add to Home Screen first' },
      deniedHelp: 'Notifications are blocked. Allow them for Nest in your browser or system settings, then try again.',
      unsupportedHelp: 'This browser does not support push notifications. Use a recent Chrome, Edge, Firefox or Safari.',
      types: 'What to notify',
      keys: { notifyReminders: 'Reminders due', notifyHomework: 'Homework deadlines', notifyTests: 'Tests & exams', notifyBirthdays: 'Family birthdays', notifyBrief: 'Daily brief' },
      hints: {
        notifyReminders: 'Reminders for you or for everyone.', notifyHomework: 'From Google Classroom — connect it first.',
        notifyTests: 'Classroom items and reminders mentioning a test, exam or dictation.', notifyBirthdays: 'Add birthdays on the Family page.',
        notifyBrief: 'At 7 am: today’s reminders, homework, tests and birthdays in one notification.',
      },
      test: 'Send test notification', testSent: 'Test sent — check your notifications.', testFail: 'Could not send the test notification.', testNone: 'No devices registered for this account yet.',
      devices: 'Registered devices', thisDevice: 'This device', noDevices: 'No devices yet. Turn on notifications above to register this one.', remove: 'Remove', removed: 'Device removed', added: 'Notifications are on for this device', turnedOff: 'Notifications are off for this device',
      schedule: 'Briefs go out around 7 am and 7 pm Hong Kong time; while the app is open, Nest also alerts you to items due soon. Nothing is sent during quiet hours.',
      local: { reminder: 'Reminder due', homework: 'Homework due soon', test: 'Test coming up', birthday: 'Family birthday', birthdayBody: 'It is {name}’s birthday today.' },
      errors: { denied: 'Notifications are blocked.', dismissed: 'Notifications were not allowed.', unsupported: 'This browser does not support push notifications.', needs_install: 'Add Nest to your Home Screen first.', generic: 'Could not turn on notifications. Please try again later.' },
    },
    install: {
      title: 'Add to Home Screen', row: 'Add Nest to your Home Screen', rowHint: 'Open it like an app, full screen, with notifications.',
      open: 'Show steps', installBtn: 'Install Nest', installed: 'Installed — you are using Nest from your Home Screen.', installedPill: 'Installed',
      iosWhy: 'On iPhone and iPad, only web apps added to the Home Screen can send notifications (iOS 16.4 or later).',
      iosOld: 'Your iOS version is older than 16.4, so notifications are not available yet — you can still add Nest to your Home Screen.',
      iosOther: 'Safari works best for these steps.',
      iosSteps: ['Tap Safari’s Share button (bottom of the screen on iPhone, top right on iPad).', 'Scroll down and choose “Add to Home Screen”.', 'Tap “Add” in the top-right corner.', 'Open Nest from your Home Screen, then turn on notifications in Settings.'],
      shareLabel: 'Share', addLabel: 'Add to Home Screen', addBtn: 'Add',
      androidBody: 'Once installed, Nest appears on your Home Screen and app list and opens in its own window.',
      manual: 'Open your browser menu and choose “Install app” or “Add to Home screen”.',
      banner: 'Add Nest to your Home Screen to get reminder notifications.', bannerInstall: 'Install Nest — faster to open, with notifications.', later: 'Later',
    },
    family: { birthday: 'Birthday', birthdayHint: 'Optional — used for birthday notifications.', setBirthday: 'Set birthday', clear: 'Clear', birthdaySaved: 'Birthday saved', birthdayFail: 'Could not save the birthday: the server rules have not been updated yet.' },
    shell: { dueSoon: '{n} reminder(s) due within two hours', overdue: '{n} reminder(s) overdue' },
    lp: {
      eyebrow: 'For families everywhere', h1: ['The AI helper', 'for your family.'],
      sub: 'Nest is a free AI family app for students and parents: a homework tutor, reminders, family memory and a shared calendar in one place, with local info for your country or region.',
      demoTag: 'Live demo', demoUrl: 'nesty.cyou/app', demoNote: 'This is the real Nest app with sample data. Click, type and tick freely — nothing is saved.', reset: 'Reset demo',
      featLabel: 'Features', featTitle: 'A helper you will use every day.',
      feats: {
        tutor: ['Homework tutor', 'Hints, not answers.', 'Snap a question and the tutor guides your child one step at a time. The answer appears only when you tap Reveal, and a similar practice question is one tap away.'],
        memory: ['Family memory', 'Save it once. Everyone knows.', 'Allergies, sizes, class times, where things are. One shared memory for the family, searchable in plain words.'],
        agent: ['AI agent', 'Say it, and it is done.', 'The agent adds and edits reminders, saves details and changes settings for you — with Undo. Deleting or inviting always asks you first.'],
        connections: ['Connections', 'Never miss a school email.', 'Connect Gmail, Google Calendar and Classroom (read-only). Nest finds notices, deadlines and homework, and suggests reminders.'],
        parent: ['Family', 'Parents see it all.', 'Members, roles and invites in one place. Invite family with a link or a six-character code, valid for seven days.'],
        usage: ['Usage & pricing', 'Start free. Upgrade when you need more.', 'Free usage resets daily and weekly, shown as a simple percentage. Starter has 3× the capacity, Pro has 8×.'],
      },
      themeDark: 'Switch to dark mode', themeLight: 'Switch to light mode', heroShotAlt: 'The Today page of the Nest app', pricingLink: 'See pricing', demoOnly: 'The demo does not connect real accounts. Sign in to connect yours.', shotAlt: 'Nest app screen: {name}',
    },
  },
};
function deepMerge(a, b) {
  for (const k of Object.keys(b)) {
    if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) deepMerge(a[k], b[k]);
    else a[k] = b[k];
  }
  return a;
}
deepMerge(STRINGS, EXTRA);
// Waitlist for paid plans (payments are not live).
const WAITLIST = {
  'zh-Hant': {
    waitlist: {
      join: '加入等候名單', joined: '已加入等候名單', title: '加入 {plan} 等候名單',
      sub: '付費方案尚未推出。留下電郵，推出時我們會通知你。現在不會收取任何費用。',
      email: '電郵', plan: '方案', note: '備註（可選）', notePh: '例如：家中有幾位成員、最想要的功能',
      submit: '加入等候名單', done: '已加入等候名單', doneSub: '多謝支持！{plan} 推出時，我們會以電郵通知 {email}。',
      already: '此電郵已在 {plan} 等候名單上。', badEmail: '請輸入有效的電郵地址。', rate: '提交次數太多，請稍後再試。',
      fail: '暫時未能加入等候名單，請稍後再試。', privacy: '我們只會用此電郵通知你方案推出，不會用作其他用途。',
      card: '付費方案', cardSub: 'Starter 及 Pro 即將推出。加入等候名單，推出時會收到通知。',
    },
  },
  en: {
    waitlist: {
      join: 'Join waitlist', joined: 'On the waitlist', title: 'Join the {plan} waitlist',
      sub: 'Paid plans are not live yet. Leave your email and we will let you know when they launch. Nothing is charged.',
      email: 'Email', plan: 'Plan', note: 'Note (optional)', notePh: 'e.g. family size, the feature you want most',
      submit: 'Join waitlist', done: 'You are on the waitlist', doneSub: 'Thank you! We will email {email} when {plan} launches.',
      already: 'This email is already on the {plan} waitlist.', badEmail: 'Please enter a valid email address.', rate: 'Too many tries. Please wait a moment.',
      fail: 'Could not join the waitlist right now. Please try again later.', privacy: 'We only use this email to tell you when the plan launches.',
      card: 'Paid plans', cardSub: 'Starter and Pro are coming soon. Join the waitlist to hear when they launch.',
    },
  },
};
deepMerge(STRINGS, WAITLIST);

// Connections v7 (one consent for every service, missing-permission state, diagnostics), chat stop/retry, AI card reload.
const V7 = {
  'zh-Hant': {
    connections: {
      partial: '部分已授權', missing: '缺少權限：{list}', grantMissing: '補授權',
      missingNote: '{email} 未授權 {list}。請按「補授權」，並在 Google 頁面勾選所有項目。',
      stillMissing: '{email} 已連接，但仍未授權：{list}。請再按「補授權」，並在 Google 頁面勾選所有項目。',
      diagnose: '檢查連接', notGranted: '未授權此權限',
      sessionNote: '需要重新授權一次，之後會保持連接。',
    },
    agent: {
      stop: '停止', stopped: '已停止回覆。', stalled: '回覆中斷了（網絡或 AI 暫時沒有回應）。', interrupted: '（回覆未完成）', reload: '重新讀取',
      errors: { missing_scope: '此帳戶未授權這項服務，請到「連接」頁面按「補授權」。', stalled: '回覆中斷了，請按「重試」。' },
    },
    home: {
      regenerate: '重新生成', regenerating: '正在重新生成…', reloadFailed: '未能更新，請按「重新生成」再試。',
      noConnectedData: '未能讀取已連接帳戶的資料，請到「連接」頁面檢查。', inboxAdded: '新增了 {n} 項建議。', inboxNothingNew: '已重新檢查，暫時沒有新事項。',
    },
  },
  en: {
    connections: {
      partial: 'Partly authorised', missing: 'Missing permission: {list}', grantMissing: 'Grant missing permissions',
      missingNote: '{email} has not allowed {list}. Tap "Grant missing permissions" and tick every box on the Google screen.',
      stillMissing: '{email} is connected but still has not allowed: {list}. Tap "Grant missing permissions" again and tick every box on the Google screen.',
      diagnose: 'Check connections', notGranted: 'permission not granted',
      sessionNote: 'Needs re-authorising once; after that it stays connected.',
    },
    agent: {
      stop: 'Stop', stopped: 'Reply stopped.', stalled: 'The reply was interrupted (the network or AI stopped responding).', interrupted: '(reply incomplete)', reload: 'Reload',
      errors: { missing_scope: 'This account has not allowed this service. Tap "Grant missing permissions" on the Connections page.', stalled: 'The reply was interrupted. Tap Retry.' },
    },
    home: {
      regenerate: 'Regenerate', regenerating: 'Regenerating…', reloadFailed: 'Could not update. Tap Regenerate to try again.',
      noConnectedData: 'Could not read your connected accounts. Check the Connections page.', inboxAdded: 'Added {n} suggestions.', inboxNothingNew: 'Checked again — nothing new right now.',
    },
  },
};
deepMerge(STRINGS, V7);

// Calendar tab (2026-10-18): unified Google + Apple (iCloud) + family calendars.
const CAL = {
  'zh-Hant': {
    app: { nav: { calendar: '日曆' } },
    calendar: {
      title: '日曆', sub: '全家已連接的日曆集中在一處，以香港時間顯示。',
      newEvent: '新增活動', today: '今天', prev: '上一個', next: '下一個', refresh: '重新整理',
      views: { day: '日', week: '週', month: '月' },
      weekdays: ['一', '二', '三', '四', '五', '六', '日'],
      allDay: '全日', more: '另外 {n} 項', noEvents: '這段時間沒有活動。', loading: '正在載入日曆…',
      calendars: '日曆', show: '顯示', hide: '隱藏', readOnly: '唯讀', family: '家人', you: '你',
      sources: { google: 'Google', apple: 'iCloud', family: '家人' },
      empty: '尚未連接任何日曆。連接 Google 或 Apple 日曆後，全家的活動會在這裏顯示。',
      connectGoogle: '連接 Google 日曆', connectApple: '連接 Apple 日曆', manage: '管理連接',
      needWrite: '{email} 目前只可讀取。如要在 Nest 新增或修改活動，請按「補授權」並在 Google 頁面勾選「查看及編輯所有日曆的活動」。',
      grantWrite: '補授權', reauth: '{email} 需要重新授權。', reconnect: '重新授權',
      appleAuthFail: '{email}：Apple 拒絕了登入資料（App 專用密碼可能已被撤銷），請重新連接。',
      sourceErr: '{src} 暫時未能載入：{detail}', calErr: '部分日曆未能載入：{list}',
      // event detail / form
      when: '時間', where: '地點', notes: '備註', calendar: '日曆', titleLabel: '標題', titlePh: '例如：家長日',
      start: '開始', end: '結束', location: '地點', locationPh: '可選', notesPh: '可選',
      save: '儲存', create: '新增', edit: '編輯', delete: '刪除', cancel: '取消',
      deleteTitle: '刪除活動？', deleteBody: '「{title}」會從 {cal} 刪除，所有已同步的裝置都會看到這個變更。',
      deleteRecurring: '這是重複活動：只會刪除這一次。',
      recurringNote: '重複活動：在 Nest 修改只會影響這一次。', appleRecurringNote: 'Apple 重複活動暫時只可在 Apple 日曆修改。',
      readOnlyNote: '此活動唯讀（來自家人分享、訂閱日曆，或帳戶未授權編輯）。',
      openGoogle: '在 Google 日曆開啟',
      created: '已新增活動', updated: '已更新活動', deleted: '已刪除活動',
      noWritable: '沒有可編輯的日曆。請先為 Google 帳戶「補授權」編輯權限，或連接 Apple 日曆。',
      badTime: '結束時間不可早於開始時間。', needTitle: '請輸入標題。',
      errors: {
        write_scope_missing: '此 Google 帳戶未授權編輯日曆，請按「補授權」。', reauth: '此帳戶需要重新授權。',
        google_forbidden: 'Google 拒絕了這項操作（你可能沒有此日曆的編輯權限）。', not_found: '找不到這個活動，可能已在其他裝置刪除。',
        apple_conflict: '活動已在其他裝置被修改，請重新整理後再試。', apple_recurring: 'Apple 重複活動暫時只可在 Apple 日曆修改。',
        apple_auth: 'Apple 拒絕了登入資料，請重新連接 Apple 日曆。', timeout: '連線逾時，請稍後再試。', generic: '暫時未能完成，請稍後再試。',
      },
      // family sharing
      share: '與家人分享我的日曆', shareSub: '家人會在他們的「日曆」看到你未來 60 天的活動標題及時間（唯讀）。',
      shareOn: '已與家人分享', shareFail: '家庭日曆分享需要先更新資料庫規則（calendarShare），目前只顯示你自己的日曆。',
      familyNone: '家人連接並分享日曆後，他們的活動會在這裏顯示。', sharedBy: '{name} 分享', updatedAt: '更新於 {when}',
    },
    apple: {
      title: '連接 Apple 日曆', sub: '以 iCloud CalDAV 連接。請使用「App 專用密碼」，不是你的 Apple ID 密碼。',
      appleId: 'Apple ID（電郵）', appleIdPh: 'name@icloud.com', password: 'App 專用密碼', passwordPh: 'xxxx-xxxx-xxxx-xxxx',
      howTitle: '如何取得 App 專用密碼', how: ['前往 appleid.apple.com 並登入。', '選擇「登入與安全性」→「App 專用密碼」。', '按「+」或「產生 App 專用密碼」，輸入名稱（例如 Nest）。', '複製顯示的密碼（格式 xxxx-xxxx-xxxx-xxxx），貼在這裏。'],
      privacy: '密碼會在伺服器加密保存，Nest 不會再顯示或傳回。你可隨時在這裏中斷連接，或在 appleid.apple.com 撤銷此密碼。',
      connect: '連接', connecting: '正在驗證…', connected: '已連接 {email}（{n} 個日曆）', disconnect: '中斷連接', disconnected: '已中斷 Apple 日曆',
      accounts: 'Apple 日曆帳戶', none: '尚未連接 Apple 日曆。', calCount: '{n} 個日曆',
      errors: {
        apple_auth: 'Apple 拒絕了登入資料。請確認 Apple ID 正確，並使用新的「App 專用密碼」（不是 Apple ID 密碼）。已開啟雙重認證的帳戶才可產生 App 專用密碼。',
        apple_bad_id: '請輸入有效的 Apple ID 電郵。', apple_bad_password: 'App 專用密碼格式不正確（應為 xxxx-xxxx-xxxx-xxxx）。',
        apple_discovery: '已登入 iCloud，但找不到日曆。請確認此 Apple ID 已在 iCloud 開啟「日曆」。', apple_timeout: 'iCloud 回應逾時，請稍後再試。',
        apple_network: '未能連接 iCloud，請稍後再試。', store_failed: '已驗證，但未能儲存連接，請再試一次。', generic: '暫時未能連接 Apple 日曆，請稍後再試。',
      },
    },
  },
  en: {
    app: { nav: { calendar: 'Calendar' } },
    calendar: {
      title: 'Calendar', sub: 'Every connected calendar in your family in one place, in Hong Kong time.',
      newEvent: 'New event', today: 'Today', prev: 'Previous', next: 'Next', refresh: 'Refresh',
      views: { day: 'Day', week: 'Week', month: 'Month' },
      weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      allDay: 'All day', more: '+{n} more', noEvents: 'Nothing scheduled in this period.', loading: 'Loading calendars…',
      calendars: 'Calendars', show: 'Show', hide: 'Hide', readOnly: 'Read-only', family: 'Family', you: 'You',
      sources: { google: 'Google', apple: 'iCloud', family: 'Family' },
      empty: 'No calendars connected yet. Connect Google or Apple Calendar and your family’s events will show up here.',
      connectGoogle: 'Connect Google Calendar', connectApple: 'Connect Apple Calendar', manage: 'Manage connections',
      needWrite: '{email} is read-only for now. To add or change events from Nest, tap “Grant access” and tick “See and edit events on all your calendars” on the Google screen.',
      grantWrite: 'Grant access', reauth: '{email} needs re-authorising.', reconnect: 'Re-authorise',
      appleAuthFail: '{email}: Apple rejected the sign-in (the app-specific password may have been revoked). Please reconnect.',
      sourceErr: '{src} could not be loaded: {detail}', calErr: 'Some calendars could not be loaded: {list}',
      when: 'When', where: 'Where', notes: 'Notes', calendar: 'Calendar', titleLabel: 'Title', titlePh: 'e.g. Parents’ day',
      start: 'Starts', end: 'Ends', location: 'Location', locationPh: 'Optional', notesPh: 'Optional',
      save: 'Save', create: 'Add', edit: 'Edit', delete: 'Delete', cancel: 'Cancel',
      deleteTitle: 'Delete event?', deleteBody: '“{title}” will be deleted from {cal} on every synced device.',
      deleteRecurring: 'This is a repeating event: only this occurrence is deleted.',
      recurringNote: 'Repeating event: changes made in Nest apply to this occurrence only.', appleRecurringNote: 'Repeating Apple events can only be changed in Apple Calendar for now.',
      readOnlyNote: 'This event is read-only (shared by family, a subscribed calendar, or the account has not allowed editing).',
      openGoogle: 'Open in Google Calendar',
      created: 'Event added', updated: 'Event updated', deleted: 'Event deleted',
      noWritable: 'No editable calendar. Grant edit access to a Google account first, or connect Apple Calendar.',
      badTime: 'The end cannot be before the start.', needTitle: 'Please enter a title.',
      errors: {
        write_scope_missing: 'This Google account has not allowed editing calendars. Tap “Grant access”.', reauth: 'This account needs re-authorising.',
        google_forbidden: 'Google refused this change (you may not have edit rights on this calendar).', not_found: 'This event no longer exists — it may have been deleted on another device.',
        apple_conflict: 'The event was changed on another device. Refresh and try again.', apple_recurring: 'Repeating Apple events can only be changed in Apple Calendar for now.',
        apple_auth: 'Apple rejected the sign-in. Please reconnect Apple Calendar.', timeout: 'The connection timed out. Please try again.', generic: 'Could not complete that right now. Please try again.',
      },
      share: 'Share my calendar with family', shareSub: 'Family members see the titles and times of your next 60 days of events in their Calendar (read-only).',
      shareOn: 'Shared with family', shareFail: 'Family calendar sharing needs the updated database rules (calendarShare) first. Showing your own calendars only.',
      familyNone: 'When family members connect and share their calendars, their events show up here.', sharedBy: 'Shared by {name}', updatedAt: 'updated {when}',
    },
    apple: {
      title: 'Connect Apple Calendar', sub: 'Connects over iCloud CalDAV. Use an app-specific password, not your Apple ID password.',
      appleId: 'Apple ID (email)', appleIdPh: 'name@icloud.com', password: 'App-specific password', passwordPh: 'xxxx-xxxx-xxxx-xxxx',
      howTitle: 'How to get an app-specific password', how: ['Go to appleid.apple.com and sign in.', 'Choose Sign-In and Security → App-Specific Passwords.', 'Tap “+” / Generate an app-specific password and name it (e.g. Nest).', 'Copy the password shown (xxxx-xxxx-xxxx-xxxx) and paste it here.'],
      privacy: 'The password is encrypted on the server and never shown or sent back. Disconnect here any time, or revoke it at appleid.apple.com.',
      connect: 'Connect', connecting: 'Checking…', connected: 'Connected {email} ({n} calendars)', disconnect: 'Disconnect', disconnected: 'Apple Calendar disconnected',
      accounts: 'Apple Calendar accounts', none: 'No Apple Calendar connected yet.', calCount: '{n} calendars',
      errors: {
        apple_auth: 'Apple rejected these details. Check the Apple ID and use a new app-specific password (not your Apple ID password). App-specific passwords need two-factor authentication turned on.',
        apple_bad_id: 'Please enter a valid Apple ID email.', apple_bad_password: 'That does not look like an app-specific password (xxxx-xxxx-xxxx-xxxx).',
        apple_discovery: 'Signed in to iCloud but no calendars were found. Make sure Calendars is turned on in iCloud for this Apple ID.', apple_timeout: 'iCloud took too long to answer. Please try again.',
        apple_network: 'Could not reach iCloud. Please try again.', store_failed: 'Verified, but the connection could not be saved. Please try again.', generic: 'Could not connect Apple Calendar right now. Please try again.',
      },
    },
  },
};
deepMerge(STRINGS, CAL);

// Native-style More page + account menu (2026-10-18).
const MORE = {
  'zh-Hant': {
    more: { title: '更多', study: '學習', family: '家庭', account: '帳戶', back: '更多' },
    acct: {
      menu: '帳戶選單', profile: '個人資料', family: '家庭', familySub: '成員及邀請', connections: '連接帳戶', usage: '用量及方案',
      settings: '設定', language: '語言', help: '幫助及意見回饋', signOut: '登出',
    },
  },
  en: {
    more: { title: 'More', study: 'Study', family: 'Family', account: 'Account', back: 'More' },
    acct: {
      menu: 'Account menu', profile: 'Profile', family: 'Family', familySub: 'Members & invites', connections: 'Connected accounts', usage: 'Usage & plan',
      settings: 'Settings', language: 'Language', help: 'Help & feedback', signOut: 'Sign out',
    },
  },
};
deepMerge(STRINGS, MORE);

// Beta promo (2026-10-18): /beta — first 10 families get Pro free for a month, whole family, no card.
const PROMO = {
  'zh-Hant': {
    promo: {
      tag: 'Nest 測試版', title: '首 10 個家庭，免費享用 Pro 一個月。',
      sub: '多謝你參與 Nest 測試版。首 10 個登記的家庭可免費使用 Pro 一個月，全家每位成員都適用，毋須信用卡。',
      fullTitle: '測試版優惠已滿額。', fullSub: '首 10 個名額已全部送出。你仍可免費註冊 Nest，使用免費方案。',
      slotsLeft: '尚餘 {n} / {max} 個名額', slotsUnknown: '名額有限，先到先得',
      cta: '註冊', haveAccount: '我已有帳戶，登入', finishSetup: '完成設定', claimBtn: '領取 Pro 一個月', testIneligible: '測試及系統帳戶不能領取測試版優惠。', notNow: '暫時不用',
      fine: '註冊或登入並建立家庭後，回到此頁按「領取 Pro 一個月」。毋須信用卡，一個月後自動回到免費方案，不會收費。',
      fineSignedIn: '按「領取 Pro 一個月」為整個家庭領取（每個家庭及每個帳戶只限一次）。毋須信用卡，一個月後自動回到免費方案。',
      claimed: '已領取！你的家庭可免費使用 Pro，直至 {date}。', already: '你的家庭已領取測試版禮物，Pro 有效至 {date}。',
      alreadyUser: '你的帳戶已為另一個家庭領取過此優惠。', error: '暫時未能領取，請稍後重新整理此頁。',
      claimedToast: '🎁 已領取：全家免費使用 Pro 一個月', fullToast: '測試版優惠已滿額',
      banner: '🎁 測試版禮物：全家免費使用 Pro，直至 {date}', bannerGrant: '全家已解鎖 Pro，直至 {date}',
      points: {
        family: ['全家適用', '家中每位成員都享有 Pro 用量。'],
        card: ['毋須信用卡', '不會收取任何費用。'],
        revert: ['一個月後自動結束', '到期後回到免費方案，資料全部保留。'],
      },
    },
  },
  en: {
    promo: {
      tag: 'Nest beta', title: 'First 10 families get Pro free for a month.',
      sub: 'Thanks for trying the Nest beta. The first 10 families to join get Pro free for one month, for every member of the family. No card needed.',
      fullTitle: 'The beta offer is full.', fullSub: 'All 10 beta spots have been claimed. You can still sign up for Nest free.',
      slotsLeft: '{n} of {max} spots left', slotsUnknown: 'Limited spots, first come first served',
      cta: 'Sign up', haveAccount: 'I have an account', finishSetup: 'Finish setup', claimBtn: 'Claim Pro', testIneligible: 'Test and system accounts can’t claim the beta offer.', notNow: 'Not now',
      fine: 'Sign up or sign in and create your family, then come back here and press Claim Pro. No card. It ends by itself after a month, with no charge.',
      fineSignedIn: 'Press Claim Pro to claim for your whole family (once per family and per account). No card; back to Free after a month.',
      claimed: 'Claimed! Your family has Pro free until {date}.', already: 'Your family already has the beta gift. Pro until {date}.',
      alreadyUser: 'Your account already claimed this offer for another family.', error: 'Could not claim right now. Please refresh this page in a moment.',
      claimedToast: '🎁 Claimed: Pro free for your family for a month', fullToast: 'The beta offer is full',
      banner: '🎁 Beta gift: Pro free for your family until {date}', bannerGrant: 'Pro unlocked for your family until {date}',
      points: {
        family: ['Whole family', 'Every member gets Pro usage.'],
        card: ['No card', 'Nothing is charged.'],
        revert: ['Ends by itself', 'Back to Free after a month. Your data stays.'],
      },
    },
  },
};
deepMerge(STRINGS, PROMO);

// Calendar polish (2026-10-18): compact notices.
deepMerge(STRINGS, {
  'zh-Hant': { calendar: { readOnlyChip: '{email} 只可讀取', dismiss: '隱藏' } },
  en: { calendar: { readOnlyChip: '{email} is read-only', dismiss: 'Dismiss' } },
});

// Connections redesign (2026-10-18).
deepMerge(STRINGS, {
  'zh-Hant': {
    conn2: {
      lead: '連接帳戶，讓 Nest 讀取通告、日程及功課。只作讀取，授權加密保存，換新裝置登入後自動恢復。',
      services: '服務', off: '未連接', needsAuth: '需要授權', missingScope: '未授權此服務', remove: '移除',
      pickHint: '剔選要用於此服務的帳戶。可同時使用多個帳戶。', next7: '未來 7 天', noEvents7: '未來 7 天沒有活動。',
      appleAnother: '連接另一個 Apple ID',
    },
  },
  en: {
    conn2: {
      lead: 'Connect accounts so Nest can read notices, events and homework. Read-only, stored encrypted, restored automatically on a new device.',
      services: 'Services', off: 'Off', needsAuth: 'Needs access', missingScope: 'Not authorised for this service', remove: 'Remove',
      pickHint: 'Tick the accounts to use for this service. You can use more than one.', next7: 'Next 7 days', noEvents7: 'No events in the next 7 days.',
      appleAnother: 'Connect another Apple ID',
    },
  },
});

// Profile picture + admin entry (2026-10-18).
const PFP = {
  'zh-Hant': {
    pfp: {
      title: '個人相片', hint: '家人會在提醒、家庭成員及選單中看到這張相片。', hintSet: '家人會在提醒、家庭成員及選單中看到。',
      add: '加入相片', change: '更換相片', remove: '移除相片', takePhoto: '拍照', choose: '從相簿選擇',
      cropTitle: '調整相片', cropHint: '拖動以移動，捏合或拉動滑桿以縮放。', use: '使用相片', another: '換另一張',
      saved: '已更新個人相片', savedOnlyMe: '已儲存，但家人暫時未能看到（資料庫規則未更新）。', removed: '已移除個人相片',
      badFile: '無法讀取這張相片，請選擇 JPEG、PNG 或 HEIC 相片。',
    },
    admin: {
      entry: '管理後台', entrySub: '只有你看到', card: '管理後台', open: '開啟', users: '用戶', families: '家庭', beta: 'Beta 名額', betaClaimed: '已領取 {c}/{m} · 尚餘 {r}',
      limited: '有限模式：只計算開啟過 Nest 的用戶。', loadFail: '未能載入管理數據。',
    },
  },
  en: {
    pfp: {
      title: 'Profile photo', hint: 'Your family sees it on reminders, the family list and menus.', hintSet: 'Your family sees it on reminders, the family list and menus.',
      add: 'Add photo', change: 'Change photo', remove: 'Remove photo', takePhoto: 'Take photo', choose: 'Choose from library',
      cropTitle: 'Adjust photo', cropHint: 'Drag to move. Pinch or use the slider to zoom.', use: 'Use photo', another: 'Choose another',
      saved: 'Profile photo updated', savedOnlyMe: 'Saved, but your family can’t see it yet (database rules not updated).', removed: 'Profile photo removed',
      badFile: 'Couldn’t read that photo. Try a JPEG, PNG or HEIC image.',
    },
    admin: {
      entry: 'Admin', entrySub: 'Only visible to you', card: 'Admin', open: 'Open', users: 'Users', families: 'Families', beta: 'Beta slots', betaClaimed: '{c}/{m} claimed · {r} left',
      limited: 'Limited mode: counts users who have opened Nest.', loadFail: 'Couldn’t load admin numbers.',
    },
  },
};
deepMerge(STRINGS, PFP);

// Automation + Hong Kong local + grouped 今日摘要 (2026-10-18).
deepMerge(STRINGS, {
  'zh-Hant': {
    today: {
      all: '全部', urgent: '需要留意', refresh: '重新整理', empty: '今天暫時沒有要處理的事項。', aiSummary: 'AI 文字摘要',
      showAll: '顯示全部（{n}）', showLess: '收起', unread: '未讀', needsReply: '需要回覆', detected: '自動偵測',
      cat: { weather: '天氣及警告', notices: '學校通告', bills: '帳單及費用', school: '功課及測驗', calendar: '日程', family: '家庭事項', transport: '交通', gmail: 'Gmail', drive: 'Drive' },
      tag: { overdue: '已逾期', inDays: '{n} 天後' },
      rain: '降雨概率', mins: '{n} 分', min: '分', noEta: '暫時未有班次資料', leaveAt: '{time} 出門',
      goOut: '出門', leaveNow: '現在出門', leaveIn: '{n} 分鐘後出門（{time}）', late: '未能於 {time} 前到達，請盡早出門', catch: '趕 {time} 的 {what}', editRoutes: '更改路線',
      hko: '天文台', edb: '教育局上課安排',
      kind: { notice: '學校通告', bill: '帳單及費用', test: '測驗／默書', homework: '功課', ai: '建議' },
      accept: '接受', paid: '已繳付', addBillReminders: '加入提醒', markedPaid: '已標示為已繳付', dismissed: '已略過',
      pay: '繳付', billAdded: '已加入 {n} 個繳費提醒', revise: '溫習：', finish: '完成：', calFailed: '未能加入 Google 日曆，已建立 Nest 提醒。',
      payee: '收款方', titleLabel: '事項', dueDate: '到期日', date: '日期', testDate: '測驗／限期日期', amount: '金額', time: '時間',
      signer: '負責簽署／回覆', signerHint: '提醒會指派給這位家長。', addToGoogle: '同時加入 Google 日曆（{email}）',
      billPlan: '會在到期前 {n} 天及前一天提醒', billHasReminders: '已設定繳費提醒', revisePlan: '會在前一晚 7 時提醒溫習。',
      openEmail: '開啟電郵', openClassroom: '開啟 Classroom',
      nudgeTest: '明天測驗／默書', nudgeHw: '明天要交功課', revisedYet: '溫習了嗎？', doneYet: '完成了嗎？',
      yesRevised: '溫習了', yesDone: '完成了', notYet: '還沒有', in1h: '1 小時後提醒', at9: '今晚 9 時', at7: '明早 7 時', great: '做得好！',
    },
    hkset: {
      title: '出門及交通', lead: '在主頁顯示巴士及港鐵的下一班時間，並建議出門時間。資料來自九巴、城巴及港鐵開放數據。',
      add: '加入車站', added: '已加入', walk: '步行到車站', walkHint: '分鐘，用來計算出門時間。', mins: '分鐘',
      arriveBy: '最遲到達時間', arriveHint: '可選：連同車程分鐘，建議最遲要趕的班次。', journey: '車程分鐘',
      pickTitle: '加入車站', routePh: '路線號碼，例如 87K', stopPh: '搜尋車站名稱', from: '由 {place} 開出', special: '特別班次',
      noRoute: '找不到這條路線。', loadFail: '暫時未能載入，請稍後再試。', disrupted: '服務受阻',
    },
    hkcal: { connectChip: '連接日曆以查看更多活動', connect: '連接' },
    push: {
      keys: { notifyWarnings: '天氣警告', notifyNotices: '學校通告及帳單偵測', notifyBills: '帳單到期', billLead: '提早提醒' },
      hints: {
        notifyWarnings: '颱風、暴雨等新警告發出時通知全家。八號風球及黑雨在靜音時段亦會通知。',
        notifyNotices: '從 Gmail 及 Classroom 找到新通告、回條、測驗或帳單時，在早上摘要中提及。',
        notifyBills: '到期前數天及前一天早上提醒。', billLead: '第一次繳費提醒在到期前幾天。',
      },
      leadDays: '{n} 天前',
    },
  },
  en: {
    today: {
      all: 'All', urgent: 'Needs attention', refresh: 'Refresh', empty: 'Nothing to handle today.', aiSummary: 'AI written summary',
      showAll: 'Show all ({n})', showLess: 'Show less', unread: 'Unread', needsReply: 'Needs a reply', detected: 'detected',
      cat: { weather: 'Weather & alerts', notices: 'School notices', bills: 'Bills & fees', school: 'School work', calendar: 'Calendar', family: 'Family tasks', transport: 'Transport', gmail: 'Gmail', drive: 'Drive' },
      tag: { overdue: 'Overdue', inDays: 'In {n} days' },
      rain: 'Rain', mins: '{n} min', min: 'min', noEta: 'No departures right now', leaveAt: 'Leave {time}',
      goOut: 'Going out', leaveNow: 'Leave now', leaveIn: 'Leave in {n} min ({time})', late: 'You can’t make {time} — leave as soon as you can', catch: 'Catch the {time} {what}', editRoutes: 'Change routes',
      hko: 'HKO', edb: 'EDB school arrangements',
      kind: { notice: 'School notice', bill: 'Bill or fee', test: 'Test / dictation', homework: 'Homework', ai: 'Suggestion' },
      accept: 'Accept', paid: 'Paid', addBillReminders: 'Add reminders', markedPaid: 'Marked as paid', dismissed: 'Dismissed',
      pay: 'Pay', billAdded: '{n} payment reminder(s) added', revise: 'Revise: ', finish: 'Finish: ', calFailed: 'Couldn’t add to Google Calendar — the Nest reminder was created.',
      payee: 'Payee', titleLabel: 'What', dueDate: 'Due date', date: 'Date', testDate: 'Test / due date', amount: 'Amount', time: 'Time',
      signer: 'Who signs / replies', signerHint: 'The reminder goes to this parent.', addToGoogle: 'Also add to Google Calendar ({email})',
      billPlan: 'Reminds you {n} days before and the day before', billHasReminders: 'Payment reminders set', revisePlan: 'Reminds you to revise at 7 pm the evening before.',
      openEmail: 'Open email', openClassroom: 'Open Classroom',
      nudgeTest: 'Test tomorrow', nudgeHw: 'Homework due tomorrow', revisedYet: 'Revised yet?', doneYet: 'Done yet?',
      yesRevised: 'Revised', yesDone: 'Done', notYet: 'Not yet', in1h: 'In 1 hour', at9: '9 pm tonight', at7: '7 am tomorrow', great: 'Nice work!',
    },
    hkset: {
      title: 'Going out & transport', lead: 'Show the next buses and trains on Home with a suggested time to leave. Data: KMB, Citybus and MTR open data.',
      add: 'Add a stop', added: 'Added', walk: 'Walk to the stop', walkHint: 'Minutes — used for the leave time.', mins: 'min',
      arriveBy: 'Arrive by', arriveHint: 'Optional: with the journey minutes, picks the latest departure you can take.', journey: 'Journey minutes',
      pickTitle: 'Add a stop', routePh: 'Route number, e.g. 87K', stopPh: 'Search stops', from: 'From {place}', special: 'Special departures',
      noRoute: 'No such route.', loadFail: 'Couldn’t load right now — try again soon.', disrupted: 'Disrupted',
    },
    hkcal: { connectChip: 'Connect a calendar to see more', connect: 'Connect' },
    push: {
      keys: { notifyWarnings: 'Weather warnings', notifyNotices: 'School notices & bills found', notifyBills: 'Bills due', billLead: 'First reminder' },
      hints: {
        notifyWarnings: 'Typhoon, rainstorm and other new warnings, sent to the whole family. Signal 8 and Black Rain come through even in quiet hours.',
        notifyNotices: 'Mentioned in the morning brief when new notices, reply slips, tests or bills are found in Gmail and Classroom.',
        notifyBills: 'In the morning a few days before and the day before.', billLead: 'How many days before the due date.',
      },
      leadDays: '{n} days before',
    },
  },
});
deepMerge(STRINGS, { 'zh-Hant': { calendar: { sources: { hk: '香港', nest: 'Nest', region: '本地' } } }, en: { calendar: { sources: { hk: 'Hong Kong', nest: 'Nest', region: 'Local' } } } });

// Admin panel /admin (bilingual, 2026-10-18).
deepMerge(STRINGS, {
  'zh-Hant': { adm: {
    title: '管理後台', refresh: '重新整理', full: '完整模式', limited: '有限模式', loadFail: '未能載入', nf: '找不到此頁面。', goNest: '返回 Nest',
    tabs: { overview: '總覽', users: '用戶', families: '家庭', beta: 'Beta 推廣', log: '管理紀錄' },
    noteFull: '完整模式：透過服務帳戶列出所有 Firebase 用戶及家庭。', noteLimited: '有限模式：未設定 FIREBASE_SERVICE_ACCOUNT。只列出管理後台推出（2026-10-18）後開啟過 Nest 的用戶；停用只會封鎖 Nest AI（不影響 Firebase 登入）。',
    users: '用戶', families: '家庭', dau: '每日活躍', wau: '每週活躍', todayHkt: '今天（香港時間）', last7: '過去 7 天', activeFamilies: '活躍家庭', betaClaimed: 'Beta 已領取',
    signups: '每日新註冊', aiPerDay: '每日 AI 訊息', in30: '30 天內共 {n}', featureUsage: '功能使用量', countsOnly: '只計數量',
    f: { ai30: 'AI 訊息（30 天）', chat: '· 對話／助理', tutor: '· 功課導師', quiz: '· 測驗', brief: '· 每日摘要', memory: '· 記憶問答', inbox: '· 主動掃描', reminders: '提醒（所有家庭）', memories: '記憶項目（所有家庭）' },
    connections: '連接', usersLower: '用戶', appleAccounts: 'Apple 日曆（帳戶）', paidConv: '付費轉換', payNotLive: '付款未啟用', payingFamilies: '付費家庭', conversion: '付費轉換率',
    wlStarter: '輪候名單 · Starter', wlPro: '輪候名單 · Pro', sinceNote: 'AI 訊息及輪候名單由 {date} 開始計算。Nest 沒有接入任何付款服務。',
    done: '已完成', failed: '失敗：{code}', searchPh: '搜尋姓名、電郵、家庭…',
    th: { user: '用戶', signedUp: '註冊日期', lastActive: '最後活動', family: '家庭', plan: '計劃', signIn: '登入方式', members: '成員', expiry: '贈送／授予到期', claimedBy: '領取者', claimed: '領取時間', expires: '到期', time: '時間（香港）', who: '操作者', action: '操作', target: '對象', detail: '詳情' },
    disabledPill: '已停用', testPill: '測試', noUsers: '沒有用戶。', email: '電郵', userId: '用戶 ID', provider: '登入方式', lastSignIn: '最後登入', effectivePlan: '生效計劃', proBeta: 'Pro（Beta 贈送）', proGranted: 'Pro（管理員授予）', betaGift: 'Beta 贈送',
    none: '沒有', waitlist: '輪候名單', status: '狀態', statusDisabled: '已停用', statusActive: '使用中',
    enable: '啟用用戶', disable: '停用用戶', enableQ: '啟用此用戶？', disableQ: '停用此用戶？',
    enableBodyFull: '啟用 {email}。對方可以再次登入 Firebase，並可使用 AI。', enableBodyLimited: '啟用 {email}。對方可以再次使用 AI。',
    disableBodyFull: '停用 {email}。Firebase 會拒絕對方登入及更新權杖，Nest 亦會拒絕 AI 請求。', disableBodyLimited: '停用 {email}。有限模式：Nest 會拒絕對方的 AI 請求；在設定服務帳戶前，對方仍可登入 Firebase。',
    notSeen: '（尚未出現）', ended: '已於 {date} 結束', noFamilies: '沒有家庭。', familyId: '家庭 ID', owner: '擁有人', ownPlan: '自身計劃', proUntil: 'Pro 直至', notClaimed: '未領取', grantUntil: '管理員授予直至',
    reminders: '提醒', memoryItems: '記憶項目', untilLabel: '直至（香港日期）',
    grant: '授予 Pro', grantQ: '授予 Pro？', grantBody: '讓 {name} 每位成員使用 Pro，直至 {date} 23:59（香港時間）。',
    extend: '延長 Beta 贈送', extendQ: '延長 Beta 贈送？', extendBody: '把 {name} 的 Beta 贈送結束日期設為 {date} 23:59（香港時間）。',
    revoke: '撤銷 Pro', revokeQ: '撤銷 Pro？', revokeBody: '移除 {name} 的管理員授予，家庭回到 {plan}。', revokeBodyBeta: '移除 {name} 的管理員授予並立即結束 Beta 贈送（名額仍算已用），家庭回到 {plan}。',
    plan: { free: '免費', starter: 'Starter', pro: 'Pro' },
    claimedLeft: '已領取 {c}/{m} · 尚餘 {r}', link: '連結：', betaDesc: '全家免費使用 Pro 一個月。', activePill: '生效中', endedPill: '已結束', noClaims: '暫時未有人領取。',
    latest300: '最近 300 項', noLog: '暫時未有管理操作。',
    justNow: '剛剛', minAgo: '{n} 分鐘前', hAgo: '{n} 小時前', dAgo: '{n} 天前',
    act: { grant: '授予 Pro', revoke: '撤銷 Pro', extend: '延長 Beta', disable: '停用', enable: '啟用' },
    log: { proUntil: 'Pro 直至 {date}', betaUntil: 'Beta 贈送直至 {date}', revoked: '已撤銷 Pro', revokedBeta: '已撤銷 Pro（Beta 贈送即時結束，名額仍算已用）', disabled: '已停用', enabled: '已啟用', authAndAi: 'Firebase 登入及 Nest AI', aiOnly: '只限 Nest AI，沒有服務帳戶' },
  } },
  en: { adm: {
    title: 'Admin', refresh: 'Refresh', full: 'Full mode', limited: 'Limited mode', loadFail: 'Could not load', nf: 'This page could not be found.', goNest: 'Go to Nest',
    tabs: { overview: 'Overview', users: 'Users', families: 'Families', beta: 'Beta promo', log: 'Admin log' },
    noteFull: 'Full mode: every Firebase Auth user and family is listed via the service account.', noteLimited: 'Limited mode: no FIREBASE_SERVICE_ACCOUNT. Lists only users who opened Nest since the admin panel launched (2026-10-18). Disable/enable only blocks AI requests in Nest (not the Firebase sign-in).',
    users: 'Users', families: 'Families', dau: 'DAU', wau: 'WAU', todayHkt: 'today (HKT)', last7: 'last 7 days', activeFamilies: 'Active families', betaClaimed: 'Beta claimed',
    signups: 'New sign-ups per day', aiPerDay: 'AI messages per day', in30: '{n} in 30 days', featureUsage: 'Feature usage', countsOnly: 'counts only',
    f: { ai30: 'AI messages (30 d)', chat: '· Chat / agent', tutor: '· Homework tutor', quiz: '· Quizzes', brief: '· Daily brief', memory: '· Memory questions', inbox: '· Inbox scans', reminders: 'Reminders (all families)', memories: 'Memory items (all families)' },
    connections: 'Connections', usersLower: 'users', appleAccounts: 'Apple Calendar (accounts)', paidConv: 'Paid conversion', payNotLive: 'Payments not live', payingFamilies: 'Paying families', conversion: 'Conversion to paid',
    wlStarter: 'Waitlist · Starter', wlPro: 'Waitlist · Pro', sinceNote: 'AI message and waitlist counts start {date}. There is no payment provider in Nest.',
    done: 'Done', failed: 'Failed: {code}', searchPh: 'Search name, email, family…',
    th: { user: 'User', signedUp: 'Signed up', lastActive: 'Last active', family: 'Family', plan: 'Plan', signIn: 'Sign-in', members: 'Members', expiry: 'Gift / grant expiry', claimedBy: 'Claimed by', claimed: 'Claimed', expires: 'Expires', time: 'Time (HKT)', who: 'Who', action: 'Action', target: 'Target', detail: 'Detail' },
    disabledPill: 'disabled', testPill: 'Test', noUsers: 'No users.', email: 'Email', userId: 'User ID', provider: 'Sign-in provider', lastSignIn: 'Last sign-in', effectivePlan: 'Effective plan', proBeta: 'Pro (beta gift)', proGranted: 'Pro (granted)', betaGift: 'Beta gift',
    none: 'none', waitlist: 'Waitlist', status: 'Status', statusDisabled: 'Disabled', statusActive: 'Active',
    enable: 'Enable user', disable: 'Disable user', enableQ: 'Enable user?', disableQ: 'Disable user?',
    enableBodyFull: 'Enable {email}. Their Firebase sign-in works again and AI requests are allowed.', enableBodyLimited: 'Enable {email}. AI requests are allowed again.',
    disableBodyFull: 'Disable {email}. Firebase Auth will refuse their sign-in and token refresh, and Nest AI requests are refused.', disableBodyLimited: 'Disable {email}. Limited mode: Nest refuses their AI requests. Their Firebase sign-in still works until a service account is set.',
    notSeen: '(not seen yet)', ended: 'ended {date}', noFamilies: 'No families.', familyId: 'Family ID', owner: 'Owner', ownPlan: 'Own plan', proUntil: 'Pro until', notClaimed: 'not claimed', grantUntil: 'Admin grant until',
    reminders: 'Reminders', memoryItems: 'Memory items', untilLabel: 'Until (Hong Kong date)',
    grant: 'Grant Pro', grantQ: 'Grant Pro?', grantBody: 'Give {name} Pro for every member until {date} 23:59 HKT.',
    extend: 'Extend beta gift', extendQ: 'Extend beta gift?', extendBody: 'Set {name}’s beta gift to end on {date} 23:59 HKT.',
    revoke: 'Revoke Pro', revokeQ: 'Revoke Pro?', revokeBody: 'Remove the admin grant for {name}. The family goes back to {plan}.', revokeBodyBeta: 'Remove the admin grant and end the beta gift now (the beta slot stays used) for {name}. The family goes back to {plan}.',
    plan: { free: 'Free', starter: 'Starter', pro: 'Pro' },
    claimedLeft: '{c}/{m} claimed · {r} left', link: 'Link: ', betaDesc: 'Pro free for one month for the whole family.', activePill: 'active', endedPill: 'ended', noClaims: 'No claims yet.',
    latest300: 'latest 300', noLog: 'No admin actions yet.',
    justNow: 'just now', minAgo: '{n} min ago', hAgo: '{n} h ago', dAgo: '{n} d ago',
    act: { grant: 'grant', revoke: 'revoke', extend: 'extend', disable: 'disable', enable: 'enable' },
    log: { proUntil: 'Pro until {date}', betaUntil: 'Beta gift until {date}', revoked: 'Pro revoked', revokedBeta: 'Pro revoked (beta gift ended now; slot stays used)', disabled: 'Disabled', enabled: 'Enabled', authAndAi: 'Firebase Auth flag + Nest AI', aiOnly: 'Nest AI only — no service account' },
  } },
});

// Native calendar, chat action cards, memory, drafts (batches 2–3, 2026-10-18).
deepMerge(STRINGS, {
  'zh-Hant': {
    adm: { f: { draft: '· 電郵回覆草稿' } },
    ncal: {
      repeat: '重複', until: '直至', untilShort: '直至 {date}', for: '對象', forHint: '只有被選的家人會收到提醒；不選即全家。', remind: '提醒',
      rep: { none: '不重複', daily: '每天', weekly: '每星期', monthly: '每月', yearly: '每年' },
      rem: { 0: '活動開始時', min: '{n} 分鐘前', hour: '{n} 小時前', day: '{n} 天前', now: '現在開始', inMin: '{n} 分鐘後', inHour: '{n} 小時後', inDay: '{n} 天後' },
      seriesNote: '修改會套用到整個重複系列。', deleteSeries: '會刪除整個重複系列。',
    },
    intent: {
      verb: { reminder: '新增提醒', event: '新增活動', task: '新增待辦', memory: '記住', shopping: '加入購物清單' },
      type: { reminder: '提醒', event: '活動', task: '待辦', memory: '記憶', shopping: '購物' },
      added: { reminder: '已新增提醒', event: '已加入 Nest 家庭日曆', task: '已新增待辦', memory: '已記住', shopping: '已加入購物清單' },
      pending: '待確認', pendingHint: '按確認即可設定。', open: { reminder: '查看提醒', event: '查看日曆', memory: '查看家庭記憶' },
      done: '已{what}', dismissed: '已略過', openForm: '填寫詳情', formTitle: '新增家庭活動', allDayHint: '留空即全日', shopPrefix: '購物：',
    },
    draft: { make: '草擬回覆', label: '回覆草稿', hint: '可自由修改；Nest 不會代你發送。', openGmail: '在 Gmail 開啟', never: '草稿不會自動發送。按「在 Gmail 開啟」會開啟新郵件視窗，由你檢查後自行發送。' },
    mem2: {
      tabs: { notes: '記事', people: '人物及資料', insights: '習慣洞察', chats: '對話記憶', me: '關於我' },
      suggTitle: 'Nest 找到 {n} 項建議', suggHint: '從對話或電郵中找到。接受前不會儲存，也不會用於 AI 回答。', keepFamily: '全家可見', keepPrivate: '只限自己', accepted: '已儲存',
      fromChat: '來自對話', fromEmail: '來自電郵', until: '至 {date}', private: '私人',
      type: { person: '人物', school: '學校', class: '興趣班', tutor: '補習', doctor: '醫生', contact: '聯絡人', allergy: '過敏', size: '尺碼', medication: '藥物', other: '其他' },
      f: { relation: '關係', phone: '電話', email: '電郵', address: '地址', schedule: '時間', birthday: '生日', note: '備註' },
      peopleTitle: '人物及資料', peopleHint: '外婆、老師、補習、醫生、過敏、尺碼、藥物等。只存在你家的空間，不會用作訓練；可設為只限自己。AI 會直接引用，不再重複問。', peopleEmpty: '暫時未有資料。',
      addEntity: '新增資料', typeLabel: '類別', about: '關於', name: '名稱', namePh: '例如：外婆、李老師、聖保羅小學', notes: '記事', addNote: '新增記事', noteHint: '例如：上次提到膝頭痛 — 提醒致電時會顯示。', notePh: '最近的情況或要記得的事',
      visibility: '可見範圍', visFamily: '全家', visPrivate: '只限自己',
      insTitle: '習慣洞察', insHint: '根據使用情況自動整理（例如常用的提醒時間、溫習難點、繳費習慣）。可修改或刪除；刪除後不會再建立。', insEmpty: '使用一段時間後會在這裏出現。',
      conf: '信心 {pct}% · {n} 次', lastSeen: '最近 {date}', edited: '已修改', editInsight: '修改洞察', insightText: '內容', editHint: '修改後只會更新信心及次數，不會覆蓋你的文字。',
      chatTitle: '對話記憶', on: '開啟', off: '關閉', chatHint: '你在對話中提到自己的事（例如「明天有重要會議」）會自動記下，只有你看到；有日期的會到期刪除。關於家人的內容會先作建議。', chatOffHint: '「記住過往對話內容」已關閉：不會讀取或新增對話記憶。', chatEmpty: '暫時沒有。', toggleIn: '在設定中更改',
      meTitle: '家人記得關於你的事', meHint: '家庭記憶中與你有關的內容，按時間排列。你可以在相應分頁修改或刪除。', meEmpty: '暫時未有關於你的記錄。', kindInsight: '洞察', kindKnowledge: '資料', kindNote: '記事',
      setting: '記住過往對話內容', settingHint: '開啟時，Nest 會從對話中記下有用的事，並在新對話中引用。關閉後不會讀取或新增。',
      lastTime: '上次：{note}',
    },
  },
  en: {
    adm: { f: { draft: '· Email reply drafts' } },
    ncal: {
      repeat: 'Repeat', until: 'Until', untilShort: 'until {date}', for: 'For', forHint: 'Only the chosen members get reminders; none = everyone.', remind: 'Reminders',
      rep: { none: 'Does not repeat', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' },
      rem: { 0: 'At start', min: '{n} min before', hour: '{n} hr before', day: '{n} day before', now: 'Starting now', inMin: 'In {n} min', inHour: 'In {n} hr', inDay: 'In {n} day(s)' },
      seriesNote: 'Changes apply to the whole repeating series.', deleteSeries: 'This deletes the whole repeating series.',
    },
    intent: {
      verb: { reminder: 'Add reminder', event: 'Add event', task: 'Add to-do', memory: 'Remember', shopping: 'Add to shopping list' },
      type: { reminder: 'Reminder', event: 'Event', task: 'To-do', memory: 'Memory', shopping: 'Shopping' },
      added: { reminder: 'Reminder added', event: 'Added to the Nest family calendar', task: 'To-do added', memory: 'Saved to memory', shopping: 'Added to the shopping list' },
      pending: 'Awaiting confirmation', pendingHint: 'Tap Confirm to set it.', open: { reminder: 'Open Reminders', event: 'Open Calendar', memory: 'Open Family memory' },
      done: '{what} added', dismissed: 'Dismissed', openForm: 'Fill in details', formTitle: 'New family event', allDayHint: 'Leave empty for all day', shopPrefix: 'Buy: ',
    },
    draft: { make: 'Draft reply', label: 'Reply draft', hint: 'Edit freely — Nest never sends it for you.', openGmail: 'Open in Gmail', never: 'Drafts are never sent automatically. “Open in Gmail” opens a new message for you to check and send yourself.' },
    mem2: {
      tabs: { notes: 'Notes', people: 'People & info', insights: 'Insights', chats: 'From chats', me: 'About me' },
      suggTitle: 'Nest found {n} suggestion(s)', suggHint: 'Found in chats or email. Nothing is kept or used by the AI until you accept it.', keepFamily: 'Keep for family', keepPrivate: 'Keep private', accepted: 'Saved',
      fromChat: 'from a chat', fromEmail: 'from email', until: 'until {date}', private: 'Private',
      type: { person: 'People', school: 'Schools', class: 'Classes', tutor: 'Tutors', doctor: 'Doctors', contact: 'Contacts', allergy: 'Allergies', size: 'Sizes', medication: 'Medications', other: 'Other' },
      f: { relation: 'Relation', phone: 'Phone', email: 'Email', address: 'Address', schedule: 'Schedule', birthday: 'Birthday', note: 'Note' },
      peopleTitle: 'People & info', peopleHint: 'Grandma, teachers, tutors, doctors, allergies, sizes, medications… Kept only in your family’s space, never used for training; can be private. The AI uses it directly instead of asking again.', peopleEmpty: 'Nothing yet.',
      addEntity: 'Add info', typeLabel: 'Type', about: 'About', name: 'Name', namePh: 'e.g. Grandma, Miss Lee, St Paul’s Primary', notes: 'Notes', addNote: 'Add a note', noteHint: 'e.g. “mentioned her knee hurts” — shown when a “Call Grandma” reminder fires.', notePh: 'What’s new or worth remembering',
      visibility: 'Who can see it', visFamily: 'Family', visPrivate: 'Only me',
      insTitle: 'Insights', insHint: 'Learned from how the family uses Nest (usual reminder time, study weak spots, payment habits). Edit or delete; deleted ones are not recreated.', insEmpty: 'These appear after some use.',
      conf: 'Confidence {pct}% · seen {n}×', lastSeen: 'last {date}', edited: 'edited', editInsight: 'Edit insight', insightText: 'Text', editHint: 'Your wording is kept; only confidence and counts update.',
      chatTitle: 'From your chats', on: 'On', off: 'Off', chatHint: 'Things you mention about yourself (e.g. “big meeting tomorrow”) are saved automatically, visible only to you; dated ones expire. Anything about family members is suggested first.', chatOffHint: '“Remember from past chats” is off: chat memory is neither read nor written.', chatEmpty: 'Nothing yet.', toggleIn: 'Change in Settings',
      meTitle: 'What our family remembered about you', meHint: 'Everything in family memory that is about you, newest first. Edit or delete it in the other tabs.', meEmpty: 'Nothing about you yet.', kindInsight: 'Insight', kindKnowledge: 'Info', kindNote: 'Note',
      setting: 'Remember from past chats', settingHint: 'When on, Nest keeps useful things from chats and uses them in new ones. Off: nothing is read or saved.',
      lastTime: 'Last time: {note}',
    },
  },
});

// ---------- Subscriptions + Transport (2026-10-18) ----------
deepMerge(STRINGS, {
  'zh-Hant': {
    app: { nav: { subs: '訂閱', transport: '交通' } },
    common: { default: '預設' },
    more: { daily: '日常' },
    subs: {
      title: '家庭訂閱', sub: '每月自動扣款的服務一覽：誰在用、用來做甚麼、上次使用。續訂前 3 天會請負責人決定。Nest 不會替你取消任何訂閱。',
      monthly: '每月合共', yearly: '約每年 {amt}', count: '{n} 項訂閱', family: '全家共用', add: '新增訂閱', edit: '修改訂閱', empty: '未有訂閱。可手動新增，或連接 Gmail 讓 Nest 從收據找出來。',
      service: '服務名稱', servicePh: '例如 Netflix、編程班', purpose: '用途', purposePh: '例如 影片串流、STEM 課程', amount: '金額 (HK$)', cycle: '收費週期',
      cyc: { weekly: '每週', monthly: '每月', yearly: '每年' }, per: { weekly: '/週', monthly: '/月', yearly: '/年' },
      renew: '下次續訂日', member: '用戶', decider: '續訂前由誰決定', deciderHint: '預設為家長／管理員。續訂前 3 天會收到通知。', cancelUrl: '取消頁面連結（選填）', notes: '備註',
      renewsIn: '{n} 天後續訂', renewsToday: '今天續訂', renewsOn: '{date} 續訂', noRenew: '未設定續訂日', lastUsed: '上次使用：{n} 天前', usedToday: '今天用過', neverUsed: '未記錄使用', stale: '超過 30 天未用',
      markUsed: '今天用過', cancelPage: '取消頁面', saved: '已儲存', deleted: '已刪除', del: '刪除訂閱', delConfirm: '刪除「{name}」？這只會從 Nest 移除記錄，不會取消服務本身。',
      approx: '≈ {amt}/月', decided: { keep: '已決定：保留', discuss: '已決定：商量', cancel: '已決定：稍後取消' }, by: '由 {name}',
      fromEmail: '從電郵找到的訂閱', addFromEmail: '加入訂閱清單', addedFromEmail: '已加入訂閱清單',
    },
    subd: {
      title: '家庭決定', q: '{name} {when}續訂{cost}。要保留嗎？', today: '今天', inDays: '{n} 天後', keep: '保留', discuss: '一家人商量', cancel: '稍後取消',
      keepDone: '好的，保留 {name}', discussDone: '已加入今晚 8 時家庭提醒：商量 {name}', cancelDone: '已設提醒：續訂前一天取消 {name}', discussTitle: '一家人商量：是否續訂 {name}', cancelTitle: '取消 {name}（{date} 續訂前）',
      never: 'Nest 不會自動取消；請在提供者的網站自行取消。', openCancel: '打開取消頁面', unused: '已 {n} 天未使用',
    },
    tr: {
      title: '交通', sub: '設定常用車站及出門時間，或選擇起點和目的地，查看港鐵路綫、巴士及實時班次。',
      from: '由', to: '去', fromPh: '起點站（例如 大圍）', toPh: '目的地（例如 沙田）', swap: '對調', pick: '選擇車站',
      mtr: '港鐵', bus: '九巴', towards: '往 {st}', stops: '{n} 個站', ride: '車程約 {n} 分鐘', change: '轉乘', walkLink: '步行轉乘',
      next: '下一班', inMin: '{n} 分鐘', now: '即將到站', noTrains: '暫時沒有班次資料（可能已收車或資料暫時未能提供）', plat: '{n} 號月台',
      walk: '步行到站（分鐘）', arriveBy: '最遲到達（選填）', leaveBy: '{time} 前出門', leaveNow: '現在出門', catchT: '趕 {time} 的車，約 {arr} 到達', late: '趕不及 {time} 到達',
      buses: '巴士路綫', busHint: '按站名配對的九巴路綫（城巴暫未支援）', noBus: '找不到直達九巴路綫', busAt: '{stop} 上車 · 往 {dest}', busStops: '約 {n} 個站',
      fav: '收藏路綫', saveFav: '收藏', saved: '已收藏', removeFav: '移除', onHome: '在「今天」顯示', onHomeOn: '已在「今天」顯示', noFav: '收藏常用路綫，下次一按即可查看。',
      updated: '更新於 {time}', refresh: '重新整理', status: '服務受阻', delay: '列車延誤', estimate: '車程為估算', loading: '正在查詢實時班次…', error: '暫時未能取得實時資料',
      same: '起點和目的地相同', pickBoth: '選擇起點和目的地，查看路綫及實時班次。', recent: '最近查詢',
    },
    today: { editRoutes: '修改交通設定' },
  },
  en: {
    app: { nav: { subs: 'Subscriptions', transport: 'Transport' } },
    common: { default: 'default' },
    more: { daily: 'Daily' },
    subs: {
      title: 'Family subscriptions', sub: 'Every recurring charge in one place: who uses it, what for, when it was last used. 3 days before a renewal the chosen person decides. Nest never cancels anything for you.',
      monthly: 'Per month', yearly: '≈ {amt} a year', count: '{n} subscriptions', family: 'Whole family', add: 'Add subscription', edit: 'Edit subscription', empty: 'No subscriptions yet. Add one, or connect Gmail and Nest finds them in receipts.',
      service: 'Service', servicePh: 'e.g. Netflix, coding class', purpose: 'Purpose', purposePh: 'e.g. streaming, STEM class', amount: 'Amount (HK$)', cycle: 'Billing cycle',
      cyc: { weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' }, per: { weekly: '/wk', monthly: '/mo', yearly: '/yr' },
      renew: 'Next renewal', member: 'Used by', decider: 'Who decides before renewal', deciderHint: 'Defaults to a parent / admin. They get a notification 3 days before.', cancelUrl: 'Cancel page link (optional)', notes: 'Notes',
      renewsIn: 'Renews in {n} days', renewsToday: 'Renews today', renewsOn: 'Renews {date}', noRenew: 'No renewal date', lastUsed: 'Last used {n} days ago', usedToday: 'Used today', neverUsed: 'No usage recorded', stale: 'Unused 30+ days',
      markUsed: 'Used today', cancelPage: 'Cancel page', saved: 'Saved', deleted: 'Deleted', del: 'Delete subscription', delConfirm: 'Delete “{name}”? This only removes it from Nest — it does not cancel the service.',
      approx: '≈ {amt}/mo', decided: { keep: 'Decided: keep', discuss: 'Decided: discuss', cancel: 'Decided: cancel later' }, by: 'by {name}',
      fromEmail: 'Subscription found in email', addFromEmail: 'Add to subscriptions', addedFromEmail: 'Added to subscriptions',
    },
    subd: {
      title: 'Family decision', q: '{name} renews {when}{cost}. Keep it?', today: 'today', inDays: 'in {n} days', keep: 'Keep', discuss: 'Discuss', cancel: 'Cancel later',
      keepDone: 'OK — keeping {name}', discussDone: 'Family reminder added for 8 pm tonight: discuss {name}', cancelDone: 'Reminder set: cancel {name} the day before it renews', discussTitle: 'Family chat: keep {name}?', cancelTitle: 'Cancel {name} (renews {date})',
      never: 'Nest never cancels for you — cancel on the provider’s site.', openCancel: 'Open cancel page', unused: 'Unused for {n} days',
    },
    tr: {
      title: 'Transport', sub: 'Save your stops and leave times, or pick a start and destination for MTR lines, buses and live times.',
      from: 'From', to: 'To', fromPh: 'Start station (e.g. Tai Wai)', toPh: 'Destination (e.g. Sha Tin)', swap: 'Swap', pick: 'Pick a station',
      mtr: 'MTR', bus: 'KMB', towards: 'towards {st}', stops: '{n} stop(s)', ride: '~{n} min ride', change: 'Change', walkLink: 'Walk to interchange',
      next: 'Next', inMin: '{n} min', now: 'Arriving', noTrains: 'No live times right now (service may have ended or the feed is unavailable).', plat: 'Platform {n}',
      walk: 'Walk to station (min)', arriveBy: 'Arrive by (optional)', leaveBy: 'Leave by {time}', leaveNow: 'Leave now', catchT: 'Catch the {time} train, arrive ~{arr}', late: 'Can’t make {time}',
      buses: 'Bus routes', busHint: 'KMB routes matched by stop name (Citybus not yet)', noBus: 'No direct KMB route found', busAt: 'Board at {stop} · to {dest}', busStops: '~{n} stops',
      fav: 'Saved trips', saveFav: 'Save', saved: 'Saved', removeFav: 'Remove', onHome: 'Show on Today', onHomeOn: 'On Today', noFav: 'Save the trips you take often to see them in one tap.',
      updated: 'Updated {time}', refresh: 'Refresh', status: 'Disrupted', delay: 'Delayed', estimate: 'Ride times are estimates', loading: 'Getting live times…', error: 'Live data is unavailable right now',
      same: 'Start and destination are the same', pickBoth: 'Pick a start and a destination to see routes and live times.', recent: 'Recent',
    },
    today: { editRoutes: 'Edit transport' },
  },
});

// Plugin system + transport move (2026-10-18).
import { PLUGIN_STRINGS } from './plugins/strings.js';
deepMerge(STRINGS, PLUGIN_STRINGS);

// Unified identity / public profile + app icons (2026-10-18).
import { IDENTITY_STRINGS } from './strings-identity.js';
deepMerge(STRINGS, IDENTITY_STRINGS);

// AI 助理 live status lines (2026-10-18).
deepMerge(STRINGS, {
  'zh-Hant': { agentStatus: { lookup: '正在搜尋網上資料：{q}…', sources: '已參考 {n} 個來源', lookupFailed: '已嘗試搜尋網上資料，但未有找到結果', state: '正在讀取你的帳戶狀態…', action: '正在準備操作卡…', diagram: '正在繪製圖表…' } },
  en: { agentStatus: { lookup: 'Searching the web: {q}…', sources: 'Used {n} sources', lookupFailed: 'Searched the web — nothing found', state: 'Reading your account…', action: 'Preparing an action card…', diagram: 'Drawing a diagram…' } },
});

// Effective plan label with source + expiry (2026-10-18): 「Pro · Beta 至 2026-11-18」 / 「Pro · 家庭方案」.
deepMerge(STRINGS, {
  'zh-Hant': { planx: { beta: 'Beta 至 {date}', grant: '獲贈至 {date}', family: '家庭方案', ended: 'Pro 已於 {date} 結束', checking: '正在確認計劃…', label: '目前計劃' } },
  en: { planx: { beta: 'Beta until {date}', grant: 'Granted until {date}', family: 'Family plan', ended: 'Pro ended on {date}', checking: 'Checking plan…', label: 'Current plan' } },
});

// What's new / changelog (run 6, 2026-10-19).
deepMerge(STRINGS, {
  'zh-Hant': {
    app: { nav: { changelog: '最新動態' } },
    changelog: { title: '最新動態', sub: '每次更新的內容 · 目前版本 {v}', version: '版本 {v}', latest: '最新', about: '關於 Nest', versionLine: 'Nest 巢 · 版本 {v}', newDot: '有新內容', toast: 'Nest 已更新：{title}', view: '查看' },
  },
  en: {
    app: { nav: { changelog: "What's new" } },
    changelog: { title: "What's new", sub: 'Every update · current version {v}', version: 'Version {v}', latest: 'Latest', about: 'About Nest', versionLine: 'Nest · version {v}', newDot: 'New', toast: 'Nest was updated: {title}', view: 'View' },
  },
});

// Published-plugin listing editor + store gallery (run 6, 2026-10-19).
deepMerge(STRINGS, {
  'zh-Hant': {
    listing: {
      edit: '編輯商店資料', title: '編輯商店資料', sub: '修改介紹、圖示、分類、連結及截圖，毋須重新製作插件。', icon: '圖示', changeIcon: '更換圖示', removeIcon: '移除',
      descZh: '簡介（中文）', descEn: '簡介（英文）', features: '功能（每行一項）', category: '分類', links: '連結', addLink: '加入連結', linkLabel: '名稱', linkUrl: 'https:// 網址',
      shots: '截圖（{n}/6）', addShots: '加入截圖', ratio: '比例', auto: '自動', landscape: '橫向 16:10', portrait: '直向 9:16', alt: '圖片說明（供螢幕閱讀器使用）',
      left: '向前移', right: '向後移', replace: '更換', remove: '刪除', save: '儲存', saved: '商店資料已更新', submitted: '已提交審核，通過後商店頁會更新', pending: '有一項商店資料修改正在等候審核。',
      reviewNote: '此插件已標示為安全或已驗證，修改會先交 Nest 審核，通過後才會更新商店頁。', rejected: '上次的修改未獲批准：{r}', processing: '正在處理圖片…',
      tooLarge: '圖片太大，請選擇較小的圖片。', badImage: '未能讀取這張圖片。', max: '最多 6 張截圖。', err: { bad_link: '連結必須以 https:// 開頭。', not_owner: '只有插件創作者可以修改商店資料。', not_published: '插件上架後才可修改商店資料。', bad_icon: '圖示格式不正確。', shot_too_large: '截圖太大。', invalid_listing: '部分資料格式不正確。' },
    },
    gallery: { open: '放大第 {n} 張截圖', close: '關閉', prev: '上一張', next: '下一張', count: '{a} / {b}' },
  },
  en: {
    listing: {
      edit: 'Edit store listing', title: 'Edit store listing', sub: 'Change the description, icon, category, links and screenshots without rebuilding the plugin.', icon: 'Icon', changeIcon: 'Change icon', removeIcon: 'Remove',
      descZh: 'Description (Chinese)', descEn: 'Description (English)', features: 'Features (one per line)', category: 'Category', links: 'Links', addLink: 'Add link', linkLabel: 'Label', linkUrl: 'https:// URL',
      shots: 'Screenshots ({n}/6)', addShots: 'Add screenshots', ratio: 'Ratio', auto: 'Auto', landscape: 'Landscape 16:10', portrait: 'Portrait 9:16', alt: 'Image description (for screen readers)',
      left: 'Move earlier', right: 'Move later', replace: 'Replace', remove: 'Delete', save: 'Save', saved: 'Store listing updated', submitted: 'Sent for review — the store page updates once approved', pending: 'A listing change is waiting for review.',
      reviewNote: 'This plugin is labelled Safe or Verified, so changes are reviewed by Nest before the store page updates.', rejected: 'Your last change was not approved: {r}', processing: 'Processing image…',
      tooLarge: 'That image is too large. Please choose a smaller one.', badImage: 'Could not read that image.', max: 'Up to 6 screenshots.', err: { bad_link: 'Links must start with https://.', not_owner: 'Only the plugin’s creator can edit its listing.', not_published: 'The listing can be edited once the plugin is published.', bad_icon: 'The icon format is not supported.', shot_too_large: 'A screenshot is too large.', invalid_listing: 'Some details are not valid.' },
    },
    gallery: { open: 'Enlarge screenshot {n}', close: 'Close', prev: 'Previous', next: 'Next', count: '{a} / {b}' },
  },
});

// Admin config + announcements (Run 8b, 2026-10-19).
deepMerge(STRINGS, {
  'zh-Hant': {
    ann: { close: '關閉', ok: '知道了', never: '不再顯示', kicker: '最新消息' },
    acfg: {
      bypass: '維護模式已開啟：只有管理員可以繼續使用 Nest。',
      signupClosed: 'Nest 暫時停止接受新註冊，請稍後再試。已有帳戶可照常登入。',
      maintenance: { title: 'Nest 正在維護', body: '我們正在進行維護，請稍後再回來。' },
      suspended: { title: '帳戶已暫停', body: '這個帳戶已被暫停使用。如有疑問，請聯絡 Nest。' },
      signup: { title: '暫停註冊', body: 'Nest 暫時停止接受新帳戶。我們重新開放後，你便可以開始使用。' },
      feature: { title: '此功能暫時停用', body: 'Nest 暫時關閉了這個功能，請稍後再試。' },
    },
    adm2: {
      tabs: { ann: '公告', blog: '網誌', config: '設定', codes: '優惠碼', mod: '審核', stats: '統計' },
      ann: {
        title: '公告', new: '新增公告', none: '未有公告。', edit: '編輯公告', save: '儲存', saving: '正在儲存…', saved: '已儲存',
        publish: '發佈', pause: '暫停', resume: '恢復', del: '刪除', delQ: '刪除這個公告？', delBody: '公告、圖片及統計會一併刪除，無法復原。',
        status: { draft: '草稿', live: '已發佈', paused: '已暫停' }, scheduled: '排程中', ended: '已結束',
        lang: '語言', titleF: '標題', bodyF: '內容（支援 Markdown）', ctaF: '按鈕文字', link: '按鈕連結（https:// 或 /app/…）',
        image: '圖片（可選）', addImg: '加入圖片', removeImg: '移除圖片', imgHint: '會自動壓縮為 WebP（最多約 180 KB）。',
        style: '樣式', styles: { modal: '置中彈出（模糊背景）', banner: '頂部橫額', toast: '小提示' },
        audience: '對象', aud: { all: '所有用戶', plan: '指定計劃', lang: '指定語言', new: '新用戶', user: '指定用戶' },
        days: '註冊後天數', users: '用戶 ID 或電郵（每行一個）', start: '開始', end: '結束', noEnd: '不設結束時間',
        dismissible: '可以關閉', neverAgain: '顯示「不再顯示」選項', priority: '優先次序（0–100，越大越先）',
        translate: 'AI 翻譯成三種語言', translating: '正在翻譯…', translated: '已填入翻譯，請檢查後再儲存。',
        preview: '預覽', phone: '手機', ipad: 'iPad', light: '淺色', dark: '深色',
        counts: '已看 {s} · 點擊 {c} · 關閉 {d}', countsLong: '已看 {s} · 點擊 {c} · 關閉 {d}（不再顯示 {n}）',
        err: { title_required: '請最少填寫繁體中文或英文標題。', bad_link: '連結必須以 https:// 或 /app 開頭。', bad_schedule: '結束時間必須遲於開始時間。', bad_audience: '請選擇對象。', bad_image: '圖片格式不正確。', too_many: '公告數量已達上限，請先刪除舊公告。' },
      },
      cfg: {
        flags: '功能開關', flagsHint: '關閉後會在伺服器及 App 同時停用；管理員不受影響。',
        maint: '維護模式', maintOn: '開啟維護模式', maintHint: '開啟後，除管理員外所有人都只會看到維護訊息，伺服器亦會拒絕請求。', maintMsg: '維護訊息',
        maintQ: '開啟維護模式？', maintBody: '所有用戶（管理員除外）會立即無法使用 Nest，直至你關閉維護模式。',
        ai: 'AI 設定', model: '模型', modelLocked: '模型固定為 agnes-3.0-flash，不能更改。', limits: '每日／每週訊息上限（留空 = 計劃預設）',
        daily: '每日', weekly: '每週', promptAdd: '系統提示附加內容', promptHint: '會加入 AI 助理及功課導師的系統提示（最多 1500 字）。',
        signup: '註冊', signupOpen: '開放新註冊', signupHint: '關閉後，註冊頁會停用；關閉後才建立的帳戶（包括 Google 登入）會被伺服器擋下。',
        defaults: '預設', defLang: '預設語言', defTheme: '預設主題', themes: { system: '跟隨系統', light: '淺色', dark: '深色' },
        save: '儲存設定', saved: '設定已儲存', rev: '版本 {n}',
      },
      codes: {
        title: '優惠碼', beta: '內建 BETA 推廣', betaLine: '已領取 {a}/{b}', builtIn: '內建', create: '新增優惠碼', code: '優惠碼', months: 'Pro 月數', max: '最多使用次數', expires: '到期日（可選）', note: '備註',
        disable: '停用', enable: '啟用', disabled: '已停用', open: '可使用', full: '已用完', expired: '已到期', uses: '已使用 {a}/{b}',
        betaHint: '停用 BETA 只會暫停新的領取；已領取的家庭、名額及到期日不會改變。',
        err: { bad_code: '優惠碼只可使用英文字母、數字及「-」，3 至 24 個字元。', exists: '這個優惠碼已存在。', reserved: 'BETA 是內建優惠碼。' },
      },
      mod: { title: '審核捷徑', pending: '待審核插件', reports: '未處理檢舉', open: '前往插件管理', none: '沒有待處理項目。', listed: '已上架', installs: '安裝次數' },
      user: {
        revoke: '登出所有裝置', revokeQ: '登出這個用戶的所有裝置？', revokeBody: '{email} 的所有登入工作階段會立即失效，需要重新登入。密碼不會改變，亦不會顯示。',
        suspend: '暫停帳戶', unsuspend: '恢復帳戶', reason: '原因（可選，只供記錄）', changePlan: '更改家庭計劃', revoked: '已登出所有裝置',
      },
      audit: { title: '審計記錄', filter: '篩選（動作／對象／管理員）', all: '全部' },
      stats: { plugins: '插件', pluginsListed: '已上架插件', pending: '待審核', reports: '未處理檢舉', installs: '安裝總數', messages: 'AI 訊息（30 天）' },
    },
  },
  en: {
    ann: { close: 'Close', ok: 'Got it', never: 'Don’t show again', kicker: 'What’s new' },
    acfg: {
      bypass: 'Maintenance mode is on: only admins can use Nest right now.',
      signupClosed: 'Nest is not accepting new sign-ups right now. Please try again later. Existing accounts can sign in as usual.',
      maintenance: { title: 'Nest is under maintenance', body: 'We’re doing some maintenance. Please come back a little later.' },
      suspended: { title: 'Account suspended', body: 'This account has been suspended. Contact Nest if you have questions.' },
      signup: { title: 'Sign-ups paused', body: 'Nest is not accepting new accounts right now. You can start once sign-ups reopen.' },
      feature: { title: 'This feature is turned off', body: 'Nest has turned this feature off for now. Please try again later.' },
    },
    adm2: {
      tabs: { ann: 'Announcements', blog: 'Blog', config: 'Config', codes: 'Promo codes', mod: 'Moderation', stats: 'Stats' },
      ann: {
        title: 'Announcements', new: 'New announcement', none: 'No announcements yet.', edit: 'Edit announcement', save: 'Save', saving: 'Saving…', saved: 'Saved',
        publish: 'Publish', pause: 'Pause', resume: 'Resume', del: 'Delete', delQ: 'Delete this announcement?', delBody: 'The announcement, its image and its counts are deleted. This cannot be undone.',
        status: { draft: 'Draft', live: 'Live', paused: 'Paused' }, scheduled: 'Scheduled', ended: 'Ended',
        lang: 'Language', titleF: 'Title', bodyF: 'Body (Markdown)', ctaF: 'Button text', link: 'Button link (https:// or /app/…)',
        image: 'Image (optional)', addImg: 'Add image', removeImg: 'Remove image', imgHint: 'Compressed to WebP automatically (up to ~180 KB).',
        style: 'Style', styles: { modal: 'Centred modal (blurred backdrop)', banner: 'Top banner', toast: 'Toast' },
        audience: 'Audience', aud: { all: 'Everyone', plan: 'By plan', lang: 'By language', new: 'New users', user: 'Specific users' },
        days: 'Days since sign-up', users: 'User IDs or emails (one per line)', start: 'Start', end: 'End', noEnd: 'No end time',
        dismissible: 'Can be closed', neverAgain: 'Offer “Don’t show again”', priority: 'Priority (0–100, higher first)',
        translate: 'AI-translate to 3 languages', translating: 'Translating…', translated: 'Translations filled in — check them before saving.',
        preview: 'Preview', phone: 'Phone', ipad: 'iPad', light: 'Light', dark: 'Dark',
        counts: 'Seen {s} · Clicked {c} · Dismissed {d}', countsLong: 'Seen {s} · Clicked {c} · Dismissed {d} (don’t show again {n})',
        err: { title_required: 'Add at least a Traditional Chinese or English title.', bad_link: 'The link must start with https:// or /app.', bad_schedule: 'The end must be after the start.', bad_audience: 'Choose an audience.', bad_image: 'That image format is not supported.', too_many: 'Too many announcements — delete old ones first.' },
      },
      cfg: {
        flags: 'Feature flags', flagsHint: 'Turning one off disables it on the server and in the app; admins are not affected.',
        maint: 'Maintenance mode', maintOn: 'Maintenance mode on', maintHint: 'Everyone except admins sees only the maintenance message, and the server refuses their requests.', maintMsg: 'Maintenance message',
        maintQ: 'Turn on maintenance mode?', maintBody: 'Every user except admins immediately loses access to Nest until you turn it off.',
        ai: 'AI settings', model: 'Model', modelLocked: 'The model is fixed to agnes-3.0-flash and cannot be changed.', limits: 'Daily / weekly message limits (empty = plan default)',
        daily: 'Daily', weekly: 'Weekly', promptAdd: 'System-prompt addition', promptHint: 'Added to the AI Assistant and Homework tutor system prompts (up to 1,500 characters).',
        signup: 'Sign-ups', signupOpen: 'Allow new sign-ups', signupHint: 'When off, the sign-up form is disabled and accounts created after closing (including Google sign-in) are blocked by the server.',
        defaults: 'Defaults', defLang: 'Default language', defTheme: 'Default theme', themes: { system: 'System', light: 'Light', dark: 'Dark' },
        save: 'Save config', saved: 'Config saved', rev: 'Revision {n}',
      },
      codes: {
        title: 'Promo codes', beta: 'Built-in BETA promo', betaLine: 'Claimed {a}/{b}', builtIn: 'Built-in', create: 'Create code', code: 'Code', months: 'Months of Pro', max: 'Max uses', expires: 'Expires (optional)', note: 'Note',
        disable: 'Disable', enable: 'Enable', disabled: 'Disabled', open: 'Open', full: 'Used up', expired: 'Expired', uses: 'Used {a}/{b}',
        betaHint: 'Disabling BETA only pauses new claims; families that already claimed, the slot count and end dates do not change.',
        err: { bad_code: 'Codes use letters, digits and “-” only, 3–24 characters.', exists: 'That code already exists.', reserved: 'BETA is the built-in code.' },
      },
      mod: { title: 'Moderation shortcuts', pending: 'Plugins awaiting review', reports: 'Open reports', open: 'Open plugin admin', none: 'Nothing waiting.', listed: 'Listed', installs: 'Installs' },
      user: {
        revoke: 'Sign out everywhere', revokeQ: 'Sign this user out on every device?', revokeBody: 'Every session of {email} stops working now and they must sign in again. The password is not changed or shown.',
        suspend: 'Suspend account', unsuspend: 'Unsuspend account', reason: 'Reason (optional, for the log)', changePlan: 'Change family plan', revoked: 'Signed out everywhere',
      },
      audit: { title: 'Audit log', filter: 'Filter (action / target / admin)', all: 'All' },
      stats: { plugins: 'Plugins', pluginsListed: 'Listed plugins', pending: 'Awaiting review', reports: 'Open reports', installs: 'Total installs', messages: 'AI messages (30 days)' },
    },
  },
});
deepMerge(STRINGS, {
  'zh-Hant': { adm: { act: { config: '更改設定', 'ann-create': '新增公告', 'ann-edit': '編輯公告', 'ann-live': '發佈公告', 'ann-paused': '暫停公告', 'ann-draft': '公告改為草稿', 'ann-delete': '刪除公告', 'ann-translate': 'AI 翻譯公告', 'code-create': '新增優惠碼', 'code-disable': '停用優惠碼', 'code-enable': '啟用優惠碼', 'code-redeem': '使用優惠碼', 'revoke-sessions': '登出所有裝置' } } },
  en: { adm: { act: { config: 'config', 'ann-create': 'announcement created', 'ann-edit': 'announcement edited', 'ann-live': 'announcement published', 'ann-paused': 'announcement paused', 'ann-draft': 'announcement → draft', 'ann-delete': 'announcement deleted', 'ann-translate': 'announcement translated', 'code-create': 'code created', 'code-disable': 'code disabled', 'code-enable': 'code enabled', 'code-redeem': 'code redeemed', 'revoke-sessions': 'sessions revoked' } } },
});
deepMerge(STRINGS, {
  'zh-Hant': { acfg: { code: { title: '優惠碼', ph: '輸入優惠碼', go: '使用', ok: '已使用優惠碼：家庭可使用 Pro 至 {date}。', err: { bad_code: '優惠碼不正確。', already: '你的家庭已使用過這個優惠碼。', full: '這個優惠碼已用完。', expired: '這個優惠碼已過期。', disabled: '這個優惠碼已停用。', promo_paused: 'Beta 推廣暫停領取。', no_family: '請先建立或加入家庭。', test_account_ineligible: '測試帳戶不能使用優惠碼。' } } } },
  en: { acfg: { code: { title: 'Promo code', ph: 'Enter a code', go: 'Redeem', ok: 'Code redeemed: your family has Pro until {date}.', err: { bad_code: 'That code is not valid.', already: 'Your family has already used this code.', full: 'This code has been used up.', expired: 'This code has expired.', disabled: 'This code is disabled.', promo_paused: 'Beta claims are paused.', no_family: 'Create or join a family first.', test_account_ineligible: 'Test accounts cannot redeem codes.' } } } },
});
// Gate errors (Run 8b wrap-up, 2026-10-19): friendly lines for maintenance / feature_disabled / session_revoked / signup_closed / account_disabled.
deepMerge(STRINGS, {
  'zh-Hant': { acfg: { gate: {
    maintenance: 'Nest 正在維護，暫時未能使用，請稍後再試。',
    feature_disabled: '這個功能暫時停用，請稍後再試。',
    featureNamed: '「{name}」暫時停用，請稍後再試。',
    session_revoked: '為保障帳戶安全，你已在所有裝置登出，請重新登入。',
    signup_closed: 'Nest 暫時停止接受新註冊，這個帳戶暫未能使用。我們重新開放後會再通知你。',
    account_disabled: '這個帳戶已被暫停使用。如有疑問，請聯絡 Nest。',
    signedOut: '你已被登出',
  } } },
  en: { acfg: { gate: {
    maintenance: 'Nest is under maintenance right now. Please try again a little later.',
    feature_disabled: 'This feature is switched off for now. Please try again later.',
    featureNamed: '“{name}” is switched off for now. Please try again later.',
    session_revoked: 'For your account’s security you were signed out on every device. Please sign in again.',
    signup_closed: 'Nest isn’t accepting new sign-ups right now, so this account can’t be used yet. We’ll let you know when we reopen.',
    account_disabled: 'This account has been suspended. Contact Nest if you have questions.',
    signedOut: 'You were signed out',
  } } },
});
// Country / Region (Run 11, 2026-10-19).
deepMerge(STRINGS, {
  'zh-Hant': { region: {
    title: '你在哪個國家或地區？',
    sub: 'Nest 會按所在地提供公眾假期、交通、天氣來源、緊急電話及考試等本地資訊。之後可在「設定」更改。',
    promptTitle: '請選擇你的國家或地區',
    promptSub: 'Nest 現已服務世界各地的家庭。選擇所在地後，假期、交通及 AI 的回答會更貼近你的生活。',
    search: '搜尋國家或地區', none: '找不到相符的國家或地區', listAria: '國家或地區列表', globeAria: '地球儀：拖動旋轉，輕按選擇國家或地區',
    globeHint: '拖動旋轉地球，雙指或滾輪縮放，輕按即可選擇。',
    useSuggested: '使用建議：{name}', continue: '繼續', choose: '請先選擇國家或地區',
    hasPack: '已為{name}準備本地資訊：假期、交通、天氣來源、緊急電話及考試制度。',
    noPack: '這個地區暫時未有專屬本地資訊，Nest 會使用通用設定。',
    settingsLabel: '國家／地區', settingsHint: '影響假期、交通、天氣來源、緊急電話及 AI 的本地資訊。', notSet: '未設定',
    saved: '已更新國家／地區：{name}', saveFailed: '未能儲存，請稍後再試。',
    local: { title: '本地資訊', emergency: '緊急電話', transport: '交通', weather: '天氣', holidays: '公眾假期', school: '學年', official: '官方資料', noLive: '本地區暫時沒有即時資料，以下為官方連結。' },
    hkOnly: '港鐵及巴士到站時間只適用於香港。你可以在「設定 → 國家／地區」更改所在地。',
  } },
  en: { region: {
    title: 'Where is your family based?',
    sub: 'Nest uses your country or region for public holidays, transport links, the weather source, emergency numbers and exam systems. You can change it later in Settings.',
    promptTitle: 'Choose your country or region',
    promptSub: 'Nest now works for families everywhere. Pick where you live so holidays, transport and AI answers fit your life.',
    search: 'Search countries and regions', none: 'No country or region matches', listAria: 'Countries and regions', globeAria: 'Globe: drag to rotate, tap to choose a country or region',
    globeHint: 'Drag to spin the globe, pinch or scroll to zoom, tap to choose.',
    useSuggested: 'Suggested: {name}', continue: 'Continue', choose: 'Choose a country or region first',
    hasPack: 'Local info ready for {name}: holidays, transport, weather source, emergency numbers and exams.',
    noPack: 'No local pack for this region yet — Nest uses general settings.',
    settingsLabel: 'Country / Region', settingsHint: 'Used for holidays, transport, weather source, emergency numbers and AI answers.', notSet: 'Not set',
    saved: 'Country / Region updated: {name}', saveFailed: 'Could not save. Please try again.',
    local: { title: 'Local info', emergency: 'Emergency', transport: 'Transport', weather: 'Weather', holidays: 'Public holidays', school: 'School year', official: 'Official source', noLive: 'No live data for this region yet — here are the official links.' },
    hkOnly: 'MTR and bus arrival times are for Hong Kong only. Change your region in Settings → Country / Region.',
  } },
});
// Run 11: one public nav (landing + static pages).
deepMerge(STRINGS, {
  'zh-Hant': { nav: { demo: '示範', plugins: '插件', changelog: '更新日誌', blog: '網誌', status: '狀態', menu: '選單' }, lp: { cardsTitle: 'Nest 可以做甚麼', pricingTitle: '價格', blogTitle: '網誌' } },
  en: { nav: { demo: 'Demo', plugins: 'Plugins', changelog: 'Changelog', blog: 'Blog', status: 'Status', menu: 'Menu' }, lp: { cardsTitle: 'What Nest does', pricingTitle: 'Pricing', blogTitle: 'Blog' } },
});
// Run 18: email verification by 6-digit code (src/pages/VerifyEmail.jsx).
deepMerge(STRINGS, {
  'zh-Hant': { vf: {
    title: '查看你的電郵', sub: '我們已把 6 位數驗證碼寄到 {email}。', subSending: '正在把 6 位數驗證碼寄到 {email}…',
    subFallback: '我們已把驗證連結寄到 {email}。按下郵件中的連結後，回到這裡按「我已確認」。',
    label: '6 位數驗證碼', digit: '第 {n} 位數字', checking: '正在驗證…', ok: '電郵地址已確認',
    resend: '重新發送驗證碼', resendIn: '{s} 秒後可重新發送', sent: '已發送新的驗證碼。',
    change: '更改電郵地址', changeConfirm: '要用另一個電郵地址註冊嗎？你會被登出。', signOut: '登出',
    hint: '找不到郵件？請查看垃圾郵件匣。驗證碼 10 分鐘內有效，只可使用一次。',
    iDid: '我已確認', notYet: '仍未確認。請按下郵件中的連結，然後再試。',
    err: { wrong_code: '驗證碼不正確，尚餘 {n} 次機會。', too_many_attempts: '錯誤次數太多，請重新發送驗證碼。', expired: '驗證碼已過期，請重新發送。', no_code: '請先按「重新發送驗證碼」。', cooldown: '請等 {s} 秒後再重新發送。', too_many_sends: '發送次數太多，請一小時後再試。', rate_limited: '操作太頻密，請稍後再試。', send_failed: '暫時未能發送郵件，請稍後再試。', network: '網絡錯誤，請再試。', generic: '出現問題，請再試。' },
  } },
  en: { vf: {
    title: 'Check your email', sub: 'We sent a 6-digit code to {email}.', subSending: 'Sending a 6-digit code to {email}…',
    subFallback: 'We sent a verification link to {email}. Tap the link in the email, then come back and tap “I’ve verified”.',
    label: '6-digit code', digit: 'Digit {n}', checking: 'Checking…', ok: 'Email confirmed',
    resend: 'Resend code', resendIn: 'Resend in {s}s', sent: 'A new code is on its way.',
    change: 'Change email', changeConfirm: 'Sign up with a different email? You’ll be signed out.', signOut: 'Sign out',
    hint: 'Can’t find it? Check your spam folder. The code is valid for 10 minutes and works once.',
    iDid: 'I’ve verified', notYet: 'Not verified yet. Tap the link in the email, then try again.',
    err: { wrong_code: 'That code isn’t right — {n} tries left.', too_many_attempts: 'Too many wrong tries. Send a new code.', expired: 'That code has expired. Send a new one.', no_code: 'Tap “Resend code” first.', cooldown: 'Wait {s}s before sending again.', too_many_sends: 'Too many codes sent. Try again in an hour.', rate_limited: 'Too many attempts — try again shortly.', send_failed: 'We couldn’t send the email right now. Try again shortly.', network: 'Network error — try again.', generic: 'Something went wrong — try again.' },
  } },
});
// Run 23: 今日 card, chat cards, progress card, Nestie, Family tab (src/lib/strings-run23.js).
import { R23, R23_NAV } from './strings-run23.js';
deepMerge(STRINGS, { 'zh-Hant': R23['zh-Hant'], en: R23.en });
deepMerge(STRINGS, { 'zh-Hant': { app: { nav: R23_NAV['zh-Hant'] } }, en: { app: { nav: R23_NAV.en } } });
// Run 24: scanner (+ later Files / panels / suggestion frequency) — src/lib/strings-run24.js.
import { R24 } from './strings-run24.js';
deepMerge(STRINGS, { 'zh-Hant': { r24: R24['zh-Hant'] }, en: { r24: R24.en } });
// Run 25: reasoning models (OrcaRouter) — status line while the model thinks before writing.
deepMerge(STRINGS, { 'zh-Hant': { agentStatus: { reasoning: '正在思考…' } }, en: { agentStatus: { reasoning: 'Thinking…' } } });
