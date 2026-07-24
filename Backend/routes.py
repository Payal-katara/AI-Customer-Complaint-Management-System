from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import ComplaintRecord
from app.schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    ComplaintListResponse,
    ComplaintRecordDetail,
    ComplaintRecordRead,
    DeleteResponse,
    ServiceInfo,
)
from app.services.analyzer import analyze_complaint

router = APIRouter()

SERVICE_INFO = ServiceInfo(name='AI User Complaint API', version='1.0.0', status='operational')


def serialize_record(record: ComplaintRecord) -> ComplaintRecordRead:
    return ComplaintRecordRead(
        id=record.id,
        intakeText=record.intake_text,
        updates=record.updates,
        analysis=record.analysis,
        createdAt=record.created_at,
    )


@router.get('/', response_model=ServiceInfo)
def root():
    return SERVICE_INFO


@router.get('/health')
def health_check():
    return {'status': 'ok', 'service': SERVICE_INFO.name}


@router.post('/analyze', response_model=AnalyzeResponse)
def analyze(payload: AnalyzeRequest, db: Session = Depends(get_db)):
    result = analyze_complaint(payload.text)
    record = ComplaintRecord(
        intake_text=payload.text,
        updates=result.updates,
        analysis=result.analysis.model_dump(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return result


@router.get('/complaints', response_model=ComplaintListResponse)
def list_complaints(
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    query = db.query(ComplaintRecord)
    total = query.count()
    records = query.order_by(desc(ComplaintRecord.id)).offset(skip).limit(limit).all()

    return {
        'items': [serialize_record(record) for record in records],
        'total': total,
    }


@router.get('/complaints/{complaint_id}', response_model=ComplaintRecordDetail)
def get_complaint(complaint_id: int, db: Session = Depends(get_db)):
    record = db.get(ComplaintRecord, complaint_id)

    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Complaint record not found')

    return serialize_record(record)


@router.delete('/complaints/{complaint_id}', response_model=DeleteResponse)
def delete_complaint(complaint_id: int, db: Session = Depends(get_db)):
    record = db.get(ComplaintRecord, complaint_id)

    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Complaint record not found')

    db.delete(record)
    db.commit()

    return {'message': f'Complaint record {complaint_id} deleted.'}
