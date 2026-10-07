#!/usr/bin/env python3
import json
import re
import sys
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1] / "contracts" / "zolexora-erp" / "v1"
MUTATIONS = {
    "sales-order-request",
    "delivery-update",
    "sales-invoice-update",
    "payment-accounting-entry",
    "return-request",
    "refund-accounting-entry",
}
CREDENTIAL_FIELD = re.compile(r"(^|_)(api_?key|client_?secret|password|token|webhook_?secret)($|_)", re.I)


def credential_fields(value, path=""):
    if isinstance(value, dict):
        for key, child in value.items():
            child_path = f"{path}.{key}" if path else key
            if CREDENTIAL_FIELD.search(key):
                yield child_path
            yield from credential_fields(child, child_path)
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from credential_fields(child, f"{path}[{index}]")


def main() -> int:
    schemas = {}
    for path in sorted((ROOT / "schemas").glob("*.schema.json")):
        schema = json.loads(path.read_text())
        Draft202012Validator.check_schema(schema)
        schemas[path.name.removesuffix(".schema.json")] = schema

    examples = sorted((ROOT / "examples").glob("*.example.json"))
    for path in examples:
        name = path.name.removesuffix(".example.json")
        value = json.loads(path.read_text())
        if name not in schemas:
            raise ValueError(f"Missing schema for {path.name}")
        Draft202012Validator(schemas[name], format_checker=FormatChecker()).validate(value)
        for required in ("schema_version", "tenant_external_id", "organization_external_id"):
            if not value.get(required):
                raise ValueError(f"{path.name}: missing {required}")
        if name in MUTATIONS and not value.get("idempotency_key"):
            raise ValueError(f"{path.name}: missing idempotency_key")
        forbidden = list(credential_fields(value))
        if forbidden:
            raise ValueError(f"{path.name}: credential-like fields: {', '.join(forbidden)}")

    openapi = yaml.safe_load((ROOT / "proposed-openapi.yaml").read_text())
    if openapi.get("openapi") != "3.1.0" or not openapi.get("paths"):
        raise ValueError("Malformed proposed OpenAPI document")
    print(f"Validated {len(schemas)} schemas, {len(examples)} examples, and proposed OpenAPI 3.1.0.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERP contract validation failed: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
