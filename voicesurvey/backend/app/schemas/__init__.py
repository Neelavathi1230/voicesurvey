from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator



class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    email: str
    created_at: datetime


class TextIn(BaseModel):
    text: str = Field(min_length=1, max_length=settings.max_message_chars)


class SurveyCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=1000)
    questions: list[str] = Field(min_length=1, max_length=20)

    @field_validator("title", "description")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()

    @field_validator("questions")
    @classmethod
    def _questions(cls, v: list[str]) -> list[str]:
        cleaned = [q.strip() for q in v]
        if any(not q or len(q) > 300 for q in cleaned):
            raise ValueError("Each question must be 1 to 300 characters.")
        return cleaned


class SurveyPatch(BaseModel):
    is_open: bool


class AnswerIn(BaseModel):
    question_id: int
    transcript: str = Field(min_length=1, max_length=2000)
    input_type: str = Field(pattern="^(voice|text)$")


class ResponseIn(BaseModel):
    answers: list[AnswerIn] = Field(min_length=1, max_length=20)


def ok(data: Any = None, message: str = "OK") -> dict:
    return {"success": True, "data": data, "message": message}
