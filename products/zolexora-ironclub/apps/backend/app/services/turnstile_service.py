import uuid
from datetime import datetime, timezone, date
from typing import Tuple, Optional
from app.services.mock_data import (
    MOCK_MEMBERS, 
    MOCK_GATE_DEVICES, 
    MOCK_ACCESS_LOGS, 
    MOCK_BRANCHES
)
from app.schemas.gym_schemas import AccessVerificationIn, AccessVerificationOut

class TurnstileEngine:
    @staticmethod
    def verify_and_log(req: AccessVerificationIn) -> AccessVerificationOut:
        # 1. Locate Gate Device
        gate = next((g for g in MOCK_GATE_DEVICES if g["id"] == req.deviceId), None)
        gate_name = gate["name"] if gate else f"Gate Device ({req.deviceId})"
        branch_id = gate["branchId"] if gate else "branch-blr-01"
        branch = next((b for b in MOCK_BRANCHES if b["id"] == branch_id), MOCK_BRANCHES[0])

        # 2. Check if gate is in lockdown
        if gate and gate.get("isLockedDown"):
            log_event = {
                "id": f"log-{uuid.uuid4().hex[:8]}",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "memberId": None,
                "memberName": "Security Override",
                "memberPhotoUrl": "",
                "deviceId": req.deviceId,
                "deviceName": gate_name,
                "zone": req.gateZone,
                "direction": req.direction,
                "decision": "DENIED_LOCKDOWN",
                "reason": "Gate device is under emergency lockdown."
            }
            MOCK_ACCESS_LOGS.insert(0, log_event)
            return AccessVerificationOut(
                decision="DENIED_LOCKDOWN",
                accessGranted=False,
                message="Turnstile is currently in safety lockdown mode.",
                currentGymOccupancy=branch["currentOccupancy"],
                maxGymCapacity=branch["maxCapacity"]
            )

        # 3. Match Member by Scanned Credential (RFID tag, QR token, or Membership ID)
        member = None
        for m in MOCK_MEMBERS:
            if (
                m.get("rfidTagId") == req.credentialValue or 
                m.get("dynamicQrSecret") == req.credentialValue or
                m.get("membershipNumber") == req.credentialValue or
                m.get("id") == req.credentialValue
            ):
                member = m
                break

        if not member:
            # Unknown Credential
            log_event = {
                "id": f"log-{uuid.uuid4().hex[:8]}",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "memberId": None,
                "memberName": "Unknown Credential",
                "memberPhotoUrl": "",
                "deviceId": req.deviceId,
                "deviceName": gate_name,
                "zone": req.gateZone,
                "direction": req.direction,
                "decision": "DENIED_UNKNOWN_CREDENTIAL",
                "reason": f"Credential '{req.credentialValue}' not registered."
            }
            MOCK_ACCESS_LOGS.insert(0, log_event)
            return AccessVerificationOut(
                decision="DENIED_UNKNOWN_CREDENTIAL",
                accessGranted=False,
                message="Invalid card or pass. Please present a registered IronClub pass.",
                currentGymOccupancy=branch["currentOccupancy"],
                maxGymCapacity=branch["maxCapacity"]
            )

        member_name = f"{member['firstName']} {member['lastName']}"

        # 4. Check Member Status
        if member["status"] == "EXPIRED":
            log_event = {
                "id": f"log-{uuid.uuid4().hex[:8]}",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "memberId": member["id"],
                "memberName": member_name,
                "memberPhotoUrl": member["avatarUrl"],
                "membershipTier": member["tier"],
                "deviceId": req.deviceId,
                "deviceName": gate_name,
                "zone": req.gateZone,
                "direction": req.direction,
                "decision": "DENIED_EXPIRED",
                "reason": f"Membership expired on {member['expiryDate']}."
            }
            MOCK_ACCESS_LOGS.insert(0, log_event)
            return AccessVerificationOut(
                decision="DENIED_EXPIRED",
                accessGranted=False,
                memberId=member["id"],
                memberName=member_name,
                memberPhotoUrl=member["avatarUrl"],
                membershipTier=member["tier"],
                message=f"Membership expired on {member['expiryDate']}. Please renew to enter.",
                currentGymOccupancy=branch["currentOccupancy"],
                maxGymCapacity=branch["maxCapacity"]
            )

        if member["status"] == "FROZEN":
            log_event = {
                "id": f"log-{uuid.uuid4().hex[:8]}",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "memberId": member["id"],
                "memberName": member_name,
                "memberPhotoUrl": member["avatarUrl"],
                "membershipTier": member["tier"],
                "deviceId": req.deviceId,
                "deviceName": gate_name,
                "zone": req.gateZone,
                "direction": req.direction,
                "decision": "DENIED_FROZEN",
                "reason": "Membership is currently frozen / on hold."
            }
            MOCK_ACCESS_LOGS.insert(0, log_event)
            return AccessVerificationOut(
                decision="DENIED_FROZEN",
                accessGranted=False,
                memberId=member["id"],
                memberName=member_name,
                memberPhotoUrl=member["avatarUrl"],
                membershipTier=member["tier"],
                message="Your membership is frozen. Unfreeze via IronClub app or reception.",
                currentGymOccupancy=branch["currentOccupancy"],
                maxGymCapacity=branch["maxCapacity"]
            )

        # 5. Check Zone Privilege (e.g. VIP Lounge requires GOLD or BLACK_IRON_VIP)
        if req.gateZone in ["VIP_LOUNGE", "RECOVERY_SAUNA"] and member["tier"] in ["BRONZE", "SILVER"]:
            log_event = {
                "id": f"log-{uuid.uuid4().hex[:8]}",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "memberId": member["id"],
                "memberName": member_name,
                "memberPhotoUrl": member["avatarUrl"],
                "membershipTier": member["tier"],
                "deviceId": req.deviceId,
                "deviceName": gate_name,
                "zone": req.gateZone,
                "direction": req.direction,
                "decision": "DENIED_TIER_RESTRICTED",
                "reason": f"Zone {req.gateZone} requires Gold or VIP membership."
            }
            MOCK_ACCESS_LOGS.insert(0, log_event)
            return AccessVerificationOut(
                decision="DENIED_TIER_RESTRICTED",
                accessGranted=False,
                memberId=member["id"],
                memberName=member_name,
                memberPhotoUrl=member["avatarUrl"],
                membershipTier=member["tier"],
                message="Zone access restricted to Gold and VIP members.",
                currentGymOccupancy=branch["currentOccupancy"],
                maxGymCapacity=branch["maxCapacity"]
            )

        # 6. Check Capacity on Entry
        if req.direction == "ENTRY" and branch["currentOccupancy"] >= branch["maxCapacity"]:
            log_event = {
                "id": f"log-{uuid.uuid4().hex[:8]}",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "memberId": member["id"],
                "memberName": member_name,
                "memberPhotoUrl": member["avatarUrl"],
                "membershipTier": member["tier"],
                "deviceId": req.deviceId,
                "deviceName": gate_name,
                "zone": req.gateZone,
                "direction": req.direction,
                "decision": "DENIED_OVER_CAPACITY",
                "reason": f"Gym reached maximum capacity ({branch['maxCapacity']})."
            }
            MOCK_ACCESS_LOGS.insert(0, log_event)
            return AccessVerificationOut(
                decision="DENIED_OVER_CAPACITY",
                accessGranted=False,
                memberId=member["id"],
                memberName=member_name,
                memberPhotoUrl=member["avatarUrl"],
                membershipTier=member["tier"],
                message="Gym is currently at full capacity. Please wait for outgoing members.",
                currentGymOccupancy=branch["currentOccupancy"],
                maxGymCapacity=branch["maxCapacity"]
            )

        # 7. Access GRANTED! Update telemetry & occupancy
        if req.direction == "ENTRY":
            branch["currentOccupancy"] = min(branch["maxCapacity"], branch["currentOccupancy"] + 1)
            member["stats"]["totalWorkouts"] += 1
            member["stats"]["monthVisits"] += 1
            member["stats"]["lastVisit"] = datetime.now(timezone.utc).isoformat()
        elif req.direction == "EXIT":
            branch["currentOccupancy"] = max(0, branch["currentOccupancy"] - 1)

        if gate:
            gate["todayCyclesCount"] += 1

        log_event = {
            "id": f"log-{uuid.uuid4().hex[:8]}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "memberId": member["id"],
            "memberName": member_name,
            "memberPhotoUrl": member["avatarUrl"],
            "membershipTier": member["tier"],
            "deviceId": req.deviceId,
            "deviceName": gate_name,
            "zone": req.gateZone,
            "direction": req.direction,
            "decision": "GRANTED",
            "reason": f"Authorized {member['tier']} pass. Welcome to IronClub!"
        }
        MOCK_ACCESS_LOGS.insert(0, log_event)
        # Keep logs capped to latest 100
        if len(MOCK_ACCESS_LOGS) > 100:
            MOCK_ACCESS_LOGS.pop()

        return AccessVerificationOut(
            decision="GRANTED",
            accessGranted=True,
            memberId=member["id"],
            memberName=member_name,
            memberPhotoUrl=member["avatarUrl"],
            membershipTier=member["tier"],
            message=f"Welcome {member['firstName']}! Turnstile unlocked.",
            unlockDurationMs=5000,
            currentGymOccupancy=branch["currentOccupancy"],
            maxGymCapacity=branch["maxCapacity"]
        )
