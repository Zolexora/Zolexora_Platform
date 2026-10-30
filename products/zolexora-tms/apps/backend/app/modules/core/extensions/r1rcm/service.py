import csv
import datetime
import io
import re
import uuid
from typing import Any, Dict, Optional
from zoneinfo import ZoneInfo

from fastapi import HTTPException, UploadFile
from sqlalchemy import select

from app.auth.dependencies import OrgContext
from app.core.audit import record_audit
from app.core.config import settings
from app.modules.core.extensions.r1rcm.schemas import (
    R1ExcelRow, ValidationResult, R1ImportPreviewResponse, R1ConfirmImportRequest
)
from app.modules.operations.bookings.enums import BookingServiceType, BookingStatus, BookingType
from app.modules.operations.bookings.models import Booking
from app.modules.operations.bookings.service import ensure_customer, new_booking_number
from app.modules.operations.duties.models import Duty
from app.modules.operations.duties.schemas import DutyStatus

# Staged batches between preview and confirm, keyed by (organisation_id, batch_id).
# Process-local: preview and confirm must reach the same API worker.
_import_batches: Dict[tuple[str, str], Dict[str, Any]] = {}

SOURCE = "R1RCM_IMPORT"
DATE_FORMATS = ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%d.%m.%Y")


def _pickup_datetime(date_str: str, shift: str) -> Optional[datetime.datetime]:
    """Combine the row date with a shift start like '08:00' or '0800' (midnight if absent)."""
    day = None
    for fmt in DATE_FORMATS:
        try:
            day = datetime.datetime.strptime(date_str.strip(), fmt).date()
            break
        except ValueError:
            continue
    if day is None:
        return None
    m = re.match(r"^\s*(\d{1,2}):?(\d{2})", shift or "")
    t = datetime.time(int(m.group(1)), int(m.group(2))) if m and int(m.group(1)) < 24 and int(m.group(2)) < 60 else datetime.time()
    tz = ZoneInfo(settings.OPERATIONS_TIMEZONE or "UTC")
    return datetime.datetime.combine(day, t, tzinfo=tz)


async def _existing_trip_keys(ctx: OrgContext, customer_id: uuid.UUID) -> set[tuple[str, str]]:
    """(trip_id, date) pairs already imported for this customer."""
    res = await ctx.db.execute(
        select(Booking.metadata_).where(
            Booking.organisation_id == ctx.organisation_id,
            Booking.customer_id == customer_id,
            Booking.source == SOURCE,
            Booking.status != BookingStatus.CANCELLED,
        )
    )
    return {(m.get("r1_trip_id"), m.get("r1_date")) for m in res.scalars().all() if m}


async def process_excel_upload(
    ctx: OrgContext,
    file: UploadFile,
    customer_id: uuid.UUID,
    location: str,
) -> R1ImportPreviewResponse:
    await ensure_customer(ctx, customer_id)
    content = await file.read()
    try:
        rows = list(csv.DictReader(io.StringIO(content.decode("utf-8-sig"))))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid CSV format")

    existing = await _existing_trip_keys(ctx, customer_id)
    seen_in_file: set[tuple[str, str]] = set()
    results = []
    valid_count = error_count = warning_count = 0

    for idx, row in enumerate(rows):
        errors, warnings = [], []
        clean_row = {k.strip().lower(): (v or "").strip() for k, v in row.items() if k}
        r1_row = R1ExcelRow(**{f: clean_row.get(f, "") for f in R1ExcelRow.model_fields})

        if not r1_row.employee_id:
            errors.append("Missing Employee ID")
        if not r1_row.trip_id:
            errors.append("Missing Trip ID")
        if not r1_row.pickup or not r1_row.drop:
            errors.append("Missing pickup or drop address")
        if _pickup_datetime(r1_row.date, r1_row.shift) is None:
            errors.append(f"Unrecognised date '{r1_row.date}' (use YYYY-MM-DD or DD-MM-YYYY)")
        if not r1_row.vehicle_number:
            warnings.append("Vehicle Number not provided - will require manual assignment")

        key = (r1_row.trip_id, r1_row.date)
        if r1_row.trip_id:
            if key in existing:
                errors.append(f"Duplicate: trip {r1_row.trip_id} on {r1_row.date} was already imported")
            elif key in seen_in_file:
                errors.append(f"Duplicate: trip {r1_row.trip_id} on {r1_row.date} appears more than once in this file")
            seen_in_file.add(key)

        is_valid = not errors
        valid_count += is_valid
        error_count += not is_valid
        warning_count += bool(warnings)
        results.append(ValidationResult(row_index=idx + 1, row_data=r1_row, is_valid=is_valid, errors=errors, warnings=warnings))

    batch_id = uuid.uuid4()
    _import_batches[(str(ctx.organisation_id), str(batch_id))] = {
        "customer_id": customer_id, "location": location, "results": results,
    }
    return R1ImportPreviewResponse(
        batch_id=batch_id, total_rows=len(results), valid_count=valid_count,
        error_count=error_count, warning_count=warning_count, results=results,
    )


async def confirm_import(ctx: OrgContext, req: R1ConfirmImportRequest) -> Dict[str, Any]:
    key = (str(ctx.organisation_id), str(req.batch_id))
    batch = _import_batches.get(key)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found or expired")
    if batch["customer_id"] != req.customer_id or batch["location"] != req.location:
        raise HTTPException(status_code=403, detail="Batch does not match customer and location scope")

    # Re-check duplicates: another import may have landed since the preview.
    existing = await _existing_trip_keys(ctx, req.customer_id)
    created = skipped = 0
    for r in (r for r in batch["results"] if r.is_valid):
        row = r.row_data
        if (row.trip_id, row.date) in existing:
            skipped += 1
            continue
        existing.add((row.trip_id, row.date))
        pickup_at = _pickup_datetime(row.date, row.shift)
        booking = Booking(
            booking_number=new_booking_number(),
            organisation_id=ctx.organisation_id,
            customer_id=req.customer_id,
            booking_type=BookingType.ETS,
            service_type=BookingServiceType.PASSENGER,
            pickup_address=row.pickup,
            drop_address=row.drop,
            pickup_datetime=pickup_at,
            passenger_info={"employee_id": row.employee_id, "employee_name": row.employee_name, "shift": row.shift},
            vehicle_requirements={"cab_type": row.cab_type, "vehicle_number": row.vehicle_number},
            commercial_terms={"vendor": row.vendor, "rate": row.rate},
            metadata_={"r1_trip_id": row.trip_id, "r1_date": row.date, "route_number": row.route_number,
                       "location": req.location, "batch_id": str(req.batch_id)},
            source=SOURCE,
            status=BookingStatus.CONFIRMED,
            created_by_user_id=ctx.user_id,
        )
        ctx.db.add(booking)
        await ctx.db.flush()
        ctx.db.add(Duty(
            duty_number=f"DTY-{pickup_at.year}-{uuid.uuid4().hex[:8].upper()}",
            organisation_id=ctx.organisation_id,
            booking_id=booking.id,
            scheduled_start_time=pickup_at,
            scheduled_end_time=pickup_at,
            status=DutyStatus.UNASSIGNED,
        ))
        created += 1

    record_audit(ctx.db, ctx.organisation_id, ctx.user_id, "R1_IMPORT_CONFIRMED", "r1_import_batch", req.batch_id,
                 {"customer_id": str(req.customer_id), "location": req.location, "created": created, "skipped_duplicates": skipped})
    await ctx.db.commit()
    del _import_batches[key]
    return {"status": "success", "created_bookings": created, "skipped_duplicates": skipped}
