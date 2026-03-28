/**
 * Deterministic message generator for Bamboo Vet seed data.
 *
 * Produces 3-8 messages per conversation (avg ~5), totaling 50K-60K messages.
 * Messages alternate user/assistant roles with Vietnamese veterinary content.
 *
 * Deterministic: same output on every run.
 */

import type { ConversationSeed } from './conversations'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MessageSeed {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

// ---------------------------------------------------------------------------
// Deterministic hash
// ---------------------------------------------------------------------------

function detHash(seed: number): number {
  let x = Math.sin(seed * 9301 + 49297) * 233280
  return x - Math.floor(x)
}

function deterministicHash(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

// ---------------------------------------------------------------------------
// UUID helper
// ---------------------------------------------------------------------------

function msgUuid(index: number): string {
  const hex = index.toString(16).padStart(12, '0')
  return `ms${hex.slice(0, 6)}-${hex.slice(6, 10)}-4aaa-9bbb-${hex}`
}

// ---------------------------------------------------------------------------
// Message content templates (Vietnamese veterinary)
// ---------------------------------------------------------------------------

const USER_TEMPLATES = [
  'Xin hoi lieu luong {drug} cho {animal} nang {weight}kg la bao nhieu?',
  'Cho toi hoi ve cach dieu tri {disease} o {animal}?',
  '{animal} cua toi co trieu chung {symptom}, nen lam gi?',
  'Lieu luong {drug} tiem cho {animal} nhu the nao?',
  'Xin tu van ve phac do dieu tri {disease} cho {animal}.',
  'Lam sao de phong ngua {disease} cho {animal}?',
  'Co nen dung {drug} cho {animal} dang mang thai khong?',
  '{animal} bi {symptom} da {days} ngay, can xu ly the nao?',
  'Thoi gian ngung thuoc {drug} truoc khi giet mo la bao lau?',
  'Xin hoi ve tac dung phu cua {drug} tren {animal}.',
  'Can tu van ve lich tiem phong cho {animal} con.',
  'Lam the nao de chan doan {disease} o {animal}?',
  'Co the ket hop {drug} voi thuoc khac khong?',
  '{animal} bi bo an, sot {temp} do, chan doan gi?',
  'Xin huong dan cach pha {drug} de phun khu trung chuong.',
]

const ASSISTANT_TEMPLATES = [
  'Doi voi {animal} nang {weight}kg, lieu luong {drug} khuyen cao la {dose}. Tiem bap, ngay {freq} lan trong {duration} ngay. Luu y theo doi phan ung sau tiem va dam bao thoi gian ngung thuoc truoc khi giet mo theo quy dinh.',
  'Benh {disease} o {animal} thuong do {cause}. Phac do dieu tri bao gom: 1) Su dung {drug} lieu {dose} trong {duration} ngay. 2) Bo sung dien giai va dinh duong. 3) Cach ly ca the benh. 4) Ve sinh khu trung chuong trai.',
  'Trieu chung {symptom} o {animal} co the lien quan den {disease}. De chan doan chinh xac, can: 1) Kiem tra nhiet do - binh thuong la {temp} do C. 2) Quan sat phan va nuoc tieu. 3) Xet nghiem mau neu can. Nen lien he bac si thu y de kham truc tiep.',
  'Lich tiem phong cho {animal} con: - Tuan {week1}: Vaccine {vax1} - Tuan {week2}: Vaccine {vax2} - Tuan {week3}: Tiem nhac lai. Truoc khi tiem, dam bao {animal} khoe manh, khong co trieu chung benh. Bao quan vaccine o nhiet do 2-8 do C.',
  'Viec ket hop {drug} voi cac thuoc khac can than trong. Khong nen dung dong thoi voi {contra_drug} vi co the gay tuong tac bat loi. Khoang cach toi thieu giua 2 loai thuoc la {gap} gio. Tham khao y kien bac si thu y truoc khi phoi hop dieu tri.',
  'Thoi gian ngung su dung {drug} truoc khi giet mo doi voi {animal} la {withdrawal} ngay theo quy dinh cua Bo NN&PTNT. Doi voi san pham sua, thoi gian ngung la {milk_withdrawal} ngay. Quan trong: phai tuan thu nghiem ngat quy dinh nay de dam bao an toan thuc pham.',
  'De phong ngua {disease} cho {animal}, can thuc hien: 1) Tiem phong dinh ky theo lich. 2) Ve sinh chuong trai hang ngay. 3) Kiem soat mat do dan. 4) Dam bao dinh duong day du. 5) Cach ly ngay khi phat hien ca the nghi nhiem benh.',
  'Phan tich trieu chung: {animal} bi {symptom} kem theo sot {temp} do co the la dau hieu cua {disease}. Xu ly ban dau: 1) Ha sot bang {drug} lieu {dose}. 2) Bo sung nuoc va dien giai. 3) Cho an thuc an mem, de tieu. 4) Theo doi sat trong 24-48 gio.',
]

const DRUGS = ['amoxicillin', 'oxytetracycline', 'florfenicol', 'colistin', 'enrofloxacin', 'dexamethasone', 'ivermectin', 'tylosin', 'gentamicin', 'tiamulin']
const DISEASES = ['viem phoi', 'tieu chay', 'tu huyet trung', 'cau trung', 'Newcastle', 'dich ta', 'viem vu', 'ky sinh trung', 'Gumboro', 'lep to spirosis']
const SYMPTOMS = ['bo an', 'tieu chay', 'sot cao', 'kho tho', 'chay nuoc mui', 'oi mua', 'met moi', 'di khap khieng', 'phan co mau', 'sung mat']
const ANIMALS = ['bo', 'lon', 'ga', 'cho', 'meo', 'ca', 'de', 'trau']
const WEIGHTS = ['5', '10', '15', '20', '30', '50', '100', '200', '300', '500']
const DOSES = ['5mg/kg', '10mg/kg', '15mg/kg', '20mg/kg', '0.2ml/kg', '0.5ml/kg', '1ml/kg']
const TEMPS = ['38.5', '39.0', '39.5', '40.0', '40.5', '41.0']

function fillTemplate(template: string, seed: number): string {
  let result = template
  const h = (offset: number) => Math.abs(Math.floor(detHash(seed * 17 + offset) * 1000))
  result = result.replace(/\{drug\}/g, DRUGS[h(1) % DRUGS.length])
  result = result.replace(/\{disease\}/g, DISEASES[h(2) % DISEASES.length])
  result = result.replace(/\{symptom\}/g, SYMPTOMS[h(3) % SYMPTOMS.length])
  result = result.replace(/\{animal\}/g, ANIMALS[h(4) % ANIMALS.length])
  result = result.replace(/\{weight\}/g, WEIGHTS[h(5) % WEIGHTS.length])
  result = result.replace(/\{dose\}/g, DOSES[h(6) % DOSES.length])
  result = result.replace(/\{temp\}/g, TEMPS[h(7) % TEMPS.length])
  result = result.replace(/\{days\}/g, String(2 + h(8) % 10))
  result = result.replace(/\{freq\}/g, String(1 + h(9) % 3))
  result = result.replace(/\{duration\}/g, String(3 + h(10) % 7))
  result = result.replace(/\{cause\}/g, ['vi khuan', 'virus', 'ky sinh trung', 'nam', 'vi khuan ket hop virus'][h(11) % 5])
  result = result.replace(/\{contra_drug\}/g, DRUGS[h(12) % DRUGS.length])
  result = result.replace(/\{gap\}/g, String(4 + h(13) % 8))
  result = result.replace(/\{withdrawal\}/g, String(7 + h(14) % 21))
  result = result.replace(/\{milk_withdrawal\}/g, String(3 + h(15) % 10))
  result = result.replace(/\{week1\}/g, String(2 + h(16) % 3))
  result = result.replace(/\{week2\}/g, String(6 + h(17) % 3))
  result = result.replace(/\{week3\}/g, String(10 + h(18) % 4))
  result = result.replace(/\{vax1\}/g, ['Newcastle', 'Gumboro', 'tu huyet trung', 'dich ta'][h(19) % 4])
  result = result.replace(/\{vax2\}/g, ['cum gia cam', 'PRRS', 'FMD', 'Marek'][h(20) % 4])
  return result
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export function generateMessages(conversations: ConversationSeed[]): MessageSeed[] {
  const messages: MessageSeed[] = []
  let globalMsgIdx = 1

  for (let ci = 0; ci < conversations.length; ci++) {
    const conv = conversations[ci]
    const convHash = deterministicHash(conv.id)

    // 3-8 messages per conversation (avg ~5), must be even to end on assistant
    // (index 0=user, 1=assistant, ..., last odd index=assistant)
    let msgCount = 3 + (convHash % 6) // 3 to 8
    // Ensure even so last message is assistant
    if (msgCount % 2 !== 0) msgCount--
    if (msgCount < 2) msgCount = 2

    // Parse conversation created_at
    const baseTime = new Date(conv.created_at).getTime()

    for (let mi = 0; mi < msgCount; mi++) {
      const role: 'user' | 'assistant' = mi % 2 === 0 ? 'user' : 'assistant'

      // Content from templates
      let content: string
      const templateSeed = globalMsgIdx * 31 + mi * 7
      if (role === 'user') {
        const tpl = USER_TEMPLATES[templateSeed % USER_TEMPLATES.length]
        content = fillTemplate(tpl, templateSeed)
      } else {
        const tpl = ASSISTANT_TEMPLATES[templateSeed % ASSISTANT_TEMPLATES.length]
        content = fillTemplate(tpl, templateSeed)
      }

      // Timestamps: 1-5 minutes apart
      const minuteGap = 1 + (deterministicHash(`gap-${globalMsgIdx}-${mi}`) % 5)
      const msgTime = new Date(baseTime + mi * minuteGap * 60 * 1000)
      const createdAt = msgTime.toISOString().replace(/\.\d{3}Z$/, 'Z')

      messages.push({
        id: msgUuid(globalMsgIdx),
        conversation_id: conv.id,
        role,
        content,
        created_at: createdAt,
      })

      globalMsgIdx++
    }
  }

  return messages
}
