import { useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import './ComplaintUI.css'
import {
  submitComplaintAnalysis,
  loadSamplePrompt,
  ingestDocumentText,
  setIntakeText,
} from './store/complaintsSlice'

import mammoth from 'mammoth'
import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const formSections = [
  {
    id: 'origin',
    title: 'Origin & Customer Details',
    fields: [
      { key: 'complaintSource', label: 'Complaint Source' },
      { key: 'customerName', label: 'Customer Name' },
    ],
  },
  {
    id: 'product',
    title: 'Product & Batch Identification',
    fields: [
      { key: 'productName', label: 'Product Name' },
      { key: 'productStrengthGrade', label: 'Product Strength / Grade' },
      { key: 'batchLotNumber', label: 'Batch / Lot Number' },
      { key: 'manufacturingDate', label: 'Manufacturing Date' },
      { key: 'expiryDate', label: 'Expiry Date' },
      { key: 'quantityAffected', label: 'Quantity Affected' },
    ],
  },
  {
    id: 'details',
    title: 'Complaint Details',
    fields: [
      { key: 'complaintType', label: 'Complaint Type' },
      { key: 'complaintDate', label: 'Complaint Date' },
      { key: 'detailedComplaintDescription', label: 'Detailed Complaint Description', isTextarea: true },
    ],
  },
  {
    id: 'assessment',
    title: 'Initial Assessment & Priority',
    fields: [
      { key: 'initialSeverity', label: 'Initial Severity' },
      { key: 'priority', label: 'Priority' },
    ],
  },
]

const samplePrompts = [
  'Paracetamol tablets were labeled as 500 mg but the customer says the pack contains 300 mg tablets. Batch lot B-402. Please review urgently.',
  'The customer emailed saying the shipment arrived damaged and one bottle was leaking. Order came through WhatsApp from Priya Sharma.',
  'The medicine was not of 500 mg it was 300 mg and the patient reported dizziness after taking it.',
]

function readFileAsArrayBuffer(file) {
  return file.arrayBuffer()
}

async function extractTextFromFile(file) {
  const fileName = file.name.toLowerCase()

  if (file.type === 'application/pdf' || fileName.endsWith('.pdf')) {
    const data = new Uint8Array(await readFileAsArrayBuffer(file))
    const document = await pdfjsLib.getDocument({ data }).promise
    const pageTexts = []

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber)
      const content = await page.getTextContent()
      const text = content.items.map((item) => item.str).join(' ')
      pageTexts.push(text)
    }

    return pageTexts.join('\n')
  }

  if (fileName.endsWith('.docx')) {
    const { value } = await mammoth.extractRawText({ arrayBuffer: await readFileAsArrayBuffer(file) })
    return value
  }

  if (file.type.startsWith('text/') || fileName.endsWith('.txt')) {
    return file.text()
  }

  throw new Error('Unsupported file type. Please upload a PDF, DOCX, or TXT file.')
}

function renderValue(value) {
  return value || 'Awaiting AI extraction...'
}

function App() {
  const dispatch = useDispatch()
  const { form, intakeText, analysis, assistantLog } = useSelector((state) => state.complaints)
  const [uploadStatus, setUploadStatus] = useState('Upload a PDF, DOCX, or TXT file to extract complaint details.')
  const [isDropActive, setIsDropActive] = useState(false)
  const fileInputRef = useRef(null)

  const filledFieldCount = Object.values(form).filter(Boolean).length
  const fillProgress = Math.round((filledFieldCount / Object.keys(form).length) * 100)

  const handleUploadAction = () => {
    fileInputRef.current?.click()
  }

  const handleUpdateForm = () => {
    const text = intakeText.trim()

    dispatch(submitComplaintAnalysis({ text, currentForm: form }))
  }

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    setUploadStatus(`Reading ${file.name}...`)

    try {
      const extractedText = await extractTextFromFile(file)
      const documentText = `Uploaded file: ${file.name}\n${extractedText}`
      dispatch(ingestDocumentText(documentText))
      dispatch(submitComplaintAnalysis({ text: documentText, currentForm: form }))
      setUploadStatus(`Extracted text from ${file.name} and populated the complaint form.`)
    } catch (error) {
      setUploadStatus(error instanceof Error ? error.message : 'Unable to extract text from the uploaded file.')
    } finally {
      event.target.value = ''
    }
  }

  const handleDocumentDrop = async (event) => {
    event.preventDefault()
    setIsDropActive(false)

    const file = event.dataTransfer.files?.[0]

    if (!file) {
      return
    }

    const syntheticEvent = {
      target: {
        files: [file],
        value: '',
      },
    }

    await handleFileUpload(syntheticEvent)
  }

  return (
    <main className="app-shell">
      <div className="background-orb background-orb-one" aria-hidden="true" />
      <div className="background-orb background-orb-two" aria-hidden="true" />

      <section className="hero-panel panel-glass">
        <div className="hero-copy">
          <span className="eyebrow">AI User Complaint Module</span>
          <h1>Log customer complaints</h1>
          <p>
            Share your concern with our AI assistant.
          </p>
        </div>

        <div className="hero-metrics" aria-label="Extraction summary">
          <article>
            <strong>{fillProgress}%</strong>
            <span>Auto-fill progress</span>
          </article>
          <article>
            <strong>{analysis.riskLevel}</strong>
            <span>Current risk</span>
          </article>
          <article>
            <strong>{filledFieldCount}</strong>
            <span>Fields captured</span>
          </article>
        </div>
      </section>

      <section className="content-grid">
        <section className="panel form-panel panel-glass">
          <div className="panel-header">
            <div>
              <span className="panel-label">Log Customer Complaint</span>
              <h2>Complaint form</h2>
            </div>
          </div>

          <div className="form-sections">
            {formSections.map((section, sectionIndex) => (
              <div className="form-section" key={section.id}>
                <div className="section-index">{sectionIndex + 1}.</div>
                <h3>{section.title}</h3>
                <div className="section-grid">
                  {section.fields.map((field) => (
                    <label className={field.isTextarea ? 'field field-textarea' : 'field'} key={field.key}>
                      <span>{field.label}</span>
                      {field.isTextarea ? (
                        <textarea readOnly rows="4" value={renderValue(form[field.key])} />
                      ) : (
                        <input readOnly type="text" value={renderValue(form[field.key])} />
                      )}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

        </section>

        <section className="panel assistant-panel panel-glass">
          <div className="panel-header">
            <div>
              <span className="panel-label">AI Assistant Tool</span>
              <h2>Paste the complaint text or email</h2>
            </div>
            <span className="status-pill status-pill-beta">BETA</span>
          </div>

          <div
            className={`drop-zone ${isDropActive ? 'drop-zone-active' : ''}`}
            role="button"
            tabIndex={0}
            onClick={handleUploadAction}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                handleUploadAction()
              }
            }}
            onDragEnter={() => setIsDropActive(true)}
            onDragLeave={() => setIsDropActive(false)}
            onDragOver={(event) => {
              event.preventDefault()
              setIsDropActive(true)
            }}
            onDrop={handleDocumentDrop}
          >
            <div className="drop-zone-icon">⬆</div>
            <div>
              <strong>Upload a complaint document here</strong>
              <p>PDF, DOCX, or TXT files are converted into complaint details automatically.</p>
            </div>
          </div>

          <input
            ref={fileInputRef}
            className="sr-only-input"
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={handleFileUpload}
          />

          <p className="upload-status" aria-live="polite">
            {uploadStatus}
          </p>

          <div className="assistant-input-group">
            <textarea
              className="assistant-input"
              rows="7"
              value={intakeText}
              onChange={(event) => dispatch(setIntakeText(event.target.value))}
              placeholder="Example: The medicine was not of 500 mg it was 300 mg and the customer reported dizziness after taking it. Batch B-402."
            />

            <div className="sample-prompt-list">
              {samplePrompts.map((prompt, index) => (
                <button
                  className="sample-chip"
                  key={prompt}
                  type="button"
                  onClick={() => dispatch(loadSamplePrompt(prompt))}
                >
                  Sample {index + 1}
                </button>
              ))}
            </div>

            <div className="assistant-actions">
              <button
                className="assistant-button assistant-button-primary"
                type="button"
                onClick={handleUpdateForm}
              >
                Send
              </button>
              <button className="assistant-button" type="button" onClick={() => dispatch(setIntakeText(''))}>
                Clear prompt
              </button>
            </div>
          </div>

          <div className="progress-card">
            <div className="progress-card-topline">
              <strong>Extraction progress</strong>
              <span>{fillProgress}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${fillProgress}%` }} />
            </div>
            <p>
              {analysis.initialAssessment} 
            </p>
          </div>
        </section>
      </section>

      <section className="panel risk-panel panel-glass">
        <div className="panel-header">
          <div>
            <span className="panel-label">AI Risk Assessment</span>
          </div>
          <span className={`status-pill status-pill-${analysis.riskLevel.toLowerCase()}`}>
            {analysis.riskLevel}
          </span>
        </div>

        <div className="risk-layout">
          <article className="risk-score-card">
            <div className="risk-score-ring" style={{ '--score': `${analysis.riskScore}%` }}>
              <strong>{analysis.riskScore}</strong>
              <span>score</span>
            </div>
            <p>
              The rate of risk generated.
            </p>
          </article>

          <article className="risk-detail-card">
            <span className="risk-card-label">Initial assessment</span>
            <strong>{analysis.initialAssessment}</strong>
            <p>{analysis.reasoningPoints[0]}</p>
          </article>

          <article className="risk-detail-card">
            <span className="risk-card-label">Next step</span>
            <strong>{analysis.nextStep}</strong>
            <p>{analysis.reasoningPoints[1]}</p>
          </article>
        </div>

        <div className="risk-extraction-panel">
          <div className="risk-extraction-header">
            <span className="risk-card-label">Extracted details</span>
            <strong>Shown here and in the form fields</strong>
          </div>
          <div className="risk-extraction-grid">
            {(analysis.extractedFields || []).map((field) => (
              <article key={field.key} className="risk-extraction-item">
                <span>{field.label}</span>
                <strong>{renderValue(field.value)}</strong>
              </article>
            ))}
          </div>
        </div>

        <div className="reasoning-strip">
          {analysis.reasoningPoints.map((point) => (
            <div className="reasoning-chip" key={point}>
              {point}
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}

export default App
