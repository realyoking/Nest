// Run 24 strings (zh-Hant 香港書面語 / en / th). Merged into STRINGS by strings.js and into TH by locales/th.js under `r24`.
export const R24 = {
  'zh-Hant': {
    scan: {
      title: '掃描文件', sub: '拍下工作紙或文件，自動裁剪、拉直及去除陰影。全部在你的裝置上處理，不會上載。', open: '掃描文件',
      camera: '拍照', upload: '選擇圖片', pickHint: '把文件放在深色桌面上，光線均勻，四角入鏡效果最好。', loading: '正在處理…', badFile: '未能讀取這張圖片，請選擇另一張。',
      cropTitle: '調整四角', cropHint: '拖動四個圓點對準文件邊角，或使用方向鍵微調。', auto: '自動偵測', full: '整張相片', notFound: '找不到文件邊緣，已選取整張相片，請手動調整。', next: '下一步', retake: '重新選擇',
      corner: { tl: '左上角', tr: '右上角', br: '右下角', bl: '左下角' },
      filter: '效果', filters: { color: '彩色', gray: '灰階', bw: '黑白' },
      remove: '移除手寫', removeModes: { off: '不移除', auto: '自動', color: '彩色筆跡', dark: '深色筆跡' },
      removeHint: { off: '保留所有內容。', auto: '自動找出彩色筆跡、深色筆跡及鉛筆字並移除，保留印刷題目、圖表及線條。', color: '只移除藍色、紅色、綠色等彩色筆跡，保留黑色印刷文字及線條。', dark: '分辨手寫與印刷字，移除黑色或深色筆跡及鉛筆字，保留印刷題目、圖表及線條。效果視乎字跡，請檢查並用擦除／還原修正。' },
      lower: '效果視乎字跡', tools: '工具', tool: { compare: '比較', erase: '擦除', restore: '還原' }, size: '筆刷大小', undo: '撤銷', recrop: '重新裁剪',
      before: '原圖', after: '處理後', compareHint: '左右拖動比較原圖與處理後的效果。', brushHint: '在圖上塗抹：擦除會變成白色，還原會恢復原本內容。',
      saveImg: '儲存為圖片', savePdf: '儲存為 PDF', saved: '已儲存「{name}」', fileName: '掃描', onDevice: '只在你的裝置上處理',
      removed: '已移除約 {n}% 的頁面內容', step: '第 {n} 步，共 3 步',
      autoPicked: '主要筆跡：{mode}', detected: '偵測到：{list}', nothing: '沒有偵測到手寫', kinds: { color: '彩色筆跡', dark: '深色筆跡', pencil: '鉛筆字跡' },
      stages: { detect: '正在找出文件邊緣', warp: '正在拉直頁面', enhance: '正在去除陰影', color: '正在尋找彩色筆跡', components: '正在分析筆畫', lines: '正在辨認印刷文字', shapes: '正在辨認圖表及線條', classify: '正在分辨手寫與印刷字', mask: '正在移除手寫', compose: '即將完成' },
      pages: '頁面', pageOf: '第 {n}／{total} 頁', addCamera: '再拍一頁', addUpload: '加入圖片', delPage: '刪除此頁', retakePage: '重拍此頁', moveLeft: '向前移', moveRight: '向後移',
      applyAll: '套用到所有頁面', applied: '已套用到 {n} 頁', processingN: '正在處理第 {n}／{total} 頁', savePdfAll: '儲存為 PDF（{n} 頁）', saveImgs: '儲存所有圖片（{n} 張）', reorderHint: '拖動縮圖可調整次序。', maxPages: '每次最多 {n} 頁', deleted: '已刪除第 {n} 頁', pickMany: '可一次選擇多張圖片。',
    },
  },
  en: {
    scan: {
      title: 'Scan a document', sub: 'Snap a worksheet or document — it is cropped, straightened and de-shadowed automatically. Everything runs on your device; nothing is uploaded.', open: 'Scan',
      camera: 'Take photo', upload: 'Choose image', pickHint: 'Best results: document on a darker surface, even light, all four corners in the frame.', loading: 'Processing…', badFile: 'Couldn’t read that image — please pick another.',
      cropTitle: 'Adjust corners', cropHint: 'Drag the four dots onto the corners of the page, or nudge them with the arrow keys.', auto: 'Auto-detect', full: 'Whole photo', notFound: 'Couldn’t find the page edges, so the whole photo is selected — adjust the corners.', next: 'Next', retake: 'Choose again',
      corner: { tl: 'Top-left corner', tr: 'Top-right corner', br: 'Bottom-right corner', bl: 'Bottom-left corner' },
      filter: 'Look', filters: { color: 'Colour', gray: 'Greyscale', bw: 'B&W' },
      remove: 'Remove handwriting', removeModes: { off: 'Off', auto: 'Auto', color: 'Colour ink', dark: 'Dark pen' },
      removeHint: { off: 'Keeps everything.', auto: 'Finds coloured ink, dark pen and pencil and removes them, keeping printed questions, diagrams and lines.', color: 'Removes only blue, red, green and other coloured ink; keeps black printed text and lines.', dark: 'Tells handwriting from print and removes black or dark pen and pencil, keeping printed questions, diagrams and lines. Results vary with the handwriting — check it and fix with Erase / Restore.' },
      lower: 'Results vary', tools: 'Tools', tool: { compare: 'Compare', erase: 'Erase', restore: 'Restore' }, size: 'Brush size', undo: 'Undo', recrop: 'Re-crop',
      before: 'Before', after: 'After', compareHint: 'Drag left and right to compare before and after.', brushHint: 'Paint on the page: Erase turns it white, Restore brings back what was there.',
      saveImg: 'Save image', savePdf: 'Save PDF', saved: 'Saved “{name}”', fileName: 'Scan', onDevice: 'Processed on your device only',
      removed: 'Removed about {n}% of the page', step: 'Step {n} of 3',
      autoPicked: 'Mostly: {mode}', detected: 'Found: {list}', nothing: 'No handwriting found', kinds: { color: 'coloured ink', dark: 'dark pen', pencil: 'pencil' },
      stages: { detect: 'Finding the page edges', warp: 'Straightening the page', enhance: 'Removing shadows', color: 'Looking for coloured ink', components: 'Analysing strokes', lines: 'Recognising printed text', shapes: 'Recognising diagrams and lines', classify: 'Telling handwriting from print', mask: 'Removing handwriting', compose: 'Almost done' },
      pages: 'Pages', pageOf: 'Page {n} of {total}', addCamera: 'Add photo', addUpload: 'Add images', delPage: 'Delete page', retakePage: 'Retake page', moveLeft: 'Move earlier', moveRight: 'Move later',
      applyAll: 'Apply to all pages', applied: 'Applied to {n} pages', processingN: 'Processing page {n} of {total}', savePdfAll: 'Save PDF ({n} pages)', saveImgs: 'Save all images ({n})', reorderHint: 'Drag thumbnails to reorder.', maxPages: 'Up to {n} pages at a time', deleted: 'Deleted page {n}', pickMany: 'You can pick several images at once.',
    },
  },
  th: {
    scan: {
      title: 'สแกนเอกสาร', sub: 'ถ่ายรูปใบงานหรือเอกสาร ระบบจะครอบตัด ปรับให้ตรง และลบเงาให้อัตโนมัติ ทุกอย่างประมวลผลบนอุปกรณ์ของคุณ ไม่มีการอัปโหลด', open: 'สแกน',
      camera: 'ถ่ายรูป', upload: 'เลือกรูปภาพ', pickHint: 'ผลดีที่สุด: วางเอกสารบนพื้นสีเข้ม แสงสม่ำเสมอ และให้เห็นทั้งสี่มุม', loading: 'กำลังประมวลผล…', badFile: 'อ่านรูปนี้ไม่ได้ โปรดเลือกรูปอื่น',
      cropTitle: 'ปรับมุม', cropHint: 'ลากจุดทั้งสี่ไปที่มุมของเอกสาร หรือใช้ปุ่มลูกศรเพื่อขยับ', auto: 'ตรวจหาอัตโนมัติ', full: 'ทั้งรูป', notFound: 'หาขอบเอกสารไม่พบ จึงเลือกทั้งรูป โปรดปรับมุมเอง', next: 'ถัดไป', retake: 'เลือกใหม่',
      corner: { tl: 'มุมซ้ายบน', tr: 'มุมขวาบน', br: 'มุมขวาล่าง', bl: 'มุมซ้ายล่าง' },
      filter: 'รูปแบบ', filters: { color: 'สี', gray: 'ขาวเทา', bw: 'ขาวดำ' },
      remove: 'ลบลายมือ', removeModes: { off: 'ปิด', auto: 'อัตโนมัติ', color: 'หมึกสี', dark: 'ปากกาเข้ม' },
      removeHint: { off: 'เก็บทุกอย่างไว้', auto: 'ค้นหาหมึกสี ปากกาเข้ม และดินสอ แล้วลบออก โดยเก็บโจทย์ที่พิมพ์ แผนภาพ และเส้นไว้', color: 'ลบเฉพาะหมึกสีน้ำเงิน แดง เขียว และสีอื่น ๆ โดยเก็บตัวพิมพ์และเส้นสีดำไว้', dark: 'แยกลายมือออกจากตัวพิมพ์ แล้วลบปากกาสีดำหรือสีเข้มและดินสอ โดยเก็บโจทย์ที่พิมพ์ แผนภาพ และเส้นไว้ ผลลัพธ์ขึ้นกับลายมือ โปรดตรวจสอบและแก้ด้วยลบ / คืนค่า' },
      lower: 'ผลลัพธ์ขึ้นกับลายมือ', tools: 'เครื่องมือ', tool: { compare: 'เปรียบเทียบ', erase: 'ลบ', restore: 'คืนค่า' }, size: 'ขนาดแปรง', undo: 'เลิกทำ', recrop: 'ครอบตัดใหม่',
      before: 'ก่อน', after: 'หลัง', compareHint: 'ลากซ้ายขวาเพื่อเปรียบเทียบก่อนและหลัง', brushHint: 'ระบายบนหน้า: ลบจะเป็นสีขาว คืนค่าจะนำของเดิมกลับมา',
      saveImg: 'บันทึกรูปภาพ', savePdf: 'บันทึก PDF', saved: 'บันทึก “{name}” แล้ว', fileName: 'สแกน', onDevice: 'ประมวลผลบนอุปกรณ์ของคุณเท่านั้น',
      removed: 'ลบไปประมาณ {n}% ของหน้า', step: 'ขั้นที่ {n} จาก 3',
      autoPicked: 'ส่วนใหญ่: {mode}', detected: 'พบ: {list}', nothing: 'ไม่พบลายมือ', kinds: { color: 'หมึกสี', dark: 'ปากกาเข้ม', pencil: 'ดินสอ' },
      stages: { detect: 'กำลังหาขอบเอกสาร', warp: 'กำลังปรับหน้าให้ตรง', enhance: 'กำลังลบเงา', color: 'กำลังหาหมึกสี', components: 'กำลังวิเคราะห์เส้น', lines: 'กำลังจดจำตัวพิมพ์', shapes: 'กำลังจดจำแผนภาพและเส้น', classify: 'กำลังแยกลายมือกับตัวพิมพ์', mask: 'กำลังลบลายมือ', compose: 'ใกล้เสร็จแล้ว' },
      pages: 'หน้า', pageOf: 'หน้า {n} จาก {total}', addCamera: 'ถ่ายเพิ่ม', addUpload: 'เพิ่มรูปภาพ', delPage: 'ลบหน้านี้', retakePage: 'ถ่ายหน้านี้ใหม่', moveLeft: 'เลื่อนไปก่อน', moveRight: 'เลื่อนไปหลัง',
      applyAll: 'ใช้กับทุกหน้า', applied: 'ใช้กับ {n} หน้าแล้ว', processingN: 'กำลังประมวลผลหน้า {n} จาก {total}', savePdfAll: 'บันทึก PDF ({n} หน้า)', saveImgs: 'บันทึกรูปทั้งหมด ({n})', reorderHint: 'ลากรูปย่อเพื่อจัดลำดับ', maxPages: 'สูงสุด {n} หน้าต่อครั้ง', deleted: 'ลบหน้า {n} แล้ว', pickMany: 'เลือกหลายรูปพร้อมกันได้',
    },
  },
};

// Run 24 step 2a: suggestion frequency (Settings), Home panel customising, quiet-hours hint (Family).
const R24B = {
  'zh-Hant': {
    sf: {
      title: '主動建議', hint: '每天最多收到幾個主動建議。安靜時段內不會顯示。', opt: { off: '關閉', 1: '每日 1 個', 2: '每日 2 個', custom: '自訂', unlimited: '不限' },
      perDay: '每日最多', unit: '個', famOff: '家庭設定已關閉主動建議，由家長在「家庭」中開啟。', quietNote: '安靜時段：{from}–{to}', why: '每天最多 {n} 個建議，可在「設定」中調整。', whyAll: '建議次數不設上限，可在「設定」中調整。',
    },
    hp: {
      title: '我的面板', edit: '自訂', done: '完成', add: '加入面板', presets: '預設組合', preset: { simple: '簡潔', student: '學生', parent: '家長' },
      presetDesc: { simple: '只有購物清單', student: '功課進度、考試倒數、購物清單', parent: '全家功課進度及購物清單' },
      reset: '重設', resetAsk: '要移除所有面板嗎？', applied: '已套用「{name}」', cleared: '已移除所有面板', removed: '已移除面板', undo: '復原',
      size: '大小', sizes: { s: '小', m: '中', l: '大' }, settings: '面板設定', drag: '拖動排序', up: '上移', down: '下移', remove: '移除', save: '儲存',
      listName: '清單名稱', listPh: '例如：超級市場', scope: '顯示範圍', scopes: { mine: '只看自己', family: '全家' }, exam: '考試',
      empty: '首頁保持簡潔。選一個預設組合，或自行加入面板。', count: '{n}／{max} 個面板', dragHint: '按住 ⠿ 拖動，或用上移／下移排序。',
    },
    famq: { unset: '未設定', use: '使用 22:00–07:00', clear: '清除', example: '例如 22:00–07:00' },
  },
  en: {
    sf: {
      title: 'Proactive suggestions', hint: 'How many suggestions you get a day at most. None show during quiet hours.', opt: { off: 'Off', 1: '1 a day', 2: '2 a day', custom: 'Custom', unlimited: 'Unlimited' },
      perDay: 'Up to', unit: 'a day', famOff: 'Suggestions are off in Family settings — a parent can turn them on in Family.', quietNote: 'Quiet hours: {from}–{to}', why: 'Up to {n} a day — change it in Settings.', whyAll: 'No daily limit — change it in Settings.',
    },
    hp: {
      title: 'My panels', edit: 'Customise', done: 'Done', add: 'Add a panel', presets: 'Presets', preset: { simple: 'Simple', student: 'Student', parent: 'Parent' },
      presetDesc: { simple: 'Just the shopping list', student: 'Homework, exam countdown, shopping list', parent: 'Family homework and shopping list' },
      reset: 'Reset', resetAsk: 'Remove all panels?', applied: 'Applied “{name}”', cleared: 'All panels removed', removed: 'Panel removed', undo: 'Undo',
      size: 'Size', sizes: { s: 'S', m: 'M', l: 'L' }, settings: 'Panel settings', drag: 'Drag to reorder', up: 'Move up', down: 'Move down', remove: 'Remove', save: 'Save',
      listName: 'List name', listPh: 'e.g. Supermarket', scope: 'Show', scopes: { mine: 'Just mine', family: 'Whole family' }, exam: 'Exam',
      empty: 'Home stays simple. Pick a preset or add your own panels.', count: '{n}/{max} panels', dragHint: 'Hold ⠿ to drag, or use Move up / down.',
    },
    famq: { unset: 'Not set', use: 'Use 22:00–07:00', clear: 'Clear', example: 'e.g. 22:00–07:00' },
  },
  th: {
    sf: {
      title: 'คำแนะนำเชิงรุก', hint: 'จำนวนคำแนะนำสูงสุดต่อวัน จะไม่แสดงในช่วงเวลาเงียบ', opt: { off: 'ปิด', 1: 'วันละ 1', 2: 'วันละ 2', custom: 'กำหนดเอง', unlimited: 'ไม่จำกัด' },
      perDay: 'สูงสุด', unit: 'ต่อวัน', famOff: 'คำแนะนำถูกปิดในการตั้งค่าครอบครัว ผู้ปกครองเปิดได้ที่หน้าครอบครัว', quietNote: 'ช่วงเวลาเงียบ: {from}–{to}', why: 'ไม่เกินวันละ {n} รายการ เปลี่ยนได้ในการตั้งค่า', whyAll: 'ไม่จำกัดจำนวน เปลี่ยนได้ในการตั้งค่า',
    },
    hp: {
      title: 'แผงของฉัน', edit: 'ปรับแต่ง', done: 'เสร็จสิ้น', add: 'เพิ่มแผง', presets: 'ชุดสำเร็จรูป', preset: { simple: 'เรียบง่าย', student: 'นักเรียน', parent: 'ผู้ปกครอง' },
      presetDesc: { simple: 'เฉพาะรายการซื้อของ', student: 'การบ้าน นับถอยหลังสอบ รายการซื้อของ', parent: 'การบ้านทั้งครอบครัวและรายการซื้อของ' },
      reset: 'รีเซ็ต', resetAsk: 'นำแผงทั้งหมดออกไหม', applied: 'ใช้ “{name}” แล้ว', cleared: 'นำแผงทั้งหมดออกแล้ว', removed: 'นำแผงออกแล้ว', undo: 'เลิกทำ',
      size: 'ขนาด', sizes: { s: 'เล็ก', m: 'กลาง', l: 'ใหญ่' }, settings: 'ตั้งค่าแผง', drag: 'ลากเพื่อจัดลำดับ', up: 'เลื่อนขึ้น', down: 'เลื่อนลง', remove: 'นำออก', save: 'บันทึก',
      listName: 'ชื่อรายการ', listPh: 'เช่น ซูเปอร์มาร์เก็ต', scope: 'แสดง', scopes: { mine: 'เฉพาะของฉัน', family: 'ทั้งครอบครัว' }, exam: 'สอบ',
      empty: 'หน้าแรกเรียบง่าย เลือกชุดสำเร็จรูปหรือเพิ่มแผงเอง', count: '{n}/{max} แผง', dragHint: 'กด ⠿ ค้างไว้เพื่อลาก หรือใช้เลื่อนขึ้น/ลง',
    },
    famq: { unset: 'ยังไม่ได้ตั้ง', use: 'ใช้ 22:00–07:00', clear: 'ล้าง', example: 'เช่น 22:00–07:00' },
  },
};
for (const l of ['zh-Hant', 'en', 'th']) Object.assign(R24[l], R24B[l]);

// Run 24 step 2b: 全家檔案 (family drive) — folders, in-app documents, uploads and previews.
const R24C = {
  'zh-Hant': {
    drive: {
      tabDrive: '全家檔案', tabChat: '對話中的檔案', root: '全部檔案', up: '上一層',
      newFolder: '新增文件夾', newDoc: '新增文件', upload: '上載檔案', folderName: '文件夾名稱', docName: '文件名稱', untitledDoc: '未命名文件', newFolderDefault: '新文件夾',
      create: '建立', cancel: '取消', save: '儲存', saved: '已儲存', saving: '正在儲存…', unsaved: '未儲存',
      rename: '重新命名', move: '移動', moveTitle: '移動「{name}」到', moveHere: '移到這裏', del: '刪除', download: '下載', open: '開啟', more: '更多操作', close: '關閉',
      delAsk: '刪除「{name}」？刪除後不能復原。', delFolderAsk: '刪除文件夾「{name}」及裏面 {n} 個項目？刪除後不能復原。', deleted: '已刪除「{name}」', moved: '已移到「{name}」', renamed: '已重新命名',
      search: '搜尋檔案及文件', sort: '排序', sorts: { name: '名稱', date: '修改日期', size: '大小', type: '類型' }, dir: { asc: '遞增', desc: '遞減' }, view: { grid: '格狀檢視', list: '清單檢視' },
      used: '已用 {used}／{max}', perFile: '每個檔案上限 {max}', empty: '這裏還沒有檔案。可以新增文件夾、建立文件或上載檔案。', noMatch: '找不到符合「{q}」的檔案。', results: '搜尋結果',
      kinds: { folder: '文件夾', doc: '文件', image: '圖片', pdf: 'PDF', video: '影片', audio: '音訊', office: 'Office 檔案', archive: '壓縮檔', other: '檔案' },
      items: '{n} 個項目', uploads: '上載', uploading: '正在上載 {p}%', uploaded: '已上載', failed: '上載失敗', dismiss: '清除',
      err: { file_too_large: '檔案太大，每個檔案上限 {max}。', family_full: '家庭空間不足，全家上限 {max}。', empty: '檔案是空的。', network: '網絡連線出現問題，請再試一次。', forbidden: '你沒有權限進行這個操作。', forbidden_inside: '文件夾內有其他成員的檔案，你不能刪除。', too_deep: '文件夾層數太多。', too_many: '檔案數目已達上限。', name: '請輸入名稱。', generic: '出現問題，請再試一次。' },
      preview: { loading: '正在載入…', page: '第 {n}／{total} 頁', prev: '上一頁', next: '下一頁', zoomIn: '放大', zoomOut: '縮小', fit: '符合寬度', pages: '頁面縮圖', none: '這類檔案未能預覽，請下載後開啟。', fail: '未能顯示這個檔案，請下載後開啟。' },
      doc: { bold: '粗體', italic: '斜體', h1: '大標題', h2: '標題', p: '內文', ul: '項目清單', ol: '編號清單', check: '待辦清單', placeholder: '開始輸入…', tools: '格式' },
      note: '全家成員都可以看到這裏的檔案，只有家庭成員可以開啟。', by: '{name} · {date}',
      scanSave: '儲存到檔案', scanSaved: '已儲存到「檔案」：{name}',
    },
  },
  en: {
    drive: {
      tabDrive: 'Family files', tabChat: 'From chats', root: 'All files', up: 'Up one level',
      newFolder: 'New folder', newDoc: 'New document', upload: 'Upload', folderName: 'Folder name', docName: 'Document name', untitledDoc: 'Untitled document', newFolderDefault: 'New folder',
      create: 'Create', cancel: 'Cancel', save: 'Save', saved: 'Saved', saving: 'Saving…', unsaved: 'Not saved',
      rename: 'Rename', move: 'Move', moveTitle: 'Move “{name}” to', moveHere: 'Move here', del: 'Delete', download: 'Download', open: 'Open', more: 'More actions', close: 'Close',
      delAsk: 'Delete “{name}”? This can’t be undone.', delFolderAsk: 'Delete the folder “{name}” and the {n} items inside? This can’t be undone.', deleted: 'Deleted “{name}”', moved: 'Moved to “{name}”', renamed: 'Renamed',
      search: 'Search files and documents', sort: 'Sort', sorts: { name: 'Name', date: 'Date modified', size: 'Size', type: 'Type' }, dir: { asc: 'Ascending', desc: 'Descending' }, view: { grid: 'Grid view', list: 'List view' },
      used: '{used} of {max} used', perFile: 'Up to {max} per file', empty: 'Nothing here yet. Add a folder, write a document or upload files.', noMatch: 'No files match “{q}”.', results: 'Search results',
      kinds: { folder: 'Folder', doc: 'Document', image: 'Image', pdf: 'PDF', video: 'Video', audio: 'Audio', office: 'Office file', archive: 'Archive', other: 'File' },
      items: '{n} items', uploads: 'Uploads', uploading: 'Uploading {p}%', uploaded: 'Uploaded', failed: 'Upload failed', dismiss: 'Clear',
      err: { file_too_large: 'That file is too big — up to {max} per file.', family_full: 'Not enough family space — {max} in total.', empty: 'That file is empty.', network: 'Connection problem — please try again.', forbidden: 'You don’t have permission to do that.', forbidden_inside: 'This folder holds other members’ files, so you can’t delete it.', too_deep: 'Too many folder levels.', too_many: 'The file limit has been reached.', name: 'Please enter a name.', generic: 'Something went wrong — please try again.' },
      preview: { loading: 'Loading…', page: 'Page {n} of {total}', prev: 'Previous page', next: 'Next page', zoomIn: 'Zoom in', zoomOut: 'Zoom out', fit: 'Fit width', pages: 'Page thumbnails', none: 'This type of file can’t be previewed — download it to open.', fail: 'Couldn’t show this file — download it to open.' },
      doc: { bold: 'Bold', italic: 'Italic', h1: 'Title', h2: 'Heading', p: 'Body text', ul: 'Bulleted list', ol: 'Numbered list', check: 'Checklist', placeholder: 'Start typing…', tools: 'Formatting' },
      note: 'Everyone in your family can see these files; only family members can open them.', by: '{name} · {date}',
      scanSave: 'Save to Files', scanSaved: 'Saved to Files: {name}',
    },
  },
  th: {
    drive: {
      tabDrive: 'ไฟล์ครอบครัว', tabChat: 'จากแชต', root: 'ไฟล์ทั้งหมด', up: 'ขึ้นหนึ่งระดับ',
      newFolder: 'โฟลเดอร์ใหม่', newDoc: 'เอกสารใหม่', upload: 'อัปโหลด', folderName: 'ชื่อโฟลเดอร์', docName: 'ชื่อเอกสาร', untitledDoc: 'เอกสารไม่มีชื่อ', newFolderDefault: 'โฟลเดอร์ใหม่',
      create: 'สร้าง', cancel: 'ยกเลิก', save: 'บันทึก', saved: 'บันทึกแล้ว', saving: 'กำลังบันทึก…', unsaved: 'ยังไม่ได้บันทึก',
      rename: 'เปลี่ยนชื่อ', move: 'ย้าย', moveTitle: 'ย้าย “{name}” ไปที่', moveHere: 'ย้ายมาที่นี่', del: 'ลบ', download: 'ดาวน์โหลด', open: 'เปิด', more: 'การทำงานเพิ่มเติม', close: 'ปิด',
      delAsk: 'ลบ “{name}” ไหม เมื่อลบแล้วจะกู้คืนไม่ได้', delFolderAsk: 'ลบโฟลเดอร์ “{name}” และ {n} รายการข้างในไหม เมื่อลบแล้วจะกู้คืนไม่ได้', deleted: 'ลบ “{name}” แล้ว', moved: 'ย้ายไปที่ “{name}” แล้ว', renamed: 'เปลี่ยนชื่อแล้ว',
      search: 'ค้นหาไฟล์และเอกสาร', sort: 'เรียงตาม', sorts: { name: 'ชื่อ', date: 'วันที่แก้ไข', size: 'ขนาด', type: 'ประเภท' }, dir: { asc: 'น้อยไปมาก', desc: 'มากไปน้อย' }, view: { grid: 'มุมมองตาราง', list: 'มุมมองรายการ' },
      used: 'ใช้ไป {used} จาก {max}', perFile: 'สูงสุด {max} ต่อไฟล์', empty: 'ยังไม่มีไฟล์ เพิ่มโฟลเดอร์ เขียนเอกสาร หรืออัปโหลดไฟล์ได้', noMatch: 'ไม่พบไฟล์ที่ตรงกับ “{q}”', results: 'ผลการค้นหา',
      kinds: { folder: 'โฟลเดอร์', doc: 'เอกสาร', image: 'รูปภาพ', pdf: 'PDF', video: 'วิดีโอ', audio: 'เสียง', office: 'ไฟล์ Office', archive: 'ไฟล์บีบอัด', other: 'ไฟล์' },
      items: '{n} รายการ', uploads: 'การอัปโหลด', uploading: 'กำลังอัปโหลด {p}%', uploaded: 'อัปโหลดแล้ว', failed: 'อัปโหลดไม่สำเร็จ', dismiss: 'ล้าง',
      err: { file_too_large: 'ไฟล์ใหญ่เกินไป สูงสุด {max} ต่อไฟล์', family_full: 'พื้นที่ครอบครัวไม่พอ รวมสูงสุด {max}', empty: 'ไฟล์ว่างเปล่า', network: 'การเชื่อมต่อมีปัญหา โปรดลองอีกครั้ง', forbidden: 'คุณไม่มีสิทธิ์ทำสิ่งนี้', forbidden_inside: 'โฟลเดอร์นี้มีไฟล์ของสมาชิกคนอื่น คุณจึงลบไม่ได้', too_deep: 'โฟลเดอร์ซ้อนกันหลายชั้นเกินไป', too_many: 'จำนวนไฟล์ถึงขีดจำกัดแล้ว', name: 'โปรดใส่ชื่อ', generic: 'เกิดข้อผิดพลาด โปรดลองอีกครั้ง' },
      preview: { loading: 'กำลังโหลด…', page: 'หน้า {n} จาก {total}', prev: 'หน้าก่อน', next: 'หน้าถัดไป', zoomIn: 'ขยาย', zoomOut: 'ย่อ', fit: 'พอดีความกว้าง', pages: 'ภาพย่อหน้า', none: 'ไฟล์ประเภทนี้แสดงตัวอย่างไม่ได้ ดาวน์โหลดเพื่อเปิด', fail: 'แสดงไฟล์นี้ไม่ได้ ดาวน์โหลดเพื่อเปิด' },
      doc: { bold: 'ตัวหนา', italic: 'ตัวเอียง', h1: 'หัวเรื่อง', h2: 'หัวข้อ', p: 'ข้อความ', ul: 'รายการหัวข้อย่อย', ol: 'รายการลำดับเลข', check: 'รายการตรวจสอบ', placeholder: 'เริ่มพิมพ์…', tools: 'รูปแบบ' },
      note: 'ทุกคนในครอบครัวเห็นไฟล์เหล่านี้ และเฉพาะสมาชิกครอบครัวเท่านั้นที่เปิดได้', by: '{name} · {date}',
      scanSave: 'บันทึกลงไฟล์', scanSaved: 'บันทึกลงไฟล์แล้ว: {name}',
    },
  },
};
for (const l of ['zh-Hant', 'en', 'th']) Object.assign(R24[l], R24C[l]);

// PDF full-text fix (23 Oct 2026): chat documents keep their full text in 對話中的檔案, with one shared word count.
const R24D = {
  'zh-Hant': { chatdoc: { words: '約 {n} 字', pages: '{n} 頁', fullText: '全文', aiRead: 'AI 已閱讀全文', aiUsed: '這份文件較長，AI 回覆時使用了約 {used}／{total} 字（開頭及與問題最相關的部分）。', partial: '部分內容仍在載入，請稍後再開啟。', pagesCut: '只讀取了首 {n} 頁' } },
  en: { chatdoc: { words: '{n} words', pages: '{n} pages', fullText: 'Full text', aiRead: 'AI read the full text', aiUsed: 'This document is long: for its reply the AI used about {used} / {total} words (the start + the parts most related to the question).', partial: 'Part of the text is still loading — open it again in a moment.', pagesCut: 'Only the first {n} pages were read' } },
  th: { chatdoc: { words: 'ประมาณ {n} คำ', pages: '{n} หน้า', fullText: 'ข้อความทั้งหมด', aiRead: 'AI อ่านข้อความทั้งหมดแล้ว', aiUsed: 'เอกสารนี้ยาว: AI ใช้ประมาณ {used} / {total} คำในการตอบ (ส่วนต้นและส่วนที่เกี่ยวข้องกับคำถามมากที่สุด)', partial: 'ข้อความบางส่วนยังโหลดไม่เสร็จ โปรดเปิดอีกครั้งในอีกสักครู่', pagesCut: 'อ่านเฉพาะ {n} หน้าแรก' } },
};
for (const l of ['zh-Hant', 'en', 'th']) Object.assign(R24[l], R24D[l]);
