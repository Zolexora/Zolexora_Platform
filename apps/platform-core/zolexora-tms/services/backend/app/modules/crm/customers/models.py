"""Customers are CRM clients: bookings, invoices and payments reference `clients.id`
(see alembic g10000000003). `Customer` is kept as an alias for existing imports."""
from app.modules.crm.clients.models import Client as Customer

__all__ = ["Customer"]
