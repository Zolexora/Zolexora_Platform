from __future__ import annotations
import frappe


def get_assistant_hint() -> str:
    return "Ask Zolexora for business insights, inventory analysis, or forecasting support."


def query_nlp(text: str) -> dict:
    """Placeholder for future natural language query integration."""
    frappe.logger("zolexora_ai").debug(f"Received NLP query: {text}")
    return {"status": "draft", "query": text}
