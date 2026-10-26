// What's new (更新日誌). Newest first. Dates are Hong Kong (HKT) calendar dates of the production deploy.
// User-facing only: what changed for families, never internal details (models, quotas, file names, admin tools).
// Add an entry BEFORE deploying a user-visible change — scripts/deploy.mjs warns when the newest entry is older than the code.
// zh-Hans is generated from zh-Hant (work/run6/gen-changelog.mjs uses src/lib/hans.js); keep the three languages in step.
export const CHANGELOG = [
 {
  "version": "1.25.1",
  "date": "2026-10-24",
  "zh-Hant": { "title": "修正夜間模式下拉選單看不清", "items": ["首頁夜間模式下，語言選單的選項文字現在清楚可見，選單顏色會跟隨日間或夜間主題。", "所有下拉選單、選擇欄及箭頭在深色主題下都改用一致的顏色，對比更清晰。"] },
  "zh-Hans": { "title": "修正夜间模式下拉菜单看不清", "items": ["首页夜间模式下，语言菜单的选项文字现在清楚可见，菜单颜色会跟随日间或夜间主题。", "所有下拉菜单、选择栏及箭头在深色主题下都改用一致的颜色，对比更清晰。"] },
  "en": { "title": "Readable dropdowns in night mode", "items": ["On the home page in night mode, the language menu's options are readable again — the menu now follows the day or night theme.", "Every dropdown, select box and arrow uses matching colours in the dark theme, with clearer contrast."] },
  "th": { "title": "เมนูแบบเลื่อนลงอ่านง่ายในโหมดกลางคืน", "items": ["ในหน้าแรกโหมดกลางคืน ตัวเลือกในเมนูภาษาอ่านได้ชัดเจนแล้ว เมนูจะเปลี่ยนสีตามธีมกลางวันหรือกลางคืน", "เมนูแบบเลื่อนลง ช่องเลือก และลูกศรทั้งหมดใช้สีที่เข้ากันในธีมมืด ให้คอนทราสต์ชัดเจนขึ้น"] }
 },
 {
  "version": "1.25.0",
  "date": "2026-10-24",
  "zh-Hant": {
   "title": "AI 助理會搜尋網上最新資料",
   "items": [
    "問到事實、新聞或最新消息時，AI 助理會即時搜尋網上資料再回答，不再只靠維基百科；回覆下方會顯示來源網站，按一下即可打開。",
    "網上搜尋繁忙時會自動改用其他搜尋服務，最後才用維基百科，回答不會中斷。",
    "日常對話、功課及有關 Nest 的問題不會搜尋，回覆一樣快。"
   ]
  },
  "zh-Hans": {
   "title": "AI 助理会搜索网上最新资料",
   "items": [
    "问到事实、新闻或最新消息时，AI 助理会即时搜索网上资料再回答，不再只靠维基百科；回复下方会显示来源网站，按一下即可打开。",
    "网上搜索繁忙时会自动改用其他搜索服务，最后才用维基百科，回答不会中断。",
    "日常对话、功课及有关 Nest 的问题不会搜索，回复一样快。"
   ]
  },
  "en": {
   "title": "The AI helper searches the web for the latest info",
   "items": [
    "Ask about facts, news or anything recent and the AI helper now searches the web before answering, not just Wikipedia. The source sites appear under the reply — tap one to open it.",
    "If one search service is busy, another takes over automatically, with Wikipedia as the last backup, so you still get an answer.",
    "Everyday chat, homework and questions about Nest don't search, so those replies stay just as fast."
   ]
  },
  "th": {
   "title": "ผู้ช่วย AI ค้นหาข้อมูลล่าสุดจากเว็บ",
   "items": [
    "เมื่อถามเรื่องข้อเท็จจริง ข่าว หรือเรื่องล่าสุด ผู้ช่วย AI จะค้นหาบนเว็บก่อนตอบ ไม่ได้ใช้แค่ Wikipedia แล้ว และจะแสดงเว็บไซต์ที่มาไว้ใต้คำตอบ แตะเพื่อเปิดได้",
    "หากบริการค้นหาหนึ่งไม่ว่าง จะสลับไปใช้บริการอื่นโดยอัตโนมัติ และใช้ Wikipedia เป็นตัวสำรองสุดท้าย คุณจึงยังได้รับคำตอบ",
    "การสนทนาทั่วไป การบ้าน และคำถามเกี่ยวกับ Nest จะไม่ค้นหา คำตอบจึงเร็วเหมือนเดิม"
   ]
  }
 },
 {
  "version": "1.24.0",
  "date": "2026-10-24",
  "zh-Hant": { "title": "更多免費 AI 模型、模型圖示及思考模式", "items": ["AI 模型選項新增多個免費模型，並按供應商分組，全部免費。", "「自動」會按問題即時選擇：日常對話用最快的模型，簡短問候用輕量模型，數學、相片及長文件用較強的模型，寫程式用編程模型；如模型繁忙或今日次數用完，會自動改用其他模型。", "每個模型都有自己的圖示，回覆下方的模型名稱旁亦會顯示。", "新增「思考」模式：較難的問題（數學、功課、長文件、計劃）會先思考再回答，並可展開查看思考摘要；亦可自行切換「快速」或「思考」。"] },
  "zh-Hans": { "title": "更多免费 AI 模型、模型图标及思考模式", "items": ["AI 模型选项新增多个免费模型，并按供应商分组，全部免费。", "「自动」会按问题即时选择：日常对话用最快的模型，简短问候用轻量模型，数学、相片及长文件用较强的模型，写程序用编程模型；如模型繁忙或今日次数用完，会自动改用其他模型。", "每个模型都有自己的图标，回复下方的模型名称旁亦会显示。", "新增「思考」模式：较难的问题（数学、功课、长文件、计划）会先思考再回答，并可展开查看思考摘要；亦可自行切换「快速」或「思考」。"] },
  "en": { "title": "More free AI models, icons and Thinking mode", "items": ["The AI model picker adds several more free models, grouped by provider — still all free.", "Auto picks instantly: the fastest model for everyday chat, a light one for quick greetings, and stronger ones for maths, photos and long files, and a coding model for code. If a model is busy or out of today's uses, another one answers.", "Every model has its own icon, also shown next to the model name under each reply.", "New Thinking mode: harder questions (maths, homework, long files, planning) are thought through first, with a summary you can expand; switch between Fast and Thinking yourself any time."] },
  "th": { "title": "โมเดล AI ฟรีเพิ่มขึ้น ไอคอน และโหมดคิด", "items": ["ตัวเลือกโมเดล AI เพิ่มโมเดลฟรีอีกหลายตัว จัดกลุ่มตามผู้ให้บริการ ยังคงฟรีทั้งหมด", "อัตโนมัติจะเลือกทันที: โมเดลที่เร็วที่สุดสำหรับการคุยทั่วไป โมเดลเบาสำหรับคำทักทายสั้นๆ โมเดลที่เก่งกว่าสำหรับคณิต รูปภาพ และไฟล์ยาว และโมเดลเขียนโค้ดสำหรับโค้ด หากโมเดลไม่ว่างหรือใช้ครบโควตาวันนี้ จะใช้โมเดลอื่นตอบแทน", "ทุกโมเดลมีไอคอนของตัวเอง แสดงข้างชื่อโมเดลใต้คำตอบด้วย", "โหมดคิดใหม่: คำถามยาก (คณิต การบ้าน ไฟล์ยาว การวางแผน) จะคิดก่อนตอบ พร้อมสรุปความคิดที่กดดูได้ และสลับ เร็ว / คิด ได้เอง"] }
 },
 {
  "version": "1.23.0",
  "date": "2026-10-24",
  "zh-Hant": {
   "title": "AI 助理可選擇 AI 模型",
   "items": [
    "AI 助理輸入欄上方新增「AI 模型」選項：預設為「自動」，亦可自行選擇 DeepSeek V4.1 Flash、Hunyuan Hy4 Preview、Hunyuan Hy3、DeepSeek V4 Flash、GLM 5.3 Flash 或 Nest 原有的模型，全部免費。",
    "「自動」會即時按問題類型選擇模型：數學及功課、相片、長文件及日常對話各用最合適、最快的模型，不會額外等待。",
    "每個回覆下方會顯示由哪個模型回答；如所選模型繁忙，會自動改用其他模型，對話不會中斷。你的選擇會儲存在帳戶中。"
   ]
  },
  "zh-Hans": {
   "title": "AI 助理可选择 AI 模型",
   "items": [
    "AI 助理输入栏上方新增「AI 模型」选项：默认为「自动」，亦可自行选择 DeepSeek V4.1 Flash、Hunyuan Hy4 Preview、Hunyuan Hy3、DeepSeek V4 Flash、GLM 5.3 Flash 或 Nest 原有的模型，全部免费。",
    "「自动」会即时按问题类型选择模型：数学及功课、照片、长文件及日常对话各用最合适、最快的模型，不会额外等待。",
    "每个回复下方会显示由哪个模型回答；如所选模型繁忙，会自动改用其他模型，对话不会中断。你的选择会保存在账户中。"
   ]
  },
  "en": {
   "title": "Choose the AI model in the AI helper",
   "items": [
    "A new AI model chip above the AI helper's message box: Auto by default, or pick DeepSeek V4.1 Flash, Hunyuan Hy4 Preview, Hunyuan Hy3, DeepSeek V4 Flash, GLM 5.3 Flash or Nest's original model — all free.",
    "Auto picks instantly by the kind of question — maths and homework, photos, long documents or everyday chat each go to the best, fastest model, with no extra wait.",
    "Each reply shows which model answered. If your chosen model is busy, another one answers so the chat never stops. Your choice is saved to your account."
   ]
  },
  "th": {
   "title": "เลือกโมเดล AI ในผู้ช่วย AI ได้",
   "items": [
    "มีปุ่มเลือกโมเดล AI เหนือช่องพิมพ์ของผู้ช่วย AI: ค่าเริ่มต้นคือ อัตโนมัติ หรือเลือก DeepSeek V4.1 Flash, Hunyuan Hy4 Preview, Hunyuan Hy3, DeepSeek V4 Flash, GLM 5.3 Flash หรือโมเดลดั้งเดิมของ Nest ได้เอง ใช้ฟรีทั้งหมด",
    "อัตโนมัติจะเลือกทันทีตามประเภทคำถาม — คณิตและการบ้าน รูปภาพ เอกสารยาว หรือการสนทนาทั่วไป จะใช้โมเดลที่เหมาะและเร็วที่สุดโดยไม่ต้องรอเพิ่ม",
    "ทุกคำตอบจะแสดงว่าโมเดลใดเป็นผู้ตอบ หากโมเดลที่เลือกไม่ว่าง จะใช้โมเดลอื่นตอบแทนเพื่อไม่ให้การสนทนาหยุด การเลือกของคุณจะบันทึกไว้ในบัญชี"
   ]
  }
 },
 {
  "version": "1.22.1",
  "date": "2026-10-23",
  "zh-Hant": {
   "title": "AI 助理可閱讀長 PDF 全文",
   "items": [
    "在 AI 助理附上的長 PDF 及文件，現在會讀取每一頁的全文；中文 PDF 亦能正確讀取。",
    "「對話中的檔案」會保存並顯示文件全文，字數與對話中顯示的一致。",
    "文件太長時，AI 會使用開頭及與問題最相關的部分，並清楚顯示「已使用約 X／Y 字」；之後追問其他頁數，AI 亦會再次參考相關內容。"
   ]
  },
  "zh-Hans": {
   "title": "AI 助理可阅读长 PDF 全文",
   "items": [
    "在 AI 助理附上的长 PDF 及文件，现在会读取每一页的全文；中文 PDF 亦能正确读取。",
    "「对话中的文件」会保存并显示文件全文，字数与对话中显示的一致。",
    "文件太长时，AI 会使用开头及与问题最相关的部分，并清楚显示「已使用约 X／Y 字」；之后追问其他页数，AI 亦会再次参考相关内容。"
   ]
  },
  "en": {
   "title": "AI helper reads long PDFs in full",
   "items": [
    "Long PDFs and documents you attach in the AI helper are now read in full, every page — Chinese PDFs included.",
    "Files › From chats keeps and shows the full text, with the same word count you see in the chat.",
    "When a document is too long, the AI uses the start plus the parts most related to your question and tells you clearly (\"used about X / Y words\"); follow-up questions about other pages look at the document again."
   ]
  },
  "th": {
   "title": "ผู้ช่วย AI อ่าน PDF ยาวได้ครบทั้งฉบับ",
   "items": [
    "PDF และเอกสารยาวที่แนบในผู้ช่วย AI จะถูกอ่านครบทุกหน้า รวมถึง PDF ภาษาจีน",
    "ไฟล์ › จากแชต เก็บและแสดงข้อความทั้งหมด พร้อมจำนวนคำที่ตรงกับในแชต",
    "เมื่อเอกสารยาวเกินไป AI จะใช้ส่วนต้นและส่วนที่เกี่ยวข้องกับคำถามมากที่สุด และแจ้งอย่างชัดเจนว่า \"ใช้ประมาณ X / Y คำ\" คำถามต่อเนื่องเกี่ยวกับหน้าอื่นจะกลับไปดูเอกสารอีกครั้ง"
   ]
  }
 },
 {
  "version": "1.22.0",
  "date": "2026-10-23",
  "zh-Hant": {
   "title": "全家檔案：文件夾、文件及真正的 PDF 預覽",
   "items": [
    "「檔案」新增「全家檔案」：可建立多層文件夾（重新命名、移動、刪除），以麵包屑路徑快速返回上一層，並可用格狀或清單檢視、搜尋及按名稱／日期／大小／類型排序。",
    "可直接在 Nest 內建立文件，支援粗體、斜體、標題、項目及編號清單和待辦清單，會自動儲存。",
    "可上載任何類型的檔案（相片、PDF、Office、音訊、影片、壓縮檔等），每個檔案會顯示上載進度；每個檔案上限 8 MB，全家共 50 MB，用量會清楚顯示。",
    "PDF 會顯示真正的頁面，附頁面縮圖、翻頁及縮放；相片、影片及音訊可直接預覽，其他檔案可下載。掃描文件亦可一按「儲存到檔案」。"
   ]
  },
  "zh-Hans": {
   "title": "全家文件：文件夹、文档及真正的 PDF 预览",
   "items": [
    "「文件」新增「全家文件」：可建立多层文件夹（重新命名、移动、删除），以面包屑路径快速返回上一层，并可用格状或列表视图、搜索及按名称／日期／大小／类型排序。",
    "可直接在 Nest 内建立文档，支持粗体、斜体、标题、项目及编号列表和待办清单，会自动保存。",
    "可上传任何类型的文件（相片、PDF、Office、音频、视频、压缩文件等），每个文件会显示上传进度；每个文件上限 8 MB，全家共 50 MB，用量会清楚显示。",
    "PDF 会显示真正的页面，附页面缩图、翻页及缩放；相片、视频及音频可直接预览，其他文件可下载。扫描文件亦可一按「保存到文件」。"
   ]
  },
  "en": {
   "title": "Family files: folders, documents and real PDF previews",
   "items": [
    "Files has a new Family files tab: nested folders you can rename, move and delete, a breadcrumb to jump back up, grid or list view, search, and sorting by name, date, size or type.",
    "Write documents right inside Nest — bold, italic, headings, bulleted and numbered lists and checklists — saved automatically.",
    "Upload any kind of file (photos, PDFs, Office files, audio, video, archives and more) with progress for each file. Up to 8 MB per file and 50 MB for the whole family, with usage shown clearly.",
    "PDFs show their real pages, with page thumbnails, page navigation and zoom. Photos, video and audio preview in place; anything else can be downloaded. Scans can go straight to Files with Save to Files."
   ]
  },
  "th": {
   "title": "ไฟล์ครอบครัว: โฟลเดอร์ เอกสาร และการแสดงตัวอย่าง PDF จริง",
   "items": [
    "หน้าไฟล์มีแท็บ “ไฟล์ครอบครัว” ใหม่: โฟลเดอร์ซ้อนกันที่เปลี่ยนชื่อ ย้าย และลบได้ เส้นทางนำทางเพื่อย้อนกลับ มุมมองตารางหรือรายการ ค้นหา และเรียงตามชื่อ วันที่ ขนาด หรือประเภท",
    "เขียนเอกสารใน Nest ได้เลย มีตัวหนา ตัวเอียง หัวข้อ รายการหัวข้อย่อยและลำดับเลข และรายการตรวจสอบ บันทึกอัตโนมัติ",
    "อัปโหลดไฟล์ได้ทุกประเภท (รูปภาพ PDF ไฟล์ Office เสียง วิดีโอ ไฟล์บีบอัด และอื่น ๆ) พร้อมความคืบหน้าของแต่ละไฟล์ สูงสุด 8 MB ต่อไฟล์ และ 50 MB ทั้งครอบครัว แสดงการใช้งานชัดเจน",
    "PDF แสดงหน้าจริง พร้อมภาพย่อหน้า การเปลี่ยนหน้า และการซูม รูปภาพ วิดีโอ และเสียงดูตัวอย่างได้ทันที ไฟล์อื่นดาวน์โหลดได้ งานสแกนบันทึกลงไฟล์ได้ด้วย “บันทึกลงไฟล์”"
   ]
  }
 },
 {
  "version": "1.21.0",
  "date": "2026-10-22",
  "zh-Hant": {
   "title": "首頁面板自訂、建議次數及版面改善",
   "items": [
    "首頁「我的面板」可按「自訂」新增或移除面板、拖動或用上移／下移調整次序、選擇小／中／大尺寸，並可逐個設定（例如倒數日子的名稱及日期、購物清單名稱、功課進度只看自己或全家）。",
    "新增「簡潔」、「學生」、「家長」預設組合，一按即可套用，亦可隨時重設；首頁預設保持簡潔。",
    "「設定」新增「主動建議」次數：關閉、每日 1 個、每日 2 個、自訂或不限；安靜時段內不會顯示建議。",
    "「家庭」及「設定」頁面在平板及 iPad 橫向時排列整齊，不再留有空位；安靜時段會清楚顯示時間，未設定時可一按使用 22:00–07:00。"
   ]
  },
  "zh-Hans": {
   "title": "首页面板自订、建议次数及版面改善",
   "items": [
    "首页「我的面板」可按「自订」新增或移除面板、拖动或用上移／下移调整次序、选择小／中／大尺寸，并可逐个设置（例如倒数日子的名称及日期、购物清单名称、功课进度只看自己或全家）。",
    "新增「简洁」、「学生」、「家长」默认组合，一按即可套用，亦可随时重设；首页默认保持简洁。",
    "「设置」新增「主动建议」次数：关闭、每日 1 个、每日 2 个、自订或不限；安静时段内不会显示建议。",
    "「家庭」及「设置」页面在平板及 iPad 横向时排列整齐，不再留有空位；安静时段会清楚显示时间，未设置时可一按使用 22:00–07:00。"
   ]
  },
  "en": {
   "title": "Customisable Home panels, suggestion frequency and tidier layouts",
   "items": [
    "Tap Customise on My panels to add or remove panels, drag (or use Move up / down) to reorder, pick Small / Medium / Large, and set each one up — countdown name and date, shopping list name, homework for just you or the whole family.",
    "New Simple, Student and Parent presets apply in one tap, and Reset clears them any time. Home starts simple.",
    "Settings has a new Proactive suggestions control: Off, 1 a day, 2 a day, Custom or Unlimited. Nothing shows during quiet hours.",
    "Family and Settings now line up neatly on tablets and iPad in landscape, with no gaps. Quiet hours show their times clearly, with a one-tap 22:00–07:00 when they aren’t set."
   ]
  },
  "th": {
   "title": "ปรับแต่งแผงหน้าแรก จำนวนคำแนะนำ และเลย์เอาต์ที่เป็นระเบียบขึ้น",
   "items": [
    "แตะ “ปรับแต่ง” ที่แผงของฉัน เพื่อเพิ่มหรือนำแผงออก ลาก (หรือใช้เลื่อนขึ้น/ลง) เพื่อจัดลำดับ เลือกขนาดเล็ก/กลาง/ใหญ่ และตั้งค่าแต่ละแผงได้ เช่น ชื่อและวันที่นับถอยหลัง ชื่อรายการซื้อของ การบ้านเฉพาะของคุณหรือทั้งครอบครัว",
    "ชุดสำเร็จรูปใหม่ “เรียบง่าย” “นักเรียน” และ “ผู้ปกครอง” ใช้ได้ในแตะเดียว และรีเซ็ตได้ทุกเมื่อ หน้าแรกเริ่มต้นแบบเรียบง่าย",
    "การตั้งค่ามีตัวเลือก “คำแนะนำเชิงรุก” ใหม่: ปิด วันละ 1 วันละ 2 กำหนดเอง หรือไม่จำกัด และจะไม่แสดงในช่วงเวลาเงียบ",
    "หน้าครอบครัวและการตั้งค่าจัดเรียงเป็นระเบียบบนแท็บเล็ตและ iPad แนวนอน ไม่มีช่องว่าง ช่วงเวลาเงียบแสดงเวลาชัดเจน และแตะครั้งเดียวเพื่อใช้ 22:00–07:00 เมื่อยังไม่ได้ตั้ง"
   ]
  }
 },
 {
  "version": "1.20.0",
  "date": "2026-10-22",
  "zh-Hant": {
   "title": "文件掃描及移除手寫",
   "items": [
    "「檔案」新增「掃描文件」：拍下工作紙或文件，自動找出邊角、拉直及去除陰影，可儲存為圖片或 PDF。",
    "「移除手寫」可擦去藍色、紅色等彩色筆跡，還原空白工作紙方便重做；加強模式亦會嘗試移除鉛筆及黑筆字跡，並可用擦除／還原筆刷逐處修正及左右拖動比較前後效果。全部在你的裝置上處理，不會上載。"
   ]
  },
  "zh-Hans": {
   "title": "文件扫描及移除手写",
   "items": [
    "「文件」新增「扫描文件」：拍下工作纸或文件，自动找出边角、拉直及去除阴影，可保存为图片或 PDF。",
    "「移除手写」可擦去蓝色、红色等彩色笔迹，还原空白工作纸方便重做；加强模式亦会尝试移除铅笔及黑笔字迹，并可用擦除／还原笔刷逐处修正及左右拖动比较前后效果。全部在你的设备上处理，不会上传。"
   ]
  },
  "en": {
   "title": "Document scanner and handwriting removal",
   "items": [
    "Files has a new Scan option: snap a worksheet or document and it finds the corners, straightens the page and removes shadows. Save it as an image or a PDF.",
    "Remove handwriting erases blue, red and other coloured ink to give you a blank worksheet to redo. Strong mode also tries pencil and black pen; touch up with the Erase / Restore brush and drag to compare before and after. Everything is processed on your device — nothing is uploaded."
   ]
  }
 },
 {
  "version": "1.19.0",
  "date": "2026-10-22",
  "zh-Hant": {
   "title": "全家共用的 AI 記憶、貼心建議、首頁小卡及「檔案」頁面",
   "items": [
    "Nestie 現在會按每位家庭成員記住偏好、過敏、習慣等事情；在對話中提到其他成員的安排（例如「哥哥明天要補習」），會記在該成員名下並提醒對方。",
    "「設定」新增「Nestie 記得的事」頁面，按成員列出 AI 記得的所有事情。一切由你掌控：可隨時修改或刪除，並按家庭設定的權限決定誰可以修改。",
    "首頁每天最多出現一至兩個建議，例如「明天是媽媽的生日，要設定提醒嗎？」，按一下即可接受或略過；Nestie 會按你的選擇調整之後的建議。",
    "首頁可加入自選小卡：倒數日子、全家購物清單及本週功課進度，並可隨時新增、移除及調整次序。",
    "新增「檔案」頁面：在 AI 助理中分享過的相片、文件及清單都集中在同一處，方便搜尋及重溫。"
   ]
  },
  "zh-Hans": {
   "title": "全家共用的 AI 记忆、贴心建议、首页小卡及「文件」页面",
   "items": [
    "Nestie 现在会按每位家庭成员记住偏好、过敏、习惯等事情；在对话中提到其他成员的安排（例如「哥哥明天要补习」），会记在该成员名下并提醒对方。",
    "「设置」新增「Nestie 记得的事」页面，按成员列出 AI 记得的所有事情。一切由你掌控：可随时修改或删除，并按家庭设置的权限决定谁可以修改。",
    "首页每天最多出现一至两个建议，例如「明天是妈妈的生日，要设置提醒吗？」，按一下即可接受或略过；Nestie 会按你的选择调整之后的建议。",
    "首页可加入自选小卡：倒数日子、全家购物清单及本周功课进度，并可随时新增、移除及调整次序。",
    "新增「文件」页面：在 AI 助理中分享过的相片、文件及清单都集中在同一处，方便搜索及重温。"
   ]
  },
  "en": {
   "title": "Family-wide AI memory, gentle suggestions, Home cards and a Files page",
   "items": [
    "Nestie now remembers preferences, allergies and habits for each family member. Mention someone else’s plans in a chat (like “Big brother has tutoring tomorrow”) and it’s saved under that member — and they get the reminder.",
    "A new “What Nestie remembers” page in Settings lists everything the AI remembers, member by member. You’re in control: edit or delete anything, with family permissions deciding who can change what.",
    "Home shows at most one or two suggestions a day, like “Tomorrow is Mum’s birthday — set a reminder?”. Accept or skip with one tap, and Nestie adjusts future suggestions to your choices.",
    "Add your own small cards to Home — a countdown, the family shopping list and this week’s homework progress — and add, remove or reorder them anytime.",
    "A new Files page gathers the photos, documents and lists shared in the AI Agent in one place, easy to search and revisit."
   ]
  }
 },
 {
  "version": "1.18.0",
  "date": "2026-10-22",
  "zh-Hant": {
   "title": "「今日」卡片、AI 助理回覆卡片，以及可自訂的 Nestie",
   "items": [
    "首頁頂部新增「今日」卡片：一眼看到天氣、未完成的提醒及今天的家庭行程，並附上一句當日小提示，例如「今晚有機會下雨，記得收衣服」。",
    "AI 助理可以把清單、行程及提醒建議顯示為卡片：按一下即可加入提醒或行事曆，清單項目可逐一剔選完成。",
    "較長的 AI 工作會顯示進度卡片，列出正在進行的步驟；你可以先離開對話，回覆完成後會收到通知。",
    "可以為家中的 AI 助理改名，並選擇「溫柔」、「活潑」或「簡潔」的性格，回覆語氣會隨之改變。",
    "「家庭」頁面升級：新增祖父母、兄弟姊妹、家務助理／照顧者、訪客及自訂角色；按成員可查看其資料、行程及負責的提醒；並新增家庭設定，包括主動建議次數、節日主題、誰可修改家庭記憶及安靜時段。"
   ]
  },
  "zh-Hans": {
   "title": "「今日」卡片、AI 助理回复卡片，以及可自订的 Nestie",
   "items": [
    "首页顶部新增「今日」卡片：一眼看到天气、未完成的提醒及今天的家庭行程，并附上一句当日小提示，例如「今晚有机会下雨，记得收衣服」。",
    "AI 助理可以把清单、行程及提醒建议显示为卡片：按一下即可加入提醒或行事历，清单项目可逐一剔选完成。",
    "较长的 AI 工作会显示进度卡片，列出正在进行的步骤；你可以先离开对话，回复完成后会收到通知。",
    "可以为家中的 AI 助理改名，并选择「温柔」、「活泼」或「简洁」的性格，回复语气会随之改变。",
    "「家庭」页面升级：新增祖父母、兄弟姊妹、家务助理／照顾者、访客及自订角色；按成员可查看其资料、行程及负责的提醒；并新增家庭设置，包括主动建议次数、节日主题、谁可修改家庭记忆及安静时段。"
   ]
  },
  "en": {
   "title": "A Today card, reply cards in the AI Agent, and your own Nestie",
   "items": [
    "A new Today card at the top of Home shows the weather, open reminders and today’s family schedule at a glance, plus one tip for the day, like “Rain is likely tonight — bring in the laundry”.",
    "The AI Agent can show checklists, schedules and suggested reminders as cards: one tap adds them to reminders or the calendar, and checklist items can be ticked off.",
    "Longer AI tasks show a progress card with the steps in progress. You can leave the chat — you’ll be told when the reply is ready.",
    "Rename your family’s AI assistant and pick a personality — gentle, lively or concise — and its replies change tone to match.",
    "The Family page is upgraded: new roles (grandparent, sibling, helper / caregiver, guest and custom), a profile for each member with their schedule and assigned reminders, and family settings for proactive suggestions, holiday themes, who can edit family memory and quiet hours."
   ]
  }
 },
 {
  "version": "1.17.0",
  "date": "2026-10-22",
  "zh-Hant": {
   "title": "節日主題、更流暢的動畫及手勢，AI 助理可連續發送訊息",
   "items": [
    "節日期間，首頁及「今天」頁面會加入小裝飾，例如萬聖節的南瓜燈及蝙蝠；如不需要，可在「設定」中關閉「節日主題」。",
    "按鈕、清單及頁面切換的動畫更流暢，完成提醒時會有簡短的動畫；裝置設定了減少動態效果時，動畫會自動停用。",
    "在手機上向左掃動提醒即可標示完成（已完成的提醒則會刪除），並可按「復原」取消；在頁面頂部向下拉即可重新整理。",
    "AI 助理回覆期間仍可繼續輸入及發送訊息：訊息會先標示為「待傳送」，回覆完成後一併發送，AI 會合併回答或逐一回應。"
   ]
  },
  "zh-Hans": {
   "title": "节日主题、更流畅的动画及手势，AI 助理可连续发送消息",
   "items": [
    "节日期间，首页及「今天」页面会加入小装饰，例如万圣节的南瓜灯及蝙蝠；如不需要，可在「设置」中关闭「节日主题」。",
    "按钮、清单及页面切换的动画更流畅，完成提醒时会有简短的动画；装置设置了减少动态效果时，动画会自动停用。",
    "在手机上向左扫动提醒即可标示完成（已完成的提醒则会删除），并可按「复原」取消；在页面顶部向下拉即可刷新。",
    "AI 助理回复期间仍可继续输入及发送消息：消息会先标示为「待传送」，回复完成后一并发送，AI 会合并回答或逐一回应。"
   ]
  },
  "en": {
   "title": "Holiday themes, smoother motion and gestures, and keep typing to the AI Agent",
   "items": [
    "Around the holidays, the homepage and Today get small seasonal touches, like jack-o'-lanterns and bats for Halloween. Turn off “Holiday themes” in Settings if you prefer.",
    "Smoother animations for buttons, lists and page changes, plus a small animation when you complete a reminder. Animations switch off when your device is set to reduce motion.",
    "On phones, swipe a reminder left to mark it done (a done reminder is deleted), with Undo; pull down at the top of a page to refresh.",
    "Keep sending messages while the AI Agent is replying: they show as “Queued” and go out together when the reply ends, and the AI answers them together or one by one."
   ]
  }
 },
 {
  "version": "1.16.0",
  "date": "2026-10-20",
  "zh-Hant": {
   "title": "電郵驗證碼，網誌、更新日誌及服務狀態有自己的網址",
   "items": [
    "網誌已遷至 blog.nesty.cyou，更新日誌已遷至 changelog.nesty.cyou，舊連結會自動轉到新網址。",
    "網站選單及頁尾新增「狀態」連結，可隨時打開 status.nesty.cyou 查看服務是否運作正常。",
    "以電郵及密碼註冊的新帳戶，會收到 6 位數驗證碼，輸入後即可確認電郵地址並開始使用。",
    "重設密碼郵件改由 Nest（noreply@nesty.cyou）發出，連結會開啟 Nest 自己的頁面。",
    "首頁換上全新的草地及天空設計，並新增日間及夜間模式：點按語言選單旁的太陽或月亮按鈕即可切換。",
    "首頁的天空、太陽、月亮及草地改用更真實的圖像；修正在平板電腦及手機上打開選單時，選單被首頁圖像遮住的問題。"
   ]
  },
  "zh-Hans": {
   "title": "邮箱验证码，网志、更新日志及服务状态有自己的网址",
   "items": [
    "网志已迁至 blog.nesty.cyou，更新日志已迁至 changelog.nesty.cyou，旧链接会自动转到新网址。",
    "网站菜单及页尾新增「状态」链接，可随时打开 status.nesty.cyou 查看服务是否运作正常。",
    "以邮箱及密码注册的新账户，会收到 6 位数验证码，输入后即可确认邮箱地址并开始使用。",
    "重设密码邮件改由 Nest（noreply@nesty.cyou）发出，链接会开启 Nest 自己的页面。",
    "首页换上全新的草地及天空设计，并新增日间及夜间模式：点按语言菜单旁的太阳或月亮按钮即可切换。",
    "首页的天空、太阳、月亮及草地改用更真实的图像；修正在平板电脑及手机上打开菜单时，菜单被首页图像遮住的问题。"
   ]
  },
  "en": {
   "title": "Email codes, and new homes for the blog, changelog and status page",
   "items": [
    "The blog now lives at blog.nesty.cyou and the changelog at changelog.nesty.cyou. Old links forward automatically.",
    "A new Status link in the site menu and footer opens status.nesty.cyou, so you can check at any time that everything is working.",
    "New email-and-password accounts get a 6-digit code by email to confirm the address before starting.",
    "Password reset emails now come from Nest (noreply@nesty.cyou) and open Nest’s own page.",
    "A new look for the home page: blue sky and grassy hills by day, a starry sky by night. Switch with the sun / moon button next to the language menu.",
    "The home page sky, sun, moon and grass now use realistic images, and the menu no longer hides behind the home page picture on tablets and phones."
   ]
  }
 },
 {
  "version": "1.15.0",
  "date": "2026-10-20",
  "zh-Hant": {
   "title": "新網址 nesty.cyou、私隱政策及服務狀態頁",
   "items": [
    "Nest 的新網址是 https://nesty.cyou，舊網址會自動轉到新網址。",
    "全新的私隱政策及服務條款頁面（英文、繁體中文及簡體中文），清楚說明 Nest 如何使用已連接的 Google 帳戶資料。",
    "重設密碼及驗證電郵的連結會開啟 Nest 自己的頁面，可直接在頁面上設定新密碼。",
    "新增服務狀態頁 nesty.cyou/status，隨時查看網站、應用程式、AI、登入、推送通知及 Google 連接是否運作正常。"
   ]
  },
  "zh-Hans": {
   "title": "新网址 nesty.cyou、私隐政策及服务状态页",
   "items": [
    "Nest 的新网址是 https://nesty.cyou，旧网址会自动转到新网址。",
    "全新的私隐政策及服务条款页面（英文、繁体中文及简体中文），清楚说明 Nest 如何使用已连接的 Google 账户资料。",
    "重设密码及验证邮箱的链接会开启 Nest 自己的页面，可直接在页面上设置新密码。",
    "新增服务状态页 nesty.cyou/status，随时查看网站、应用、AI、登录、推送通知及 Google 连接是否运作正常。"
   ]
  },
  "en": {
   "title": "New address nesty.cyou, privacy policy and status page",
   "items": [
    "Nest now lives at https://nesty.cyou. Old addresses forward to it automatically.",
    "New Privacy Policy and Terms pages (English, Traditional and Simplified Chinese) that explain clearly how Nest uses data from connected Google accounts.",
    "Password reset and email verification links now open Nest’s own page, where you can set a new password right away.",
    "New status page at nesty.cyou/status showing whether the website, app, AI, sign-in, push notifications and Google connections are working."
   ]
  }
 },
 {
  "version": "1.14.0",
  "date": "2026-10-19",
  "zh-Hant": {
   "title": "支援 12 種語言",
   "items": [
    "語言選擇改為一個下拉選單（國旗及語言名稱），網站每一頁、登入頁及應用程式內都相同，在手機選單內亦可直接切換。",
    "新增日文、韓文、西班牙文、法文、德文、葡萄牙文（巴西）、印尼文、越南文及泰文：網站各頁已有這些語言版本，應用程式的主要畫面亦已翻譯，其餘部分暫時以英文顯示。",
    "選擇了新語言後，Nest AI 會以該語言回覆。",
    "首次開啟網站時，會按你的瀏覽器語言自動選擇。"
   ]
  },
  "zh-Hans": {
   "title": "支持 12 种语言",
   "items": [
    "语言选择改为一个下拉选单（国旗及语言名称），网站每一页、登录页及应用内都相同，在手机选单内亦可直接切换。",
    "新增日文、韩文、西班牙文、法文、德文、葡萄牙文（巴西）、印尼文、越南文及泰文：网站各页已有这些语言版本，应用的主要画面亦已翻译，其余部分暂时以英文显示。",
    "选择了新语言后，Nest AI 会以该语言回复。",
    "首次开启网站时，会按你的浏览器语言自动选择。"
   ]
  },
  "en": {
   "title": "Nest in 12 languages",
   "items": [
    "The language picker is now one dropdown (flag and language name) on every page of the website, the sign-in page and inside the app, and you can switch from the mobile menu too.",
    "New languages: Japanese, Korean, Spanish, French, German, Portuguese (Brazil), Indonesian, Vietnamese and Thai. The website is fully available in them and the app’s main screens are translated; the rest shows in English for now.",
    "When you choose one of these languages, Nest AI replies in it.",
    "On your first visit the website picks your browser’s language automatically."
   ]
  }
 },
 {
  "version": "1.13.0",
  "date": "2026-10-19",
  "zh-Hant": {
   "title": "連接 GitHub",
   "items": [
    "「連接」新增 GitHub：連接後，Nest AI 可以列出及讀取你的程式庫、建立程式庫、提交檔案、開分支及拉取請求，亦可以把網站或程式碼直接放進程式庫及啟用 GitHub Pages。",
    "每次建立或修改內容前，對話中都會先顯示確認卡；Nest 不會刪除任何程式庫或檔案。",
    "學生帳戶需要家庭擁有人開啟允許才可以連接。",
    "網誌編輯器的「上載圖片」改為一般按鈕，在 iPhone 及 iPad 上更容易使用。"
   ]
  },
  "zh-Hans": {
   "title": "连接 GitHub",
   "items": [
    "「连接」新增 GitHub：连接后，Nest AI 可以列出及读取你的程序库、建立程序库、提交文件、开分支及拉取请求，亦可以把网站或代码直接放进程序库及启用 GitHub Pages。",
    "每次建立或修改内容前，对话中都会先显示确认卡；Nest 不会删除任何程序库或文件。",
    "学生账户需要家庭拥有人开启允许才可以连接。",
    "网志编辑器的「上传图片」改为一般按钮，在 iPhone 及 iPad 上更容易使用。"
   ]
  },
  "en": {
   "title": "Connect GitHub",
   "items": [
    "Connections now include GitHub: once connected, Nest AI can list and read your repos, create repos, commit files, open branches and pull requests, put a site or code straight into a repo and turn on GitHub Pages.",
    "Before creating or changing anything, chat shows a confirm card first; Nest never deletes repos or files.",
    "Student accounts need the family owner to allow it first.",
    "The blog editor’s Upload image is now a normal button that works better on iPhone and iPad."
   ]
  }
 },
 {
  "version": "1.12.0",
  "date": "2026-10-19",
  "zh-Hant": {
   "title": "全新登入頁面及網誌",
   "items": [
    "登入、註冊及重設密碼頁面重新設計：精簡的表格，左邊展示 Nest 的實際畫面，整頁不用捲動。",
    "已登入的用戶在網站各頁會看到「進入應用」，一按即回到 Nest。",
    "帳戶選單更精簡，不會再遮蓋整個畫面。",
    "網誌：Nest 團隊的文章以三種語言發佈，支援封面圖片、圖片及影片。",
    "修正：英文及簡體中文主頁的互動示範現已正常顯示。"
   ]
  },
  "zh-Hans": {
   "title": "全新登录页面及网志",
   "items": [
    "登录、注册及重设密码页面重新设计：精简的表格，左边展示 Nest 的实际画面，整页不用卷动。",
    "已登录的用户在网站各页会看到「进入应用」，一按即回到 Nest。",
    "账户选单更精简，不会再遮盖整个画面。",
    "网志：Nest 团队的文章以三种语言发布，支持封面图片、图片及视频。",
    "修正：英文及简体中文主页的互动示范现已正常显示。"
   ]
  },
  "en": {
   "title": "New sign-in page and blog",
   "items": [
    "Sign in, sign up and password reset are redesigned: a compact form beside real Nest screens, all on one screen with no scrolling.",
    "When you are signed in, the website shows “Enter app”, one tap back to Nest.",
    "The account menu is smaller and no longer covers the whole screen.",
    "Blog: posts from the Nest team in three languages, with cover images, pictures and videos.",
    "Fix: the interactive demo now shows on the English and Simplified Chinese home pages."
   ]
  }
 },
 {
  "version": "1.11.0",
  "date": "2026-10-19",
  "zh-Hant": {
   "title": "選擇你的國家或地區",
   "items": [
    "Nest 現已服務世界各地的家庭：註冊時在互動地球儀上選擇國家或地區，之後可在「設定 → 國家／地區」隨時更改。",
    "按所在地提供本地資訊：公眾假期、交通及天氣連結、緊急電話，以及功課導師參考的考試制度（例如 DSE、GCSE、SAT、高考）。",
    "AI 助理會按你的所在地回答，不再假設你住在香港；港鐵及巴士到站時間、天文台警告等香港即時資訊只在選擇香港時顯示。",
    "修正：在主頁示範中更改名稱不會再影響你的公開個人頁。"
   ]
  },
  "zh-Hans": {
   "title": "选择你的国家或地区",
   "items": [
    "Nest 现已服务世界各地的家庭：注册时在互动地球仪上选择国家或地区，之后可在「设置 → 国家／地区」随时更改。",
    "按所在地提供本地信息：公众假期、交通及天气链接、紧急电话，以及功课导师参考的考试制度（例如 DSE、GCSE、SAT、高考）。",
    "AI 助理会按你的所在地回答，不再假设你住在香港；港铁及巴士到站时间、天文台警告等香港即时信息只在选择香港时显示。",
    "修正：在主页示范中更改名称不会再影响你的公开个人页。"
   ]
  },
  "en": {
   "title": "Choose your country or region",
   "items": [
    "Nest now works for families everywhere: pick your country or region on an interactive globe when you sign up, and change it any time in Settings → Country / Region.",
    "Local info for where you live: public holidays, transport and weather links, emergency numbers, and the exam system the homework tutor uses (for example DSE, GCSE, SAT, Gaokao).",
    "The AI answers for your region and no longer assumes you live in Hong Kong; live Hong Kong info such as MTR and bus arrivals and Observatory warnings shows only when Hong Kong is selected.",
    "Fixed: changing the name in the home-page demo no longer affects your public profile."
   ]
  }
 },
 {
  "version": "1.10.0",
  "date": "2026-10-19",
  "zh-Hant": {
   "title": "三種語言的公開介紹頁",
   "items": [
    "新增 Nest 公開介紹頁，提供繁體中文、简体中文及英文版本：功能、價格、常見問題、插件、更新日誌，以及 Nest 與 ChatGPT 的功課幫手比較。",
    "主頁第一句清楚說明 Nest 是甚麼：為香港學生及家長而設的免費 AI 家庭應用程式。",
    "介紹頁無需載入應用程式即可快速開啟，手機及深色模式均易讀。"
   ]
  },
  "zh-Hans": {
   "title": "三种语言的公开介绍页",
   "items": [
    "新增 Nest 公开介绍页，提供繁体中文、简体中文及英文版本：功能、价格、常见问题、插件、更新日志，以及 Nest 与 ChatGPT 的功课帮手比较。",
    "主页第一句清楚说明 Nest 是甚么：为香港学生及家长而设的免费 AI 家庭应用。",
    "介绍页无需载入应用即可快速开启，手机及深色模式均易读。"
   ]
  },
  "en": {
   "title": "Public pages in three languages",
   "items": [
    "New public pages about Nest in Traditional Chinese, Simplified Chinese and English: features, pricing, FAQ, plugins, changelog and an honest Nest vs ChatGPT comparison for homework.",
    "The home page now says in its first sentence what Nest is: a free AI family app for students and parents in Hong Kong.",
    "The pages open fast without loading the app and are easy to read on phones and in dark mode."
   ]
  }
 },
 {
  "version": "1.9.0",
  "date": "2026-10-19",
  "zh-Hant": {
   "title": "最新消息與服務狀態",
   "items": [
    "新增「最新消息」：Nest 的重要更新會以置中視窗、頂部橫額或小提示顯示，可隨時關閉或選擇「不再顯示」。",
    "系統維護期間，App 會顯示清楚的維護訊息及預計恢復時間。",
    "如某項功能暫時停用，App 會清楚說明，不會再出現錯誤訊息。",
    "可使用 Nest 提供的優惠碼換取 Pro。"
   ]
  },
  "zh-Hans": {
   "title": "最新消息与服务状态",
   "items": [
    "新增「最新消息」：Nest 的重要更新会以置中窗口、顶部横额或小提示显示，可随时关闭或选择「不再显示」。",
    "系统维护期间，App 会显示清楚的维护消息及预计恢复时间。",
    "如某项功能暂时停用，App 会清楚说明，不会再出现错误消息。",
    "可使用 Nest 提供的优惠码换取 Pro。"
   ]
  },
  "en": {
   "title": "What’s new messages and service status",
   "items": [
    "New “What’s new” messages: important Nest updates appear as a centred card, a top banner or a small toast — close them any time or choose “Don’t show again”.",
    "During maintenance the app shows a clear message and when Nest expects to be back.",
    "If a feature is temporarily turned off, the app explains it instead of showing an error.",
    "Promo codes from Nest can be redeemed for Pro."
   ]
  }
 },
 {
  "version": "1.8.0",
  "date": "2026-10-19",
  "zh-Hant": {
   "title": "AI 可以直接畫圖",
   "items": [
    "AI 助理及功課導師可以直接在對話中畫圖：光的折射及反射圖（自動按折射率計算折射角）、透鏡及面鏡、受力圖、電路、幾何圖、座標軸及簡單插圖。",
    "說「畫一個光的折射圖」或「畫一隻貓」即可；圖像會自動適應手機闊度，並支援深色模式。",
    "圖表未能顯示時，會顯示「未能顯示圖表」並可一按重試，不再出現一堆代碼。",
    "對話中的程式碼區塊改用深色模式也易讀的配色，過長的內容只會在區塊內左右捲動。"
   ]
  },
  "zh-Hans": {
   "title": "AI 可以直接画图",
   "items": [
    "AI 助理及功课导师可以直接在对话中画图：光的折射及反射图（自动按折射率计算折射角）、透镜及面镜、受力图、电路、几何图、座标轴及简单插图。",
    "说「画一个光的折射图」或「画一只猫」即可；图像会自动适应手机阔度，并支持深色模式。",
    "图表未能显示时，会显示「未能显示图表」并可一按重试，不再出现一堆代码。",
    "对话中的代码区块改用深色模式也易读的配色，过长的内容只会在区块内左右卷动。"
   ]
  },
  "en": {
   "title": "Nest can draw",
   "items": [
    "AI Assistant and Homework Tutor can draw right in the chat: light refraction and reflection diagrams (the refraction angle is worked out from the refractive indices), lenses and mirrors, force diagrams, circuits, geometry, axes and simple illustrations.",
    "Just ask, e.g. “Draw a light refraction diagram” or “Draw a cat”. Drawings fit your phone screen and work in dark mode.",
    "If a drawing can’t be shown you now see “Couldn’t show this diagram” with a one-tap retry instead of raw code.",
    "Code blocks in chat are readable in dark mode and long lines scroll inside the block only."
   ]
  }
 },
 {
  "version": "1.7.0",
  "date": "2026-10-19",
  "zh-Hant": {
   "title": "互動圖表與更新日誌",
   "items": [
    "AI 助理及功課導師可按需要顯示互動內容：可拉動滑桿的函數圖、受力圖、電路圖、光線圖、圖表、小測、逐步解題、閃卡、時間線及比較表。",
    "新增「最新動態」頁面，列出每次更新的內容。",
    "AI 助理知道你正在使用哪一頁、哪類裝置及語言，回答使用問題更準確。",
    "插件創作者可直接修改已上架插件的介紹、圖示、分類、連結及最多 6 張截圖；插件商店詳情頁新增可左右滑動的截圖。",
    "插件工作室的 AI 修改更穩定，失敗時會自動重試一次並清楚說明原因。",
    "修正：回覆偶爾不斷重複同一字詞的問題。",
    "修正：「提我……」現在會正確建立提醒。",
    "修正：確認後再追問，不會再重複建立同一個提醒。",
    "繁體中文回覆統一使用香港書面語。"
   ]
  },
  "zh-Hans": {
   "title": "互动图表与更新日志",
   "items": [
    "AI 助理及功课导师可按需要显示互动内容：可拉动滑杆的函数图、受力图、电路图、光线图、图表、小测、逐步解题、闪卡、时间线及比较表。",
    "新增「最新动态」页面，列出每次更新的内容。",
    "AI 助理知道你正在使用哪一页、哪类装置及语言，回答使用问题更准确。",
    "插件创作者可直接修改已上架插件的介绍、图示、分类、链接及最多 6 张截图；插件商店详情页新增可左右滑动的截图。",
    "插件工作室的 AI 修改更稳定，失败时会自动重试一次并清楚说明原因。",
    "修正：回复偶尔不断重复同一字词的问题。",
    "修正：「提我……」现在会正确建立提醒。",
    "修正：确认后再追问，不会再重复建立同一个提醒。",
    "繁体中文回复统一使用香港书面语。"
   ]
  },
  "en": {
   "title": "Interactive visuals and a changelog",
   "items": [
    "AI Assistant and Homework Tutor can show interactive content when it helps: graphs with sliders, force, circuit and ray diagrams, charts, quizzes, step-by-step solutions, flashcards, timelines and comparison tables.",
    "New What's new page listing every update.",
    "The assistant knows which page, device and language you are using, so how-to answers are more accurate.",
    "Plugin creators can edit a published listing — description, icon, category, links and up to 6 screenshots; store pages now have a swipeable screenshot gallery.",
    "More reliable AI edits in Plugin Studio, with one automatic retry and a clearer message if it still fails.",
    "Fixed: replies that occasionally repeated the same word over and over.",
    "Fixed: “remind me …” requests now create a reminder.",
    "Fixed: asking again after confirming no longer creates a duplicate reminder.",
    "Traditional Chinese replies now consistently use Hong Kong written Chinese."
   ]
  }
 },
 {
  "version": "1.6.0",
  "date": "2026-10-18",
  "zh-Hant": {
   "title": "更可靠的答案與計劃顯示",
   "items": [
    "AI 助理回答事實問題時會先查閱維基百科，並附上來源。",
    "回覆時會顯示目前進度，例如正在查閱資料。",
    "各處清楚顯示目前計劃、來源及到期日。",
    "iPad 側邊欄：帳戶列固定在底部，中間部分可捲動。",
    "日期改用「2026年10月18日（週日）」格式，對話記錄分為今天、昨天、過去 7 天等。",
    "插件工作室：版本記錄、比較及還原。"
   ]
  },
  "zh-Hans": {
   "title": "更可靠的答案与计划显示",
   "items": [
    "AI 助理回答事实问题时会先查阅维基百科，并附上来源。",
    "回复时会显示目前进度，例如正在查阅资料。",
    "各处清楚显示目前计划、来源及到期日。",
    "iPad 侧边栏：账户列固定在底部，中间部分可卷动。",
    "日期改用「2026年10月18日（周日）」格式，对话记录分为今天、昨天、过去 7 天等。",
    "插件工作室：版本记录、比较及还原。"
   ]
  },
  "en": {
   "title": "More reliable answers and plan labels",
   "items": [
    "The assistant looks facts up on Wikipedia first and shows its sources.",
    "Live status while a reply is being prepared, such as looking something up.",
    "Your current plan, where it comes from and when it ends are shown everywhere.",
    "iPad sidebar: the account row stays pinned at the bottom and the middle scrolls.",
    "Dates and chat history groups are clearer (Today, Yesterday, Previous 7 days …).",
    "Plugin Studio: version history, compare and restore."
   ]
  }
 },
 {
  "version": "1.5.0",
  "date": "2026-10-18",
  "zh-Hant": {
   "title": "公開個人頁、簡體中文及 App 圖示",
   "items": [
    "新增公開個人頁：@用戶名稱、橫額、簡介及連結。",
    "認證標記。",
    "新增简体中文介面。",
    "數學公式以清晰的排版顯示。",
    "可在設定中選擇 App 圖示（天空、夜空、日本等）。"
   ]
  },
  "zh-Hans": {
   "title": "公开个人页、简体中文及 App 图示",
   "items": [
    "新增公开个人页：@用户名称、横额、简介及链接。",
    "认证标记。",
    "新增简体中文界面。",
    "数学公式以清晰的排版显示。",
    "可在设置中选择 App 图示（天空、夜空、日本等）。"
   ]
  },
  "en": {
   "title": "Public profiles, Simplified Chinese and app icons",
   "items": [
    "Public profile with @handle, banner, bio and links.",
    "Verified badges.",
    "Simplified Chinese interface.",
    "Maths formulas are typeset clearly.",
    "Choose your app icon in Settings (Sky, Night, Japan and more)."
   ]
  }
 },
 {
  "version": "1.4.0",
  "date": "2026-10-18",
  "zh-Hant": {
   "title": "插件、附件及 Beta",
   "items": [
    "插件商店及插件工作室：安裝主題、主頁小工具及新分頁，或自行製作插件。",
    "插件權限清楚列明風險，可隨時逐項關閉。",
    "AI 助理可閱讀相片、PDF、Word 文件及短片；學校通告可一按建立提醒。",
    "Beta 用戶可領取一個月 Pro。"
   ]
  },
  "zh-Hans": {
   "title": "插件、附件及 Beta",
   "items": [
    "插件商店及插件工作室：安装主题、主页小工具及新分页，或自行制作插件。",
    "插件权限清楚列明风险，可随时逐项关闭。",
    "AI 助理可阅读照片、PDF、Word 文件及短片；学校通告可一按建立提醒。",
    "Beta 用户可领取一个月 Pro。"
   ]
  },
  "en": {
   "title": "Plugins, attachments and Beta",
   "items": [
    "Plugin Store and Plugin Studio: install themes, Home widgets and new tabs, or build your own.",
    "Plugin permissions show their risk and can be switched off one by one.",
    "The assistant reads photos, PDFs, Word documents and short videos; school notices become a reminder in one tap.",
    "Beta users can claim one month of Pro."
   ]
  }
 },
 {
  "version": "1.3.0",
  "date": "2026-10-18",
  "zh-Hant": {
   "title": "香港生活資訊",
   "items": [
    "天氣、警告及公眾假期。",
    "交通頁：港鐵及巴士實時到站時間、常用路線。",
    "今日摘要按類別整理。",
    "對話記錄：搜尋、釘選、重新命名及滑動刪除。",
    "分享連結會顯示預覽卡。"
   ]
  },
  "zh-Hans": {
   "title": "香港生活信息",
   "items": [
    "天气、警告及公众假期。",
    "交通页：港铁及巴士实时到站时间、常用路线。",
    "今日摘要按类别整理。",
    "对话记录：搜索、钉选、重新命名及滑动删除。",
    "分享链接会显示预览卡。"
   ]
  },
  "en": {
   "title": "Hong Kong essentials",
   "items": [
    "Weather, warnings and public holidays.",
    "Transport page: live MTR and bus arrivals and saved trips.",
    "Today's brief grouped by topic.",
    "Chat history: search, pin, rename and swipe to delete.",
    "Shared links show a preview card."
   ]
  }
 },
 {
  "version": "1.2.0",
  "date": "2026-10-18",
  "zh-Hant": {
   "title": "日曆及帳戶選單",
   "items": [
    "新增日曆分頁。",
    "全新帳戶選單及「更多」頁。",
    "個人頭像。",
    "連接頁重新設計。"
   ]
  },
  "zh-Hans": {
   "title": "日历及账户选单",
   "items": [
    "新增日历分页。",
    "全新账户选单及「更多」页。",
    "个人头像。",
    "连接页重新设计。"
   ]
  },
  "en": {
   "title": "Calendar and account menu",
   "items": [
    "New Calendar tab.",
    "New account menu and More page.",
    "Profile photos.",
    "Redesigned Connections page."
   ]
  }
 },
 {
  "version": "1.1.0",
  "date": "2026-10-17",
  "zh-Hant": {
   "title": "連接 Google 及通知",
   "items": [
    "連接多個 Google 帳戶：Gmail、Google 日曆、Classroom 及 Drive。",
    "每日的今日摘要。",
    "可安裝成 App，並接收推送通知。",
    "付費計劃候補名單。"
   ]
  },
  "zh-Hans": {
   "title": "连接 Google 及通知",
   "items": [
    "连接多个 Google 账户：Gmail、Google 日历、Classroom 及 Drive。",
    "每日的今日摘要。",
    "可安装成 App，并接收推送通知。",
    "付费计划候补名单。"
   ]
  },
  "en": {
   "title": "Google connections and notifications",
   "items": [
    "Connect several Google accounts: Gmail, Google Calendar, Classroom and Drive.",
    "A daily brief.",
    "Install Nest as an app and get push notifications.",
    "Waitlist for paid plans."
   ]
  }
 },
 {
  "version": "1.0.0",
  "date": "2026-10-17",
  "zh-Hant": {
   "title": "Nest 巢 推出",
   "items": [
    "AI 助理：建立提醒、記下家庭資料及更改設定。",
    "功課導師：逐步提示，不直接給答案。",
    "溫習測驗及家庭記憶。",
    "邀請家人加入同一個家庭。"
   ]
  },
  "zh-Hans": {
   "title": "Nest 巢 推出",
   "items": [
    "AI 助理：建立提醒、记下家庭资料及更改设置。",
    "功课导师：逐步提示，不直接给答案。",
    "温习测验及家庭记忆。",
    "邀请家人加入同一个家庭。"
   ]
  },
  "en": {
   "title": "Nest launches",
   "items": [
    "AI Assistant: creates reminders, saves family details and changes settings.",
    "Homework Tutor: hints step by step instead of giving the answer.",
    "Study quizzes and family memory.",
    "Invite family members to one shared family."
   ]
  }
 }
];

export const APP_VERSION = CHANGELOG[0].version;
export const latestEntry = () => CHANGELOG[0];
// Latest n entries in one language (AI 'what is new' answers, toast).
export const latestFor = (lang = 'zh-Hant', n = 3) => CHANGELOG.slice(0, n).map((e) => ({ version: e.version, date: e.date, ...(e[lang] || e['zh-Hant']) }));
export const CHANGELOG_PATH = '/app/changelog';
