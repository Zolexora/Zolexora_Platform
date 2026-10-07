from pydantic import BaseModel, ConfigDict

class APIModel(BaseModel):
    """Base Pydantic model for all API requests and responses."""
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
