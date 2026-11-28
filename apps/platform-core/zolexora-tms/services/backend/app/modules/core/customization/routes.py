from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Dict, Any

from app.db.session import get_db
from app.auth.dependencies import get_current_active_organisation, AuthenticatedUser
from app.modules.identity.organisations.models import Organisation
from .models import (
    ApplicationStatus,
    ApplicationType,
    ConfigType,
    OrganisationApplication,
    ApplicationModule,
    ApplicationConfiguration,
    ApplicationWorkflow,
    ApplicationRule,
    ApplicationForm,
    ApplicationReport,
    ApplicationApproval
)

from .schemas import RuntimeConfiguration
from .service import ApplicationRuntimeService, invalidate_runtime_cache

router = APIRouter(prefix="/api/v1/application", tags=["Application Configuration"])

@router.get("/runtime", response_model=RuntimeConfiguration)
async def get_application_runtime(
    user: AuthenticatedUser = Depends(get_current_active_organisation),
    db: AsyncSession = Depends(get_db)
):
    """
    Get the complete, normalized runtime configuration for the current organisation's application.
    This safely encapsulates modules, configuration, navigation, terminology, etc.
    """
    return await ApplicationRuntimeService.get_runtime_configuration(db, user.organisation_id)

@router.get("")
async def get_application_definition(
    user: AuthenticatedUser = Depends(get_current_active_organisation),
    db: AsyncSession = Depends(get_db)
):
    """
    Get the overall application definition for the current organisation.
    """
    result = await db.execute(
        select(OrganisationApplication).where(OrganisationApplication.organisation_id == user.organisation_id)
    )
    app_def = result.scalars().first()
    
    if not app_def:
        raise HTTPException(status_code=404, detail="Application configuration not found for this organisation")
        
    return {
        "id": app_def.id,
        "application_type": app_def.application_type,
        "application_name": app_def.application_name,
        "application_version": app_def.application_version,
        "status": app_def.status,
    }

@router.get("/modules")
async def get_application_modules(
    user: AuthenticatedUser = Depends(get_current_active_organisation),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ApplicationModule).join(OrganisationApplication).where(OrganisationApplication.organisation_id == user.organisation_id)
    )
    modules = result.scalars().all()
    return [{"module_code": m.module_code, "is_enabled": m.is_enabled} for m in modules]

@router.get("/configuration")
async def get_application_configurations(
    user: AuthenticatedUser = Depends(get_current_active_organisation),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ApplicationConfiguration).join(OrganisationApplication).where(OrganisationApplication.organisation_id == user.organisation_id)
    )
    configs = result.scalars().all()
    return [{"config_type": c.config_type, "config_data": c.config_data} for c in configs]

@router.get("/forms")
async def get_application_forms(
    user: AuthenticatedUser = Depends(get_current_active_organisation),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ApplicationForm).join(OrganisationApplication).where(OrganisationApplication.organisation_id == user.organisation_id)
    )
    forms = result.scalars().all()
    return [{
        "entity_type": f.entity_type,
        "form_name": f.form_name,
        "fields_config": f.fields_config_json,
        "sections": f.sections_json
    } for f in forms]

@router.get("/workflows")
async def get_application_workflows(
    user: AuthenticatedUser = Depends(get_current_active_organisation),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ApplicationWorkflow).join(OrganisationApplication).where(OrganisationApplication.organisation_id == user.organisation_id)
    )
    workflows = result.scalars().all()
    return [{
        "entity_type": w.entity_type,
        "workflow_name": w.workflow_name,
        "definition": w.definition_json
    } for w in workflows]

@router.get("/rules")
async def get_application_rules(
    user: AuthenticatedUser = Depends(get_current_active_organisation),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ApplicationRule).join(OrganisationApplication).where(OrganisationApplication.organisation_id == user.organisation_id)
    )
    rules = result.scalars().all()
    return [{
        "entity_type": r.entity_type,
        "rule_name": r.rule_name,
        "conditions": r.conditions_json,
        "actions": r.actions_json,
        "priority": r.priority
    } for r in rules]


class ServiceConfigPayload(BaseModel):
    service_provider: bool = True
    cargo: bool = True
    passenger: bool = True
    client: bool = False


@router.put("/service-config", response_model=ServiceConfigPayload)
async def update_service_config(
    payload: ServiceConfigPayload,
    user: AuthenticatedUser = Depends(get_current_active_organisation),
    db: AsyncSession = Depends(get_db),
):
    """Enable/disable Service Provider (Cargo, Passenger) and Client features for the workspace."""
    if not payload.service_provider and not payload.client:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one mode (Service Provider or Client) must be enabled.",
        )

    app_def = (
        await db.execute(
            select(OrganisationApplication).where(
                OrganisationApplication.organisation_id == user.organisation_id
            )
        )
    ).scalars().first()

    if not app_def:
        app_def = OrganisationApplication(
            organisation_id=user.organisation_id,
            application_type=ApplicationType.STANDARD,
            application_name="Zolexora TMS",
            application_version="1.0.0",
            status=ApplicationStatus.ACTIVE,
        )
        db.add(app_def)
        await db.flush()

    ext_cfg = (
        await db.execute(
            select(ApplicationConfiguration).where(
                ApplicationConfiguration.application_id == app_def.id,
                ApplicationConfiguration.config_type == ConfigType.EXTENSIONS,
            )
        )
    ).scalars().first()

    data_dict = payload.model_dump()
    if ext_cfg:
        merged = dict(ext_cfg.config_data or {})
        merged["service_config"] = data_dict
        ext_cfg.config_data = merged
    else:
        db.add(
            ApplicationConfiguration(
                application_id=app_def.id,
                config_type=ConfigType.EXTENSIONS,
                config_data={"service_config": data_dict},
            )
        )

    await db.commit()
    invalidate_runtime_cache(user.organisation_id)
    return payload
