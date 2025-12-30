import uuid
from typing import List

from fastapi import APIRouter

from ..models.lab_idea import LabIdea

router = APIRouter()

# simple in-memory store for now
IDEAS: List[LabIdea] = []


@router.get("/ideas", response_model=List[LabIdea])
def list_ideas():
    return IDEAS


@router.post("/ideas", response_model=LabIdea)
def save_idea(idea: LabIdea):
    """
    Upsert behavior:
    - If idea.meta.id is None: assign a new id and append.
    - If idea.meta.id exists: replace the existing idea with that id, if found.
    """
    # New idea: assign id and append
    if idea.meta.id is None:
        idea.meta.id = str(uuid.uuid4())
        IDEAS.append(idea)
        return idea

    # Existing idea: look for same id and replace in place
    for idx, existing in enumerate(IDEAS):
        if existing.meta.id == idea.meta.id:
            IDEAS[idx] = idea
            return idea

    # If not found, just append (fallback)
    IDEAS.append(idea)
    return idea
