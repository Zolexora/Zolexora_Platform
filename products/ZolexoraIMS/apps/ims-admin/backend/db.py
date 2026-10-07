try:
    from .d1_adapter import AdminD1Adapter
except ImportError:
    from d1_adapter import AdminD1Adapter

db = AdminD1Adapter()
