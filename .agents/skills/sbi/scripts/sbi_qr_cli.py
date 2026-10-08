#!/usr/bin/env python3
"""
SBI Merchant Dynamic UPI QR CLI & Diagnostic Tool
Zolexora IMS — State Bank of India Merchant Utilities
"""

import sys
import argparse
import urllib.parse


def validate_sbi_vpa(vpa: str) -> bool:
    """Validates if a given UPI ID matches common SBI merchant patterns."""
    valid_suffixes = ("@sbi", "@sbiepay", "@sbiyono", "@yono")
    vpa = vpa.strip().lower()
    return any(vpa.endswith(sfx) for sfx in valid_suffixes)


def generate_sbi_intent(
    vpa: str,
    payee_name: str,
    amount: float,
    bill_no: str,
    mcc: str = "5812"
) -> dict:
    """Generates an NPCI-compliant dynamic UPI intent URL for an SBI merchant account."""
    vpa = vpa.strip().lower()
    encoded_name = urllib.parse.quote(payee_name.strip())
    encoded_note = urllib.parse.quote(f"Bill_{bill_no.strip()}")
    amt_str = f"{max(0.01, float(amount)):.2f}"

    intent_url = (
        f"upi://pay?pa={vpa}&pn={encoded_name}&mc={mcc}&am={amt_str}&cu=INR&tn={encoded_note}"
    )

    qr_image_url = (
        f"https://api.qrserver.com/v1/create-qr-code/?size=300x300&data="
        f"{urllib.parse.quote(intent_url)}&bgcolor=ffffff&color=090a10&margin=8"
    )

    return {
        "vpa": vpa,
        "is_sbi_vpa": validate_sbi_vpa(vpa),
        "payee_name": payee_name,
        "amount": amt_str,
        "currency": "INR",
        "bill_no": bill_no,
        "mcc": mcc,
        "intent_url": intent_url,
        "qr_image_url": qr_image_url,
        "rupay_cc_supported": True if validate_sbi_vpa(vpa) else "Depends on merchant tier",
        "app_links": {
            "gpay": f"gpay://upi/pay?pa={vpa}&pn={encoded_name}&am={amt_str}&cu=INR&tn={encoded_note}",
            "phonepe": f"phonepe://upi/pay?pa={vpa}&pn={encoded_name}&am={amt_str}&cu=INR&tn={encoded_note}",
            "paytm": f"paytmmp://pay?pa={vpa}&pn={encoded_name}&am={amt_str}&cu=INR&tn={encoded_note}"
        }
    }


def main():
    parser = argparse.ArgumentParser(description="SBI Merchant Dynamic UPI QR CLI")
    parser.add_argument("--vpa", default="zolexora@sbi", help="SBI Merchant UPI VPA (e.g. store@sbi)")
    parser.add_argument("--name", default="Zolexora Retail Operations", help="Legal payee business name")
    parser.add_argument("--amount", type=float, default=100.0, help="Amount in INR")
    parser.add_argument("--bill", default="INV_1001", help="Invoice / Bill number")
    parser.add_argument("--mcc", default="5812", help="Merchant Category Code (default: 5812)")

    args = parser.parse_args()

    result = generate_sbi_intent(args.vpa, args.name, args.amount, args.bill, args.mcc)

    print("=" * 60)
    print("  SBI MERCHANT DYNAMIC UPI QR GENERATOR")
    print("=" * 60)
    print(f"Merchant VPA      : {result['vpa']} {'(Valid SBI Handle)' if result['is_sbi_vpa'] else '(Custom Handle)'}")
    print(f"Payee Name        : {result['payee_name']}")
    print(f"Amount            : ₹{result['amount']}")
    print(f"Bill Ref          : {result['bill_no']}")
    print(f"MCC Code          : {result['mcc']}")
    print(f"RuPay CC Support  : {'ENABLED (Merchant Tier)' if result['is_sbi_vpa'] else 'Check with Bank'}")
    print("-" * 60)
    print("NPCI Intent URI   :")
    print(result['intent_url'])
    print("-" * 60)
    print("Dynamic QR Code   :")
    print(result['qr_image_url'])
    print("=" * 60)


if __name__ == "__main__":
    main()
