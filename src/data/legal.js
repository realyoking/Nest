// Run 16 — Terms of Service + Privacy Policy, ONE source for the in-app pages (src/pages/public/Legal.jsx) and the static,
// crawlable pages /privacy, /terms, /<seg>/privacy, /<seg>/terms (seo/legal.js). zh-Hans is generated with toHans.
// Written for Google OAuth verification: it must describe exactly what the app does with Google user data (src/lib/google.js,
// api/_google-lib.js, api/oauth/*, api/google/*). Keep it TRUE — if the scopes or storage change, change this file.
// Each entry: [heading, paragraph | paragraph[] ]. Paragraphs may contain [label](url) links and **bold**.
export const LEGAL_UPDATED = '2026-10-20';
import { CONTACT_EMAIL } from '../contact.js';
import { SITE } from '../site.js';
export { CONTACT_EMAIL };

export const PRIVACY = {
  en: {
    title: 'Privacy Policy',
    lead: 'This policy explains what Nest (also shown as “Nesty” on Google sign-in screens) collects, how we use it, and the choices you have. Nest is run by an independent developer in Hong Kong.',
    sections: [
      ['Who we are', [`Nest (“we”, “the Service”) is an AI helper for families at ${SITE}. Contact: [${CONTACT_EMAIL}](mailto:${CONTACT_EMAIL}).`]],
      ['What we collect', [
        '**Account details** — your name, email address and profile photo, from email sign-up or “Sign in with Google” (openid, email and profile).',
        '**Content you create** — family memory, reminders, chats with the AI, quiz results, family membership and settings.',
        '**Usage data** — daily and weekly AI usage counters and basic technical logs (for example error logs) needed to run and secure the Service.',
        '**Photos** — homework or note photos are compressed in your browser and sent to the AI model for that request only. They are not stored on our servers.',
      ]],
      ['Google user data (connected Google accounts)', [
        'Connecting a Google account is optional. If you choose to connect one in Connections, we ask Google for these permissions, and use each one only for the feature named:',
        '• **Gmail (gmail.readonly)** — read recent messages so Nest can summarise them, find school notices and deadlines, and answer your questions about your mail. Nest never sends, deletes or changes email.',
        '• **Google Calendar (calendar.readonly, calendar.events)** — show your events in Nest’s calendar and daily brief, and create, edit or delete an event **only when you ask and confirm it**.',
        '• **Google Classroom (classroom.courses.readonly, classroom.coursework.me.readonly, classroom.announcements.readonly)** — show your classes, assignments, due dates and announcements.',
        '• **Google Drive (drive.readonly)** — list and read files you ask Nest about. Nest never changes or deletes Drive files.',
        'Google data is fetched when you use a feature and is used only to provide that feature to you. When you ask the AI about it, only the parts needed for your request are sent to our AI model provider to produce the reply; the reply is saved in your chat history, which you can delete. We do not otherwise copy your emails, events, coursework or files into our database.',
      ]],
      ['Limited Use disclosure', [
        'Nest’s use and transfer to any other app of information received from Google APIs will adhere to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.',
        'In particular: we use Google user data only to provide and improve user-facing features you can see in Nest; we do **not** sell it; we do **not** use or transfer it for advertising, retargeting or interest-based ads; we do **not** use it to determine credit-worthiness or for lending; we do **not** use it to train or improve generalised AI or machine-learning models (ours or anyone else’s), and our AI provider receives it only to answer your request; and no person reads it unless you give us permission for a specific message (for example a support request), it is needed for security (such as investigating abuse), or the law requires it.',
      ]],
      ['How Google tokens are stored', [
        'When you connect Google, Google gives Nest a refresh token. It is encrypted on our server (AES-256-GCM, bound to your account) and stored in your own user record, which security rules let only you read. Only Nest’s server can decrypt it. Short-lived access tokens (about one hour) are kept in your browser session.',
      ]],
      ['AI processing', [
        'To answer you, your message and the context it needs (for example family memory or the Google data you asked about) are sent to our AI model provider. The provider processes it to generate the reply. We never use your data for advertising.',
      ]],
      ['Service providers', [
        'We use Google Firebase (sign-in and database), Vercel (hosting) and our AI model provider (Agnes AI) to run the Service. They process data on our behalf only to provide their service. We do not sell personal data to anyone.',
      ]],
      ['Who can see your data', [
        'Family memory, reminders and the member list are visible to members of that family. AI chats, quiz results, connected accounts and agent suggestions are visible only to you.',
      ]],
      ['Retention and deletion', [
        '**Disconnect Google** at any time in Connections: Nest revokes the token at Google and deletes it from our database immediately. You can also remove Nest’s access at [myaccount.google.com/permissions](https://myaccount.google.com/permissions).',
        '**Delete your account** in Settings: your profile, including any stored Google tokens, is deleted immediately and you are removed from your family (a family with no other members is deleted). Any chats, memory or quiz results that remain stored with the family can be removed by its members, or email us and we will delete everything linked to your account within 30 days.',
        'We keep your data only while your account is active. You can also email us to ask for a copy or deletion of your data.',
      ]],
      ['Security', ['Data is sent over HTTPS, access is limited by database security rules, and Google tokens are encrypted at rest.']],
      ['Children', ['Children under 13 should use the Service only within a family created and managed by a parent or guardian.']],
      ['Changes', ['If we change this policy we will update the date above, and tell you in the app for important changes.']],
      ['Contact', [`Questions or requests: [${CONTACT_EMAIL}](mailto:${CONTACT_EMAIL}). This policy follows the Hong Kong Personal Data (Privacy) Ordinance.`]],
    ],
  },
  'zh-Hant': {
    title: '私隱政策',
    lead: '本政策說明 Nest（於 Google 登入畫面亦顯示為「Nesty」）收集哪些資料、如何使用，以及你可作出的選擇。Nest 由香港一位獨立開發者營運。',
    sections: [
      ['關於我們', [`Nest（「我們」或「本服務」）是一個為家庭而設的 AI 助理，網址為 ${SITE}。聯絡電郵：[${CONTACT_EMAIL}](mailto:${CONTACT_EMAIL})。`]],
      ['我們收集的資料', [
        '**帳戶資料**——你以電郵註冊或「使用 Google 登入」（openid、電郵及個人資料）時提供的名稱、電郵地址及頭像。',
        '**你建立的內容**——家庭記憶、提醒、與 AI 的對話、測驗成績、家庭成員及設定。',
        '**使用資料**——每日及每週的 AI 用量，以及營運及保障本服務所需的基本技術記錄（例如錯誤記錄）。',
        '**相片**——功課或筆記相片會先在你的瀏覽器內壓縮，再傳送至 AI 模型處理該次要求，不會儲存在我們的伺服器。',
      ]],
      ['Google 用戶資料（已連接的 Google 帳戶）', [
        '連接 Google 帳戶屬自願性質。如你選擇在「連接」頁面連接，我們會向 Google 要求以下權限，而每項權限只會用於所列的功能：',
        '• **Gmail（gmail.readonly）**——讀取近期郵件，以便 Nest 為你撮要、找出學校通告及限期，並回答你有關郵件的問題。Nest 絕不會發送、刪除或更改任何郵件。',
        '• **Google 日曆（calendar.readonly、calendar.events）**——在 Nest 的日曆及每日簡報顯示你的活動，並**只會在你要求及確認後**新增、修改或刪除活動。',
        '• **Google Classroom（classroom.courses.readonly、classroom.coursework.me.readonly、classroom.announcements.readonly）**——顯示你的課堂、功課、限期及公告。',
        '• **Google 雲端硬碟（drive.readonly）**——列出及讀取你向 Nest 查詢的檔案。Nest 絕不會更改或刪除雲端硬碟檔案。',
        'Google 資料只會在你使用相關功能時讀取，並只用於為你提供該功能。當你向 AI 查詢這些資料時，只有與你要求相關的部分會傳送至我們的 AI 模型供應商以生成回覆；回覆會儲存在你的對話記錄中，你可隨時刪除。除此以外，我們不會把你的郵件、活動、功課或檔案複製到我們的資料庫。',
      ]],
      ['有限使用聲明（Limited Use）', [
        'Nest 使用及向任何其他應用程式轉移從 Google API 取得的資料，將遵守 [Google API 服務用戶資料政策](https://developers.google.com/terms/api-services-user-data-policy)，包括其中的「有限使用」規定。',
        '具體而言：我們只會將 Google 用戶資料用於提供及改善你在 Nest 內看得到的功能；我們**不會**出售這些資料；**不會**將其用於或轉移作廣告、再行銷或興趣導向廣告；**不會**用作評估信貸或借貸用途；**不會**用作訓練或改進任何通用 AI 或機器學習模型（無論屬於我們或他人），我們的 AI 供應商只會為回覆你的要求而接收這些資料；除非你就特定訊息給予許可（例如支援查詢）、基於保安需要（例如調查濫用行為）或法律要求，否則不會有任何人閱讀這些資料。',
      ]],
      ['Google 授權憑證的儲存方式', [
        '連接 Google 後，Google 會向 Nest 發出一個更新憑證（refresh token）。該憑證會在我們的伺服器以 AES-256-GCM 加密（並與你的帳戶綁定），儲存在只有你本人才可讀取的用戶記錄內，只有 Nest 的伺服器能夠解密。有效期約一小時的存取憑證只保存在你的瀏覽器工作階段內。',
      ]],
      ['AI 處理', ['為回覆你，你的訊息及所需的背景資料（例如家庭記憶或你查詢的 Google 資料）會傳送至我們的 AI 模型供應商以生成回覆。我們絕不會將你的資料用作廣告用途。']],
      ['服務供應商', ['我們使用 Google Firebase（登入及資料庫）、Vercel（網站寄存）及我們的 AI 模型供應商（Agnes AI）營運本服務。它們只會代表我們、為提供其服務而處理資料。我們不會向任何人出售個人資料。']],
      ['誰可以看到你的資料', ['家庭記憶、提醒及成員名單只限同一家庭的成員存取。AI 對話、測驗成績、已連接帳戶及主動建議只限你本人存取。']],
      ['保存與刪除', [
        '你可隨時在「連接」頁面**中斷 Google 連接**：Nest 會即時向 Google 撤銷授權，並從我們的資料庫刪除憑證。你亦可在 [myaccount.google.com/permissions](https://myaccount.google.com/permissions) 移除 Nest 的存取權。',
        '你可在「設定」**刪除帳戶**：你的個人資料（包括已儲存的 Google 憑證）會即時刪除，你亦會退出所屬家庭（如家庭再無其他成員，該家庭會一併刪除）。仍儲存在家庭內的對話、記憶或測驗成績可由家庭成員移除，或電郵聯絡我們，我們會在 30 日內刪除與你帳戶相關的所有資料。',
        '我們只會在你的帳戶仍然有效期間保存你的資料。你亦可電郵聯絡我們，索取或要求刪除你的資料。',
      ]],
      ['資料保安', ['資料經 HTTPS 傳送，存取受資料庫保安規則限制，Google 憑證亦會加密儲存。']],
      ['兒童私隱', ['13 歲以下兒童應只在由家長或監護人建立及管理的家庭內使用本服務。']],
      ['政策修訂', ['如本政策有所修訂，我們會更新上方日期；如屬重要修訂，亦會在應用程式內通知你。']],
      ['聯絡我們', [`如有任何疑問或要求，請電郵至 [${CONTACT_EMAIL}](mailto:${CONTACT_EMAIL})。本政策參照香港《個人資料（私隱）條例》制定。`]],
    ],
  },
};

export const TERMS = {
  en: {
    title: 'Terms of Service',
    lead: `These terms apply when you use Nest at ${SITE}. By using the Service you agree to them.`,
    sections: [
      ['The service', ['Nest (“the Service”) is an AI helper for families, offering homework help, study quizzes, family memory, reminders and optional connected accounts. The Service is in early access and features may change.']],
      ['Accounts', ['You must provide accurate information and keep your sign-in secure. Children under 13 must use the Service in a family created and managed by a parent or guardian.']],
      ['Families and invites', ['Family owners can invite and remove members and change roles. By joining with an invite link or code you agree to share family memory, reminders and similar content with that family.']],
      ['Connected accounts', ['If you connect a Google account, Nest accesses it only as described in our [Privacy Policy](/privacy), and you can disconnect at any time. Your use of Google services stays subject to Google’s own terms.']],
      ['AI content', ['AI replies may be inaccurate or incomplete and are not professional advice (including medical, legal or financial advice). The homework tutor supports learning; students should follow their school’s academic integrity rules.']],
      ['Plans and usage', ['Each plan has daily and weekly AI usage limits, shown as percentages, which reset every day at 00:00 and every Monday at 00:00 (Hong Kong time). Paid plans are not yet available; we will state prices and terms clearly before they launch.']],
      ['Acceptable use', ['Do not use the Service for unlawful activity, harassment, infringing or inappropriate content, or attempts to compromise its security.']],
      ['Termination', ['You can delete your account at any time in Settings. We may suspend or end accounts that breach these terms.']],
      ['Liability', ['To the extent permitted by law, the Service is provided “as is” and we are not liable for indirect or incidental losses.']],
      ['Governing law', ['These terms are governed by the laws of the Hong Kong SAR.']],
      ['Contact', [`[${CONTACT_EMAIL}](mailto:${CONTACT_EMAIL})`]],
    ],
  },
  'zh-Hant': {
    title: '服務條款',
    lead: `本條款適用於你使用 ${SITE} 上的 Nest。使用本服務即表示你同意本條款。`,
    sections: [
      ['服務內容', ['Nest（「本服務」）是一個為家庭而設的 AI 助理，提供功課輔導、溫習測驗、家庭記憶、提醒及可選的帳戶連接等功能。本服務仍在早期階段，功能可能隨時調整。']],
      ['帳戶', ['你須提供真實資料並妥善保管登入憑證。未滿 13 歲的兒童須由家長或監護人建立及管理家庭，並在其監督下使用。']],
      ['家庭與邀請', ['家庭擁有人可邀請、移除成員及更改成員身分。透過邀請連結或邀請碼加入，即表示你同意與該家庭成員分享家庭記憶及提醒等內容。']],
      ['已連接帳戶', ['如你連接 Google 帳戶，Nest 只會按照我們的[私隱政策](/privacy)存取該帳戶，你可隨時中斷連接。你使用 Google 服務時仍須遵守 Google 的條款。']],
      ['AI 內容', ['AI 回覆可能不準確或不完整，不構成專業意見（包括醫療、法律或財務意見）。功課導師旨在協助學習，使用者應遵守所屬學校的學術誠信規定。']],
      ['方案與用量', ['各方案設有每日及每週 AI 用量上限，以百分比顯示，按香港時間每日 00:00 及每週一 00:00 重設。付費方案尚未推出；推出前我們會清楚列明價格及條款。']],
      ['合理使用', ['你不得利用本服務從事違法活動、騷擾他人、上載侵權或不當內容，或試圖破壞本服務的安全。']],
      ['終止', ['你可隨時於「設定」刪除帳戶。如違反本條款，我們可暫停或終止你的帳戶。']],
      ['責任限制', ['在法律允許的最大範圍內，本服務按「現狀」提供，我們不就任何間接或附帶損失承擔責任。']],
      ['適用法律', ['本條款受香港特別行政區法律管轄。']],
      ['聯絡我們', [`[${CONTACT_EMAIL}](mailto:${CONTACT_EMAIL})`]],
    ],
  },
};
