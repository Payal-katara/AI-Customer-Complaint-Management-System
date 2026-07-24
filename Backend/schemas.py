from datetime import datetime

from pydantic import BaseModel, Field


class AnalyzeRequest(BaseModel):
    text: str = Field(min_length=1)


class ComplaintField(BaseModel):
    key: str
    label: str
    value: str = ''


class AnalysisResult(BaseModel):
    riskScore: int
    riskLevel: str
    nextStep: str
    initialAssessment: str
    reasoningPoints: list[str]
    updatedFields: list[str]
    extractedFields: list[ComplaintField]


class AnalyzeResponse(BaseModel):
    updates: dict[str, str]
    analysis: AnalysisResult


class ComplaintRecordBase(BaseModel):
    intakeText: str
    updates: dict[str, str]
    analysis: dict


class ComplaintRecordRead(BaseModel):
    id: int
    intakeText: str
    updates: dict[str, str]
    analysis: dict
    createdAt: datetime


class ComplaintRecordDetail(ComplaintRecordRead):
    pass


class ComplaintListResponse(BaseModel):
    items: list[ComplaintRecordRead]
    total: int


class DeleteResponse(BaseModel):
    message: str


class ServiceInfo(BaseModel):
    name: str
    version: str
    status: str
