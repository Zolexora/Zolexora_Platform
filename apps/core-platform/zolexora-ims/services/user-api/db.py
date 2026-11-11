try:
    from .database import Database
except ImportError:
    from database import Database

db = Database()
