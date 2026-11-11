from sqlalchemy.orm import DeclarativeBase

from .naming import metadata


class Base(DeclarativeBase):
    metadata = metadata
