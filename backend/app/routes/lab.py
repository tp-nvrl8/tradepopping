from fastapi import APIRouter
from typing import List
import uuid

from ..models.lab_idea import LabIdea

router = APIRouter()

# simple in-memory store for now
IDEAS: List[LabIdea] = []


@router.get("/ideas", response_model=List[LabIdea])
def list_ideas():
    return IDEAS


@router.post("/ideas", response_model=LabIdea)
def save_idea(idea: LabIdea):
    if idea.meta.id is None:
        idea.meta.id = str(uuid.uuid4())
    IDEAS.append(idea)
    return idea