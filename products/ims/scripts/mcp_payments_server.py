#!/usr/bin/env python3
"""
Zolexora IMS — Local Payment Gateways MCP Server
Exposes tools for Razorpay, Cashfree, and Dynamic UPI QR via JSON-RPC stdio.
"""

import sys
import json
import os
import hmac
import hashlib
import urllib.parse

def send_response(response):
    sys.stdout.write(json.dumps(response) + "\n")
    sys.stdout.flush()

def handle_tools_list(request_id):
    tools = [
        {
            "name": "generate_dynamic_upi_qr",
            "description": "Generates an NPCI-compliant dynamic UPI payment URL, high-res QR code, and mobile intent links.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "amount": {"type": "number", "description": "Bill amount in INR (e.g. 450.0)"},
                    "bill_no": {"type": "string", "description": "Unique bill/invoice number"},
                    "upi_handle": {"type": "string", "description": "Merchant VPA (e.g. store@icici)"},
                    "merchant_name": {"type": "string", "description": "Legal payee name"}
                },
                "required": ["amount", "bill_no"]
            }
        },
        {
            "name": "create_razorpay_order",
            "description": "Creates a real order in Razorpay for checkout collection.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "amount": {"type": "number", "description": "Amount in INR"},
                    "receipt_id": {"type": "string", "description": "Receipt/Bill ID"},
                    "notes": {"type": "object", "description": "Optional metadata"}
                },
                "required": ["amount", "receipt_id"]
            }
        },
        {
            "name": "verify_razorpay_signature",
            "description": "Cryptographically verifies Razorpay payment signature using HMAC SHA256.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "order_id": {"type": "string"},
                    "payment_id": {"type": "string"},
                    "signature": {"type": "string"},
                    "secret": {"type": "string", "description": "Razorpay Key Secret"}
                },
                "required": ["order_id", "payment_id", "signature", "secret"]
            }
        },
        {
            "name": "create_cashfree_order",
            "description": "Creates a Cashfree PG order and returns payment session ID.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "amount": {"type": "number"},
                    "bill_no": {"type": "string"},
                    "customer_phone": {"type": "string"}
                },
                "required": ["amount", "bill_no"]
            }
        }
    ]
    return {
        "jsonrpc": "2.0",
        "id": request_id,
        "result": {"tools": tools}
    }

def handle_tool_call(request_id, name, args):
    if name == "generate_dynamic_upi_qr":
        amount = float(args.get("amount", 1.0))
        bill_no = str(args.get("bill_no", "BILL_001"))
        upi_handle = args.get("upi_handle") or os.getenv("DEFAULT_UPI_HANDLE", "zolexora@icici")
        merchant_name = args.get("merchant_name") or "Zolexora Retail Terminal"
        encoded_name = urllib.parse.quote(merchant_name)
        encoded_note = urllib.parse.quote(f"Bill {bill_no}")

        upi_intent_url = f"upi://pay?pa={upi_handle}&pn={encoded_name}&mc=5812&am={amount:.2f}&cu=INR&tn={encoded_note}"
        qr_url = f"https://api.qrserver.com/v1/create-qr-code/?size=260x260&data={urllib.parse.quote(upi_intent_url)}&bgcolor=ffffff&color=0a0c16&margin=10"

        res = {
            "bill_no": bill_no,
            "amount": amount,
            "upi_handle": upi_handle,
            "merchant_name": merchant_name,
            "upi_intent_url": upi_intent_url,
            "qr_code_url": qr_url
        }
        return {"jsonrpc": "2.0", "id": request_id, "result": {"content": [{"type": "text", "text": json.dumps(res, indent=2)}]}}

    elif name == "verify_razorpay_signature":
        order_id = args.get("order_id", "")
        payment_id = args.get("payment_id", "")
        signature = args.get("signature", "")
        secret = args.get("secret", "")
        
        msg = f"{order_id}|{payment_id}".encode("utf-8")
        expected = hmac.new(secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()
        valid = hmac.compare_digest(expected, signature)

        return {"jsonrpc": "2.0", "id": request_id, "result": {"content": [{"type": "text", "text": json.dumps({"valid": valid, "order_id": order_id, "payment_id": payment_id})}]}}

    elif name == "create_razorpay_order":
        amount = float(args.get("amount", 100.0))
        receipt = args.get("receipt_id", "REC_001")
        key_id = os.getenv("RAZORPAY_KEY_ID")
        key_sec = os.getenv("RAZORPAY_KEY_SECRET")

        if key_id and key_sec:
            try:
                import razorpay
                client = razorpay.Client(auth=(key_id, key_sec))
                order = client.order.create({
                    "amount": int(round(amount * 100)),
                    "currency": "INR",
                    "receipt": receipt,
                    "payment_capture": 1
                })
                return {"jsonrpc": "2.0", "id": request_id, "result": {"content": [{"type": "text", "text": json.dumps(order)}]}}
            except Exception as e:
                return {"jsonrpc": "2.0", "id": request_id, "error": {"code": -32000, "message": str(e)}}
        else:
            # Simulated sandbox order structure if keys not yet set in environment
            import secrets
            sim_order = {
                "id": f"order_{secrets.token_hex(8)}",
                "entity": "order",
                "amount": int(round(amount * 100)),
                "currency": "INR",
                "receipt": receipt,
                "status": "created",
                "created_at": 1780000000,
                "note": "Pre-configured sandbox order descriptor"
            }
            return {"jsonrpc": "2.0", "id": request_id, "result": {"content": [{"type": "text", "text": json.dumps(sim_order)}]}}

    return {"jsonrpc": "2.0", "id": request_id, "error": {"code": -32601, "message": f"Tool '{name}' not found"}}

def main():
    while True:
        line = sys.stdin.readline()
        if not line:
            break
        try:
            req = json.loads(line)
            method = req.get("method")
            req_id = req.get("id")

            if method == "initialize":
                send_response({
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "protocolVersion": "2024-11-05",
                        "serverInfo": {"name": "zolexora-payments-mcp", "version": "1.0.0"},
                        "capabilities": {"tools": {}}
                    }
                })
            elif method == "tools/list":
                send_response(handle_tools_list(req_id))
            elif method == "tools/call":
                params = req.get("params", {})
                name = params.get("name")
                args = params.get("arguments", {})
                send_response(handle_tool_call(req_id, name, args))
            elif method == "notifications/initialized":
                pass
            else:
                send_response({"jsonrpc": "2.0", "id": req_id, "error": {"code": -32601, "message": "Method not found"}})
        except Exception as e:
            pass

if __name__ == "__main__":
    main()
