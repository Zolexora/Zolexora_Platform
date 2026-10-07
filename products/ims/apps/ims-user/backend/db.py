try:
    from .d1_adapter import D1Adapter
except ImportError:
    from d1_adapter import D1Adapter

# Global database adapter singleton
db = D1Adapter()
