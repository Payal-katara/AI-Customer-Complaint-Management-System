import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'

const BACKEND_BASE_URL = (import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')

const initialState = {
  intakeText: '',
  form: {
    complaintSource: '',
    customerName: '',
    productName: '',
    productStrengthGrade: '',
    batchLotNumber: '',
    manufacturingDate: '',
    expiryDate: '',
    quantityAffected: '',
    complaintType: '',
    complaintDate: '',
    detailedComplaintDescription: '',
    initialSeverity: '',
    priority: '',
  },
  analysis: {
    riskScore: 0,
    riskLevel: 'Pending',
    nextStep: 'Paste a complaint or email, then let the assistant extract the details.',
    initialAssessment: 'Waiting for complaint text.',
    reasoningPoints: [
      'No complaint text has been analyzed yet.',
      'The right panel will populate the form automatically.',
    ],
    updatedFields: [],
  },
  assistantLog: [
    
  ],
}

const DOCUMENT_FIELD_LABELS = {
  complaintSource: 'Complaint Source',
  customerName: 'Customer Name',
  productName: 'Product Name',
  productStrengthGrade: 'Product Strength / Grade',
  batchLotNumber: 'Batch / Lot Number',
  manufacturingDate: 'Manufacturing Date',
  expiryDate: 'Expiry Date',
  quantityAffected: 'Quantity Affected',
  complaintType: 'Complaint Type',
  complaintDate: 'Complaint Date',
  detailedComplaintDescription: 'Detailed Complaint Description',
  initialSeverity: 'Initial Severity',
  priority: 'Priority',
}

const FIELD_ORDER = [
  'complaintSource',
  'customerName',
  'productName',
  'productStrengthGrade',
  'batchLotNumber',
  'manufacturingDate',
  'expiryDate',
  'quantityAffected',
  'complaintType',
  'complaintDate',
  'detailedComplaintDescription',
  'initialSeverity',
  'priority',
]

const LOWER_PRIORITY_WORDS = ['delay', 'late', 'wrong address', 'missing email', 'typo']
const MEDIUM_PRIORITY_WORDS = ['billing', 'refund', 'damaged', 'leaking', 'broken']
const HIGH_PRIORITY_WORDS = [
  'allergy',
  'adverse',
  'rash',
  'fever',
  'vomit',
  'dose',
  'dosage',
  'expired',
  'contaminated',
  'spoiled',
  'not of',
  'was not',
  'wrong strength',
]

async function fetchBackendAnalysis(text) {
  const response = await fetch(`${BACKEND_BASE_URL}/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  })

  if (!response.ok) {
    throw new Error(`Backend analysis failed with status ${response.status}`)
  }

  return response.json()
}

function normalizeText(text) {
  return text.trim().replace(/\s+/g, ' ')
}

function mergeDocumentText(baseText, appendedText) {
  const current = baseText.trim()
  const next = normalizeText(appendedText)

  if (!current) {
    return next
  }

  if (!next) {
    return current
  }

  return `${current}\n\n${next}`
}

function extractExplicitUpdates(text) {
  const updates = {}

  const patterns = {
    complaintSource: /(?:complaint source|source)\s*[:#-]?\s*([^\n,.;]+)/i,
    customerName: /(?:customer name|customer|reported by|raised by)\s*[:#-]?\s*([^\n,.;]+)/i,
    productName: /(?:product name|product|medicine|tablet|capsule|drug)\s*[:#-]?\s*([^\n,.;]+)/i,
    batchLotNumber: /(?:batch(?:\s*(?:no\.?|number|lot))?|lot(?:\s*(?:no\.?|number))?)\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]*)/i,
    quantityAffected: /(?:quantity affected|quantity|count)\s*[:#-]?\s*([^\n,.;]+)/i,
    complaintDate: /(?:complaint date|reported on|date of complaint)\s*[:#-]?\s*([^\n,.;]+)/i,
    initialSeverity: /(?:severity|initial severity)\s*[:#-]?\s*([^\n,.;]+)/i,
    priority: /(?:priority)\s*[:#-]?\s*([^\n,.;]+)/i,
  }

  Object.entries(patterns).forEach(([key, regex]) => {
    const match = text.match(regex)

    if (match?.[1]) {
      updates[key] = match[1].trim()
    }
  })

  return updates
}

function lastMatch(text, regex, transform = (value) => value) {
  const matches = [...text.matchAll(regex)]

  if (matches.length === 0) {
    return ''
  }

  return transform(matches[matches.length - 1])
}

function firstMatch(text, regex, transform = (value) => value) {
  const match = text.match(regex)

  if (!match) {
    return ''
  }

  return transform(match)
}

function detectSource(text) {
  const lowered = text.toLowerCase()

  if (lowered.includes('whatsapp')) return 'WhatsApp'
  if (lowered.includes('email')) return 'Email'
  if (lowered.includes('phone') || lowered.includes('call')) return 'Phone Call'
  if (lowered.includes('portal') || lowered.includes('web')) return 'Web Portal'
  if (lowered.includes('chat')) return 'Live Chat'

  return 'AI Intake'
}

function detectCustomerName(text) {
  const directName = firstMatch(
    text,
    /(?:my name is|customer name is|i am|i'm|we are|this is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/i,
    (match) => match[1].trim(),
  )

  if (directName) {
    return directName
  }

  return ''
}

function detectProductName(text, currentForm) {
  const explicitProduct = firstMatch(
    text,
    /(?:medicine|product|item|tablet|capsule|drug|batch of)\s+(?:named\s+)?([A-Z][A-Za-z0-9-]*(?:\s+[A-Z0-9][A-Za-z0-9-]*){0,3})/i,
    (match) => match[1].trim(),
  )

  if (explicitProduct) {
    return explicitProduct
  }

  if (currentForm.productName) {
    return ''
  }

  if (/medicine|tablet|capsule|drug|dose|dosage/i.test(text)) {
    return 'Medicine'
  }

  return ''
}

function detectDose(text) {
  return lastMatch(text, /(\d+(?:\.\d+)?)\s*(mg|g|mcg|ug|ml|units?|tablets?|capsules?)/gi, (match) => {
    const quantity = match[1]
    const unit = match[2].toLowerCase()

    return `${quantity} ${unit}`
  })
}

function detectBatch(text) {
  return lastMatch(
    text,
    /(?:batch(?:\s*(?:no\.?|number|lot))?|lot(?:\s*(?:no\.?|number))?)\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]*)/gi,
    (match) => match[1].trim(),
  )
}

function detectDate(text, labelRegex) {
  return lastMatch(text, labelRegex, (match) => match[1].trim())
}

function detectQuantity(text) {
  return lastMatch(text, /(\d+(?:\.\d+)?)\s*(units?|packs?|boxes?|bottles?|strips?|tablets?|capsules?|patients?|customers?)/gi, (match) => {
    const quantity = match[1]
    const unit = match[2].toLowerCase()

    return `${quantity} ${unit}`
  })
}

function detectComplaintType(text) {
  const lowered = text.toLowerCase()

  if (/(allergy|rash|fever|vomit|breath|adverse|side effect)/i.test(text)) {
    return 'Adverse Reaction'
  }

  if (/(dose|dosage|strength|mg|mcg|ml)/i.test(text) && /not|wrong|instead|changed|correction/i.test(text)) {
    return 'Dosage Mismatch'
  }

  if (/(expired|expiry|mfg|manufacturing)/i.test(text)) {
    return 'Expiry / Batch Concern'
  }

  if (/(damaged|broken|leaking|spilled|tampered|seal)/i.test(text)) {
    return 'Packaging Issue'
  }

  if (/(refund|billing|charge|payment)/i.test(text)) {
    return 'Billing Issue'
  }

  if (/(delay|late|delivery|shipment|courier|missing)/i.test(text)) {
    return 'Service Delay'
  }

  if (/medicine|tablet|capsule|drug/i.test(text) || lowered.includes('product')) {
    return 'Product Quality'
  }

  return 'General Complaint'
}

function detectSeverity(text, complaintType) {
  if (/(allergy|rash|fever|vomit|breath|hospital|emergency|contaminated|spoiled|expired)/i.test(text)) {
    return 'High'
  }

  if (complaintType === 'Dosage Mismatch') {
    return 'High'
  }

  if (complaintType === 'Packaging Issue' || complaintType === 'Billing Issue') {
    return 'Medium'
  }

  if (complaintType === 'Service Delay') {
    return 'Low'
  }

  return 'Medium'
}

function detectPriority(text, severity, complaintType) {
  if (severity === 'High') {
    return 'High'
  }

  if (LOWER_PRIORITY_WORDS.some((word) => text.toLowerCase().includes(word))) {
    return 'Low'
  }

  if (HIGH_PRIORITY_WORDS.some((word) => text.toLowerCase().includes(word))) {
    return 'High'
  }

  if (MEDIUM_PRIORITY_WORDS.some((word) => text.toLowerCase().includes(word))) {
    return 'Medium'
  }

  if (complaintType === 'Service Delay') {
    return 'Low'
  }

  return 'Medium'
}

function detectComplaintDate(text) {
  return detectDate(
    text,
    /(?:complaint date|date of complaint|reported on|reported date)\s*[:#-]?\s*((?:\d{1,2}[\/.-]){2}\d{2,4}|\d{4}-\d{2}-\d{2}|today|yesterday|today's date)/gi,
  )
}

function buildReasoningPoints(updates, text, severity, priority) {
  const points = []

  if (updates.productStrengthGrade) {
    points.push(`Captured the latest dosage value as ${updates.productStrengthGrade}.`)
  }

  if (updates.batchLotNumber) {
    points.push(`Batch or lot number detected: ${updates.batchLotNumber}.`)
  }

  if (updates.complaintType === 'Adverse Reaction' || /(allergy|rash|vomit|breath|fever)/i.test(text)) {
    points.push('Safety-related language suggests urgent QA and clinical review.')
  }

  if (updates.complaintType === 'Dosage Mismatch') {
    points.push('The complaint indicates a dosage correction, so the previous value is overridden without touching unrelated fields.')
  }

  if (severity === 'High' || priority === 'High') {
    points.push('The complaint is escalated because the impact could affect customer safety or product integrity.')
  }

  if (points.length === 0) {
    points.push('The assistant merged only the fields that were clearly mentioned in the prompt.')
  }

  return points
}

function buildExtractedFields(form) {
  return Object.entries(DOCUMENT_FIELD_LABELS).map(([key, label]) => ({
    key,
    label,
    value: form[key] || '',
  }))
}

function buildRiskAssessment(text, updates) {
  let score = 12
  const lowered = text.toLowerCase()
  const reasons = []

  if (updates.complaintType === 'Adverse Reaction') {
    score += 45
    reasons.push('Adverse reaction language requires urgent medical and QA review.')
  }

  if (updates.complaintType === 'Dosage Mismatch') {
    score += 40
    reasons.push('A dosage mismatch was detected, which is a high-risk medication issue.')
  }

  if (/(expired|expiry|spoiled|contaminated|tampered)/i.test(text)) {
    score += 28
    reasons.push('Expiry or contamination wording increases the risk to product safety.')
  }

  if (/(billing|refund|payment|charge)/i.test(text)) {
    score += 14
    reasons.push('The issue is operational but does not look safety critical.')
  }

  if (/(delay|late|shipment|delivery|missing)/i.test(text)) {
    score += 8
    reasons.push('Service delay language points to a lower operational risk.')
  }

  if (/not 500 mg|was not 500 mg|instead of 500 mg|actually 300 mg|was 300 mg/i.test(text)) {
    score += 22
    reasons.push('The prompt corrects a dosage value, so the extracted form must be updated immediately.')
  }

  if (updates.priority === 'High') {
    score += 10
  }

  score = Math.max(0, Math.min(score, 100))

  let riskLevel = 'Low'

  if (score >= 70) {
    riskLevel = 'Critical'
  } else if (score >= 45) {
    riskLevel = 'High'
  } else if (score >= 24) {
    riskLevel = 'Medium'
  }

  const nextStep =
    riskLevel === 'Critical'
      ? 'Escalate immediately to QA, medical safety, and the complaint owner. Freeze any affected batch until confirmed.'
      : riskLevel === 'High'
        ? 'Escalate to QA within the same working hour, verify the product record, and confirm the customer impact.'
        : riskLevel === 'Medium'
          ? 'Validate the extracted details, review the record, and follow up with the customer for confirmation.'
          : 'Log the complaint, keep monitoring, and request additional context only if needed.'

  const initialAssessment =
    riskLevel === 'Critical'
      ? 'Potential product safety issue with urgent escalation needed.'
      : riskLevel === 'High'
        ? 'High-priority complaint with direct product or customer impact.'
        : riskLevel === 'Medium'
          ? 'Operational complaint that needs review but does not appear immediately dangerous.'
          : 'Low-risk issue that can be handled through normal triage.'

  if (reasons.length === 0) {
    reasons.push('The risk score was inferred from the complaint type and the level of detail available in the prompt.')
  }

  return {
    riskScore: score,
    riskLevel,
    nextStep,
    initialAssessment,
    reasoningPoints: reasons,
  }
}

function buildComplaintUpdate(text, currentForm) {
  const normalized = normalizeText(text)
  const explicitUpdates = extractExplicitUpdates(normalized)
  const complaintType = detectComplaintType(normalized)
  const severity = detectSeverity(normalized, complaintType)
  const priority = detectPriority(normalized, severity, complaintType)

  const updates = {
    complaintSource: detectSource(normalized),
    customerName: detectCustomerName(normalized),
    productName: detectProductName(normalized, currentForm),
    productStrengthGrade: detectDose(normalized),
    batchLotNumber: detectBatch(normalized),
    manufacturingDate: detectDate(
      normalized,
      /(?:manufacturing date|mfg date|manufactured on|mfg\.?|manufacturing)\s*[:#-]?\s*((?:\d{1,2}[\/.-]){2}\d{2,4}|\d{4}-\d{2}-\d{2}|today|yesterday)/gi,
    ),
    expiryDate: detectDate(
      normalized,
      /(?:expiry date|expiration date|exp date|expires on|expiry|exp\.?)[\s:#-]*((?:\d{1,2}[\/.-]){2}\d{2,4}|\d{4}-\d{2}-\d{2}|today|yesterday)/gi,
    ),
    quantityAffected: detectQuantity(normalized),
    complaintType,
    complaintDate: detectComplaintDate(normalized),
    detailedComplaintDescription: normalized,
    initialSeverity: severity,
    priority,
    ...explicitUpdates,
  }

  Object.keys(updates).forEach((key) => {
    if (!updates[key]) {
      delete updates[key]
    }
  })

  const updatedFields = FIELD_ORDER.filter((field) => updates[field])
  const reasoningPoints = buildReasoningPoints(updates, normalized, severity, priority)
  const analysis = {
    ...buildRiskAssessment(normalized, updates),
    updatedFields,
    reasoningPoints,
    extractedFields: buildExtractedFields({ ...currentForm, ...updates }),
  }

  return {
    updates,
    analysis,
    reasoningPoints,
    updatedFields,
  }
}

export const submitComplaintAnalysis = createAsyncThunk(
  'complaints/submitComplaintAnalysis',
  async ({ text, currentForm = initialState.form }) => {
    const normalized = normalizeText(text)

    if (!normalized) {
      return {
        text: normalized,
        result: null,
        source: 'empty',
      }
    }

    try {
      const backendResult = await fetchBackendAnalysis(normalized)

      return {
        text: normalized,
        result: backendResult,
        source: 'backend',
      }
    } catch (error) {
      return {
        text: normalized,
        result: buildComplaintUpdate(normalized, currentForm),
        source: 'local',
        error: error instanceof Error ? error.message : 'Unable to reach the backend service.',
      }
    }
  },
)

const complaintsSlice = createSlice({
  name: 'complaints',
  initialState,
  reducers: {
    setIntakeText(state, action) {
      state.intakeText = action.payload
    },
    ingestDocumentText(state, action) {
      state.intakeText = mergeDocumentText(state.intakeText, action.payload)
    },
    analyzeIntake(state) {
      const text = state.intakeText.trim()

      if (!text) {
        state.analysis = {
          ...state.analysis,
          riskScore: 0,
          riskLevel: 'Pending',
          nextStep: 'Paste a complaint or email, then ask the assistant to extract the details.',
          initialAssessment: 'No complaint text to analyze yet.',
          reasoningPoints: ['The assistant needs complaint text before it can extract or assess anything.'],
          updatedFields: [],
        }
        return
      }

      const result = buildComplaintUpdate(text, state.form)

      state.form = {
        ...state.form,
        ...result.updates,
      }
      state.analysis = result.analysis
      state.assistantLog.unshift({
        id: Date.now(),
        title: `${result.analysis.riskLevel} risk detected`,
        note: `Updated ${result.updatedFields.length} field${result.updatedFields.length === 1 ? '' : 's'} from the latest prompt.`,
      })
      state.intakeText = ''
    },
    applyNaturalLanguageUpdate(state, action) {
      const text = normalizeText(action.payload)

      if (!text) {
        return
      }

      const result = buildComplaintUpdate(text, state.form)

      state.form = {
        ...state.form,
        ...result.updates,
      }
      state.analysis = result.analysis
      state.assistantLog.unshift({
        id: Date.now(),
        title: 'Natural language update applied',
        note: `Updated ${result.updatedFields.length} field${result.updatedFields.length === 1 ? '' : 's'} from your instruction.`,
      })
    },
    loadSamplePrompt(state, action) {
      state.intakeText = action.payload
    },
  },
  extraReducers(builder) {
    builder.addCase(submitComplaintAnalysis.fulfilled, (state, action) => {
      const { result, source, text } = action.payload

      if (!text || !result) {
        return
      }

      const updates = result.updates || {}
      const analysis = result.analysis || {}
      const updatedCount = Object.keys(updates).length

      state.form = {
        ...state.form,
        ...updates,
      }
      state.analysis = analysis
      state.assistantLog.unshift({
        id: Date.now(),
        title: source === 'backend' ? 'Backend analysis applied' : 'Local analysis applied',
        note: `Updated ${updatedCount} field${updatedCount === 1 ? '' : 's'} from the latest prompt.`,
      })
      state.intakeText = ''
    })
  },
})

export const {
  applyNaturalLanguageUpdate,
  ingestDocumentText,
  loadSamplePrompt,
  setIntakeText,
} = complaintsSlice.actions

export default complaintsSlice.reducer