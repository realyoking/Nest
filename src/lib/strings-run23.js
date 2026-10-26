// Run 23 UI strings: 「今日」 card, chat cards, progress card, Nestie name + personality, Family tab upgrade.
// zh-Hant = Hong Kong standard written Chinese (書面語; no Cantonese colloquialisms). zh-Hans is generated from zh-Hant.
// Added languages without their own copy fall back to English (src/lib/i18n.jsx).
export const R23 = {
  'zh-Hant': {
    roles: { parent: '家長', kid: '子女', grandparent: '祖父母', sibling: '兄弟姊妹', helper: '家務助理／照顧者', guest: '訪客', custom: '自訂' },
    r23: {
      today: {
        title: '今日', weather: '天氣', reminders: '未完成提醒', schedule: '家庭行程', noReminders: '沒有未完成的提醒', noSchedule: '今天沒有行程',
        tipBy: '{name} 的提示', tipLocal: '今日提示', loading: '正在準備今日提示…', rain: '降雨概率', more: '還有 {n} 項', complete: '標示完成',
        completed: '已完成「{t}」', undo: '復原', overdue: '已過期', today: '今天', all: '查看全部', noWeather: '暫時未有天氣資料',
      },
      cards: {
        reminder: '提醒', checklist: '清單', schedule: '行程', add: '加入提醒', added: '已加入', complete: '標示完成', completed: '已完成', reopen: '重新打開',
        addAll: '全部加入提醒', addedAll: '已加入 {n} 項提醒', addEvent: '加入行事曆', addedEvent: '已加入行事曆', progress: '已完成 {done}／{total}',
        hint: '按一下即可加入；未按之前不會新增任何項目。', noDate: '未定日期', everyone: '全家', failed: '未能加入，請再試。',
      },
      progress: {
        title: { gentle: '{name} 正在幫你處理', lively: '{name} 馬上處理！', concise: '處理中' },
        understand: '理解你的問題', lookup: '查閱資料', account: '讀取帳戶資料', attach: '閱讀附件', write: '整理回覆', cards: '準備卡片',
        readAccounts: '讀取已連接的帳戶', writeSummary: '撰寫摘要', leave: '你可以先離開，完成後會通知你。', done: '{name} 已回覆：{title}', view: '查看', working: '進行中',
      },
      nestie: {
        title: 'AI 助理', name: '名稱', nameHint: '全家共用的名稱，最多 16 個字。', personality: '性格',
        p: { gentle: '溫柔', lively: '活潑', concise: '簡潔' },
        pDesc: { gentle: '語氣溫和，耐心體貼。', lively: '積極開朗，充滿活力。', concise: '直接扼要，不說多餘的話。' },
        preview: { gentle: '好的，我們一步一步來，我會幫你整理好。', lively: '沒問題！我馬上幫你安排好！', concise: '好，已整理如下。' },
        saved: '已儲存', ask: '問 {name} 任何事…', chip: '{name} · {p}',
      },
      fam: {
        settings: '家庭設定', settingsSub: '這些設定適用於全家。', name: '家庭名稱', suggest: '主動建議',
        suggestOpt: { off: '關閉', low: '每日最多 1 個', normal: '每日最多 2 個' },
        holiday: '節日主題', holidayHint: '為全家預設開啟節日裝飾；每位成員仍可在「設定」中自行關閉。',
        memEdit: '誰可以修改家庭記憶', memEditOpt: { everyone: '所有成員', adults: '家長及祖父母', owner: '只限擁有人' },
        quiet: '安靜時段', quietHint: '這段時間內不會發出主動建議。', from: '由', to: '至', off: '未設定',
        onlyAdults: '只有擁有人、家長及祖父母可以修改家庭設定。', ownerOnly: '只有擁有人可以修改這項設定。',
        role: '角色', roleCustom: '自訂角色名稱', roleCustomPh: '例如：姨姨', profile: '成員資料', memory: '{name} 記得的事', mschedule: '行程',
        assigned: '負責的提醒', noMemory: '暫時沒有記錄', noSchedule: '未來 7 天沒有行程', noAssigned: '沒有未完成的提醒', editRole: '更改角色',
        roleSaved: '角色已更新', ownerOnlyRole: '只有擁有人可以更改其他成員的角色。', perms: '權限', canFamily: '可修改家庭設定', canMemory: '可修改家庭記憶',
        readOnly: '只可查看', open: '查看資料', saved: '已儲存', saveFail: '未能儲存，請再試。', you: '你',
      },
    },
  },
  en: {
    roles: { parent: 'Parent', kid: 'Child', grandparent: 'Grandparent', sibling: 'Sibling', helper: 'Helper / caregiver', guest: 'Guest', custom: 'Custom' },
    r23: {
      today: {
        title: 'Today', weather: 'Weather', reminders: 'Open reminders', schedule: 'Family schedule', noReminders: 'No open reminders', noSchedule: 'Nothing scheduled today',
        tipBy: 'Tip from {name}', tipLocal: 'Today’s tip', loading: 'Preparing today’s tip…', rain: 'Rain', more: '{n} more', complete: 'Mark done',
        completed: 'Done: “{t}”', undo: 'Undo', overdue: 'Overdue', today: 'Today', all: 'See all', noWeather: 'No weather data yet',
      },
      cards: {
        reminder: 'Reminder', checklist: 'Checklist', schedule: 'Schedule', add: 'Add reminder', added: 'Added', complete: 'Mark done', completed: 'Done', reopen: 'Reopen',
        addAll: 'Add all as reminders', addedAll: 'Added {n} reminders', addEvent: 'Add to calendar', addedEvent: 'Added to calendar', progress: '{done}/{total} done',
        hint: 'One tap adds it — nothing is added until you tap.', noDate: 'No date', everyone: 'Everyone', failed: 'Couldn’t add that — try again.',
      },
      progress: {
        title: { gentle: '{name} is working on it', lively: '{name} is on it!', concise: 'Working…' },
        understand: 'Understanding your question', lookup: 'Looking things up', account: 'Reading your account', attach: 'Reading the attachment', write: 'Writing the reply', cards: 'Preparing cards',
        readAccounts: 'Reading connected accounts', writeSummary: 'Writing the summary', leave: 'You can leave this screen — we’ll let you know when it’s ready.', done: '{name} replied: {title}', view: 'View', working: 'In progress',
      },
      nestie: {
        title: 'AI assistant', name: 'Name', nameHint: 'One name for the whole family, up to 16 characters.', personality: 'Personality',
        p: { gentle: 'Gentle', lively: 'Lively', concise: 'Concise' },
        pDesc: { gentle: 'Warm, patient and kind.', lively: 'Upbeat and full of energy.', concise: 'Straight to the point.' },
        preview: { gentle: 'Of course — let’s take it one step at a time.', lively: 'You got it! Sorting that out right now!', concise: 'Sure. Here it is.' },
        saved: 'Saved', ask: 'Ask {name} anything…', chip: '{name} · {p}',
      },
      fam: {
        settings: 'Family settings', settingsSub: 'These apply to the whole family.', name: 'Family name', suggest: 'Proactive suggestions',
        suggestOpt: { off: 'Off', low: 'Up to 1 a day', normal: 'Up to 2 a day' },
        holiday: 'Holiday themes', holidayHint: 'On by default for the family; each member can still turn it off in Settings.',
        memEdit: 'Who can edit family memory', memEditOpt: { everyone: 'Everyone', adults: 'Parents & grandparents', owner: 'Owner only' },
        quiet: 'Quiet hours', quietHint: 'No proactive suggestions during these hours.', from: 'From', to: 'To', off: 'Not set',
        onlyAdults: 'Only the owner, parents and grandparents can change family settings.', ownerOnly: 'Only the owner can change this.',
        role: 'Role', roleCustom: 'Custom role name', roleCustomPh: 'e.g. Auntie', profile: 'Member profile', memory: 'What {name} remembers', mschedule: 'Schedule',
        assigned: 'Assigned reminders', noMemory: 'Nothing saved yet', noSchedule: 'Nothing in the next 7 days', noAssigned: 'No open reminders', editRole: 'Change role',
        roleSaved: 'Role updated', ownerOnlyRole: 'Only the owner can change other members’ roles.', perms: 'Permissions', canFamily: 'Can change family settings', canMemory: 'Can edit family memory',
        readOnly: 'View only', open: 'View profile', saved: 'Saved', saveFail: 'Couldn’t save — try again.', you: 'You',
      },
    },
  },
  th: {
    roles: { parent: 'ผู้ปกครอง', kid: 'ลูก', grandparent: 'ปู่ย่าตายาย', sibling: 'พี่น้อง', helper: 'ผู้ช่วย / ผู้ดูแล', guest: 'แขก', custom: 'กำหนดเอง' },
    r23: {
      today: {
        title: 'วันนี้', weather: 'สภาพอากาศ', reminders: 'การแจ้งเตือนที่ยังไม่เสร็จ', schedule: 'ตารางของครอบครัว', noReminders: 'ไม่มีการแจ้งเตือนค้าง', noSchedule: 'วันนี้ไม่มีนัดหมาย',
        tipBy: 'คำแนะนำจาก {name}', tipLocal: 'คำแนะนำวันนี้', loading: 'กำลังเตรียมคำแนะนำวันนี้…', rain: 'โอกาสฝน', more: 'อีก {n} รายการ', complete: 'ทำเครื่องหมายว่าเสร็จ',
        completed: 'เสร็จแล้ว: “{t}”', undo: 'เลิกทำ', overdue: 'เลยกำหนด', today: 'วันนี้', all: 'ดูทั้งหมด', noWeather: 'ยังไม่มีข้อมูลสภาพอากาศ',
      },
      cards: {
        reminder: 'การแจ้งเตือน', checklist: 'รายการตรวจสอบ', schedule: 'ตารางเวลา', add: 'เพิ่มการแจ้งเตือน', added: 'เพิ่มแล้ว', complete: 'ทำเครื่องหมายว่าเสร็จ', completed: 'เสร็จแล้ว', reopen: 'เปิดอีกครั้ง',
        addAll: 'เพิ่มทั้งหมดเป็นการแจ้งเตือน', addedAll: 'เพิ่มการแจ้งเตือนแล้ว {n} รายการ', addEvent: 'เพิ่มลงปฏิทิน', addedEvent: 'เพิ่มลงปฏิทินแล้ว', progress: 'เสร็จแล้ว {done}/{total}',
        hint: 'แตะครั้งเดียวเพื่อเพิ่ม — จะไม่มีการเพิ่มใด ๆ จนกว่าคุณจะแตะ', noDate: 'ไม่มีวันที่', everyone: 'ทุกคน', failed: 'เพิ่มไม่สำเร็จ โปรดลองอีกครั้ง',
      },
      progress: {
        title: { gentle: '{name} กำลังดำเนินการให้', lively: '{name} จัดการให้เดี๋ยวนี้!', concise: 'กำลังดำเนินการ…' },
        understand: 'ทำความเข้าใจคำถาม', lookup: 'ค้นหาข้อมูล', account: 'อ่านข้อมูลบัญชี', attach: 'อ่านไฟล์แนบ', write: 'เขียนคำตอบ', cards: 'เตรียมการ์ด',
        readAccounts: 'อ่านบัญชีที่เชื่อมต่อ', writeSummary: 'เขียนสรุป', leave: 'ออกจากหน้านี้ได้เลย เราจะแจ้งเมื่อเสร็จ', done: '{name} ตอบแล้ว: {title}', view: 'ดู', working: 'กำลังดำเนินการ',
      },
      nestie: {
        title: 'ผู้ช่วย AI', name: 'ชื่อ', nameHint: 'ชื่อเดียวสำหรับทั้งครอบครัว ไม่เกิน 16 ตัวอักษร', personality: 'บุคลิก',
        p: { gentle: 'อ่อนโยน', lively: 'สดใส', concise: 'กระชับ' },
        pDesc: { gentle: 'อบอุ่น ใจเย็น และใส่ใจ', lively: 'ร่าเริงและกระตือรือร้น', concise: 'ตรงประเด็น ไม่พูดเยอะ' },
        preview: { gentle: 'ได้เลย เราค่อย ๆ ทำไปทีละขั้นนะ', lively: 'ได้เลย! จัดการให้เดี๋ยวนี้!', concise: 'ได้ นี่คือคำตอบ' },
        saved: 'บันทึกแล้ว', ask: 'ถาม {name} ได้ทุกเรื่อง…', chip: '{name} · {p}',
      },
      fam: {
        settings: 'การตั้งค่าครอบครัว', settingsSub: 'ใช้กับทุกคนในครอบครัว', name: 'ชื่อครอบครัว', suggest: 'คำแนะนำเชิงรุก',
        suggestOpt: { off: 'ปิด', low: 'ไม่เกินวันละ 1 รายการ', normal: 'ไม่เกินวันละ 2 รายการ' },
        holiday: 'ธีมเทศกาล', holidayHint: 'เปิดเป็นค่าเริ่มต้นสำหรับทั้งครอบครัว แต่ละคนยังปิดเองได้ในการตั้งค่า',
        memEdit: 'ใครแก้ไขความจำของครอบครัวได้', memEditOpt: { everyone: 'ทุกคน', adults: 'ผู้ปกครองและปู่ย่าตายาย', owner: 'เจ้าของเท่านั้น' },
        quiet: 'ช่วงเวลาเงียบ', quietHint: 'จะไม่มีคำแนะนำเชิงรุกในช่วงเวลานี้', from: 'จาก', to: 'ถึง', off: 'ยังไม่ได้ตั้ง',
        onlyAdults: 'เฉพาะเจ้าของ ผู้ปกครอง และปู่ย่าตายายเท่านั้นที่เปลี่ยนการตั้งค่าครอบครัวได้', ownerOnly: 'เฉพาะเจ้าของเท่านั้นที่เปลี่ยนได้',
        role: 'บทบาท', roleCustom: 'ชื่อบทบาทที่กำหนดเอง', roleCustomPh: 'เช่น น้า', profile: 'ข้อมูลสมาชิก', memory: 'สิ่งที่ {name} จำได้', mschedule: 'ตารางเวลา',
        assigned: 'การแจ้งเตือนที่ได้รับมอบหมาย', noMemory: 'ยังไม่มีข้อมูล', noSchedule: 'ไม่มีนัดหมายใน 7 วันข้างหน้า', noAssigned: 'ไม่มีการแจ้งเตือนค้าง', editRole: 'เปลี่ยนบทบาท',
        roleSaved: 'อัปเดตบทบาทแล้ว', ownerOnlyRole: 'เฉพาะเจ้าของเท่านั้นที่เปลี่ยนบทบาทของสมาชิกคนอื่นได้', perms: 'สิทธิ์', canFamily: 'เปลี่ยนการตั้งค่าครอบครัวได้', canMemory: 'แก้ไขความจำของครอบครัวได้',
        readOnly: 'ดูได้อย่างเดียว', open: 'ดูข้อมูล', saved: 'บันทึกแล้ว', saveFail: 'บันทึกไม่สำเร็จ โปรดลองอีกครั้ง', you: 'คุณ',
      },
    },
  },
};

// Run 23b: family memory per member, proactive suggestions, Home panels, Files tab.
const B = {
  'zh-Hant': {
    nav: { files: '檔案' },
    mem: {
      title: '{name} 記得的事', sub: '這裡列出 {name} 為每位家庭成員記住的事情。一切由你掌控：可以隨時修改或刪除。', control: '由你掌控',
      family: '全家', cats: { preference: '偏好', allergy: '過敏', habit: '習慣', fact: '事實' }, private: '只有你看到', add: '新增', addPh: '例如：喜歡吃三文魚',
      saved: '已儲存', deleted: '已刪除', undo: '復原', locked: '你沒有權限修改這項記憶', level: '誰可以修改家庭記憶：{level}', fromChats: '從對話中記住',
      fromChatsHint: '開啟後，{name} 會從對話中記下有用的事情；關閉後不會再新增。', empty: '暫時沒有記錄', edit: '修改', del: '刪除', open: '查看 {name} 記得的事',
      cantAdd: '訪客不能新增家庭記憶。',
    },
    sug: { title: '建議', accept: '好', ignore: '不用了', added: '已設定提醒', ignored: '明白，之後會少提這類建議。', why: '每天最多 {n} 個建議，可在「家庭」設定中調整。' },
    panels: {
      title: '我的小卡', edit: '編輯', done: '完成', add: '加入小卡', types: { countdown: '倒數', shopping: '購物清單', homework: '功課進度' },
      typeDesc: { countdown: '距離重要日子還有幾天', shopping: '全家共用的購物清單', homework: '本週功課完成了多少' },
      cdTitle: '名稱', cdDate: '日期', cdPh: '例如：聖誕假期', days: '還有 {n} 天', today: '就是今天', past: '已過 {n} 天',
      shopEmpty: '購物清單是空的', shopAdd: '加入', shopPh: '例如：牛奶', hwEmpty: '本週沒有功課提醒', hwProgress: '本週已完成 {done}／{total}',
      up: '上移', down: '下移', remove: '移除', max: '最多 6 張小卡', empty: '把常用資訊放在首頁：倒數、購物清單、功課進度。', bought: '已買「{t}」',
    },
    files: {
      title: '檔案', sub: '全家的文件夾、文件及上載檔案，連同在 AI 助理中分享的相片及清單，都集中在這裏。', all: '全部', image: '相片', file: '文件', list: '清單', search: '搜尋檔案',
      empty: '暫時沒有檔案。在 AI 助理中附上相片或文件，就會出現在這裡。', open: '打開對話', items: '{n} 項', loading: '正在整理…', note: '只會整理現有對話中的內容，不會另外上載或儲存。', checklist: '清單', schedule: '行程', video: '影片',
    },
  },
  en: {
    nav: { files: 'Files' },
    mem: {
      title: 'What {name} remembers', sub: 'Everything {name} remembers about each family member. You’re in control: edit or delete anything, anytime.', control: 'You’re in control',
      family: 'Whole family', cats: { preference: 'Preference', allergy: 'Allergy', habit: 'Habit', fact: 'Fact' }, private: 'Only you', add: 'Add', addPh: 'e.g. loves salmon',
      saved: 'Saved', deleted: 'Deleted', undo: 'Undo', locked: 'You don’t have permission to change this', level: 'Who can edit family memory: {level}', fromChats: 'Remember from chats',
      fromChatsHint: 'When on, {name} notes useful things from your chats; when off, nothing new is added.', empty: 'Nothing saved yet', edit: 'Edit', del: 'Delete', open: 'See what {name} remembers',
      cantAdd: 'Guests can’t add family memory.',
    },
    sug: { title: 'Suggestion', accept: 'Yes', ignore: 'No thanks', added: 'Reminder set', ignored: 'Got it — fewer suggestions like this.', why: 'Up to {n} a day — change it in Family settings.' },
    panels: {
      title: 'My cards', edit: 'Edit', done: 'Done', add: 'Add a card', types: { countdown: 'Countdown', shopping: 'Shopping list', homework: 'Homework progress' },
      typeDesc: { countdown: 'Days to an important date', shopping: 'The family’s shared shopping list', homework: 'How much homework is done this week' },
      cdTitle: 'Name', cdDate: 'Date', cdPh: 'e.g. Christmas holiday', days: '{n} days to go', today: 'It’s today', past: '{n} days ago',
      shopEmpty: 'The shopping list is empty', shopAdd: 'Add', shopPh: 'e.g. milk', hwEmpty: 'No homework reminders this week', hwProgress: '{done}/{total} done this week',
      up: 'Move up', down: 'Move down', remove: 'Remove', max: 'Up to 6 cards', empty: 'Keep what you check often on Home: countdowns, the shopping list, homework progress.', bought: 'Bought “{t}”',
    },
    files: {
      title: 'Files', sub: 'Family folders, documents and uploads, plus photos and lists shared in the AI Agent, all in one place.', all: 'All', image: 'Photos', file: 'Documents', list: 'Lists', search: 'Search files',
      empty: 'No files yet. Attach a photo or document in the AI Agent and it shows up here.', open: 'Open chat', items: '{n} items', loading: 'Gathering…', note: 'Collected from your existing chats — nothing is uploaded or stored again.', checklist: 'Checklist', schedule: 'Schedule', video: 'Video',
    },
  },
  th: {
    nav: { files: 'ไฟล์' },
    mem: {
      title: 'สิ่งที่ {name} จำได้', sub: 'ทุกอย่างที่ {name} จำไว้เกี่ยวกับสมาชิกแต่ละคน คุณควบคุมได้เอง แก้ไขหรือลบได้ทุกเมื่อ', control: 'คุณควบคุมได้เอง',
      family: 'ทั้งครอบครัว', cats: { preference: 'ความชอบ', allergy: 'อาการแพ้', habit: 'นิสัย', fact: 'ข้อเท็จจริง' }, private: 'เห็นเฉพาะคุณ', add: 'เพิ่ม', addPh: 'เช่น ชอบปลาแซลมอน',
      saved: 'บันทึกแล้ว', deleted: 'ลบแล้ว', undo: 'เลิกทำ', locked: 'คุณไม่มีสิทธิ์แก้ไขรายการนี้', level: 'ใครแก้ไขความจำของครอบครัวได้: {level}', fromChats: 'จำจากการสนทนา',
      fromChatsHint: 'เมื่อเปิด {name} จะจดสิ่งที่มีประโยชน์จากการสนทนา เมื่อปิดจะไม่เพิ่มอะไรใหม่', empty: 'ยังไม่มีข้อมูล', edit: 'แก้ไข', del: 'ลบ', open: 'ดูสิ่งที่ {name} จำได้',
      cantAdd: 'แขกไม่สามารถเพิ่มความจำของครอบครัวได้',
    },
    sug: { title: 'คำแนะนำ', accept: 'ตกลง', ignore: 'ไม่เป็นไร', added: 'ตั้งการแจ้งเตือนแล้ว', ignored: 'รับทราบ จะแนะนำแบบนี้น้อยลง', why: 'ไม่เกินวันละ {n} รายการ เปลี่ยนได้ในการตั้งค่าครอบครัว' },
    panels: {
      title: 'การ์ดของฉัน', edit: 'แก้ไข', done: 'เสร็จสิ้น', add: 'เพิ่มการ์ด', types: { countdown: 'นับถอยหลัง', shopping: 'รายการซื้อของ', homework: 'ความคืบหน้าการบ้าน' },
      typeDesc: { countdown: 'อีกกี่วันถึงวันสำคัญ', shopping: 'รายการซื้อของที่ใช้ร่วมกันทั้งครอบครัว', homework: 'การบ้านสัปดาห์นี้เสร็จไปเท่าไร' },
      cdTitle: 'ชื่อ', cdDate: 'วันที่', cdPh: 'เช่น วันหยุดคริสต์มาส', days: 'อีก {n} วัน', today: 'วันนี้แหละ', past: 'ผ่านมา {n} วัน',
      shopEmpty: 'รายการซื้อของว่างอยู่', shopAdd: 'เพิ่ม', shopPh: 'เช่น นม', hwEmpty: 'สัปดาห์นี้ไม่มีการแจ้งเตือนการบ้าน', hwProgress: 'สัปดาห์นี้เสร็จแล้ว {done}/{total}',
      up: 'เลื่อนขึ้น', down: 'เลื่อนลง', remove: 'นำออก', max: 'ไม่เกิน 6 การ์ด', empty: 'วางข้อมูลที่ดูบ่อยไว้ที่หน้าแรก: นับถอยหลัง รายการซื้อของ ความคืบหน้าการบ้าน', bought: 'ซื้อแล้ว “{t}”',
    },
    files: {
      title: 'ไฟล์', sub: 'โฟลเดอร์ เอกสาร และไฟล์ที่อัปโหลดของครอบครัว รวมถึงรูปภาพและรายการที่แชร์ในเอเจนต์ AI รวมไว้ที่เดียว', all: 'ทั้งหมด', image: 'รูปภาพ', file: 'เอกสาร', list: 'รายการ', search: 'ค้นหาไฟล์',
      empty: 'ยังไม่มีไฟล์ แนบรูปภาพหรือเอกสารในเอเจนต์ AI แล้วจะแสดงที่นี่', open: 'เปิดการสนทนา', items: '{n} รายการ', loading: 'กำลังรวบรวม…', note: 'รวบรวมจากการสนทนาที่มีอยู่ ไม่มีการอัปโหลดหรือจัดเก็บซ้ำ', checklist: 'รายการตรวจสอบ', schedule: 'ตารางเวลา', video: 'วิดีโอ',
    },
  },
};
for (const l of ['zh-Hant', 'en', 'th']) { const { nav, ...rest } = B[l]; Object.assign(R23[l].r23, rest); void nav; }
// Nav label for the Files page (app.nav.files) — merged by strings.js / locales/th.js.
export const R23_NAV = { 'zh-Hant': B['zh-Hant'].nav, en: B.en.nav, th: B.th.nav };
