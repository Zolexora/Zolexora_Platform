from collections import OrderedDict
import time
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from fastapi import HTTPException
from uuid import UUID

from app.core.config import settings
from app.modules.core.platform.capabilities import TMS_CAPABILITY_REGISTRY

from .models import (
    OrganisationApplication,
    ApplicationModule,
    ApplicationPage,
    ApplicationAction,
    ApplicationConfiguration,
    ApplicationWorkflow,
    ApplicationRule,
    ApplicationForm,
    ApplicationReport,
    ApplicationApproval,
    ConfigType
)
from .schemas import (
    RuntimeConfiguration,
    RuntimeApplicationInfo,
    RuntimeBranding,
    RuntimeModule,
    RuntimePage,
    RuntimeAction,
    RuntimeForm,
    RuntimeWorkflow,
    RuntimeRule,
    RuntimeApproval
)

_RUNTIME_CACHE_TTL = 30.0
_RUNTIME_CACHE_MAX = 2_000
_runtime_cache: OrderedDict[UUID, Tuple[float, RuntimeConfiguration]] = OrderedDict()


def invalidate_runtime_cache(organisation_id: Optional[UUID] = None) -> None:
    if organisation_id is None:
        _runtime_cache.clear()
    else:
        _runtime_cache.pop(organisation_id, None)


def _build_runtime_modules(
    db_modules: Dict[str, bool],
    db_pages: Dict[str, bool],
    db_actions: Dict[str, bool],
) -> Dict[str, RuntimeModule]:
    runtime_modules: Dict[str, RuntimeModule] = {}
    for mod in TMS_CAPABILITY_REGISTRY.modules:
        mod_enabled = db_modules.get(mod.code, True)
        runtime_pages: Dict[str, RuntimePage] = {}
        for page in mod.pages:
            page_enabled = db_pages.get(f"{mod.code}:{page.code}", True)
            runtime_actions = {
                action.code: RuntimeAction(
                    name=action.name,
                    enabled=db_actions.get(f"{page.code}:{action.code}", True),
                )
                for action in page.actions
            }
            runtime_pages[page.code] = RuntimePage(
                name=page.name,
                enabled=page_enabled,
                actions=runtime_actions,
            )
        runtime_modules[mod.code] = RuntimeModule(
            name=mod.name,
            enabled=mod_enabled,
            pages=runtime_pages,
        )
    return runtime_modules


class ApplicationRuntimeService:
    @staticmethod
    async def get_runtime_configuration(db: AsyncSession, organisation_id: UUID) -> RuntimeConfiguration:
        now = time.monotonic()
        if settings.ENVIRONMENT != "test":
            cached = _runtime_cache.get(organisation_id)
            if cached:
                if cached[0] > now:
                    _runtime_cache.move_to_end(organisation_id)
                    return cached[1]
                _runtime_cache.pop(organisation_id, None)

        # 1. Fetch Application Base
        result = await db.execute(
            select(OrganisationApplication).where(OrganisationApplication.organisation_id == organisation_id)
        )
        app_def = result.scalars().first()
        if not app_def:
            raise HTTPException(status_code=404, detail="Application configuration not found for this organisation")

        app_info = RuntimeApplicationInfo(
            id=app_def.id,
            name=app_def.application_name,
            type=app_def.application_type,
            version=app_def.application_version,
            status=app_def.status,
        )

        # 2. Fetch all child customization tables in 1 round-trip on PostgreSQL (ORM fallback otherwise).
        bind = db.get_bind()
        if bind is not None and bind.dialect.name == "postgresql":
            bundle_res = await db.execute(
                text("""
                    SELECT
                        COALESCE((SELECT json_agg(json_build_object('module_code', module_code, 'is_enabled', is_enabled))
                                  FROM public.application_modules WHERE application_id = :app_id), '[]'::json) AS modules,
                        COALESCE((SELECT json_agg(json_build_object('module_code', module_code, 'page_code', page_code, 'is_enabled', is_enabled))
                                  FROM public.application_pages WHERE application_id = :app_id), '[]'::json) AS pages,
                        COALESCE((SELECT json_agg(json_build_object('page_code', page_code, 'action_code', action_code, 'is_enabled', is_enabled))
                                  FROM public.application_actions WHERE application_id = :app_id), '[]'::json) AS actions,
                        COALESCE((SELECT json_agg(json_build_object('config_type', config_type::text, 'config_data', config_data))
                                  FROM public.application_configurations WHERE application_id = :app_id), '[]'::json) AS configs,
                        COALESCE((SELECT json_agg(json_build_object('entity_type', entity_type, 'form_name', form_name, 'fields_config_json', fields_config_json, 'sections_json', sections_json))
                                  FROM public.application_forms WHERE application_id = :app_id AND is_active = true), '[]'::json) AS forms,
                        COALESCE((SELECT json_agg(json_build_object('entity_type', entity_type, 'workflow_name', workflow_name, 'definition_json', definition_json))
                                  FROM public.application_workflows WHERE application_id = :app_id AND is_active = true), '[]'::json) AS workflows,
                        COALESCE((SELECT json_agg(json_build_object('entity_type', entity_type, 'rule_name', rule_name, 'conditions_json', conditions_json, 'actions_json', actions_json, 'priority', priority))
                                  FROM public.application_rules WHERE application_id = :app_id AND is_active = true), '[]'::json) AS rules,
                        COALESCE((SELECT json_agg(json_build_object('entity_type', entity_type, 'approval_chain_json', approval_chain_json))
                                  FROM public.application_approvals WHERE application_id = :app_id), '[]'::json) AS approvals
                """),
                {"app_id": app_def.id},
            )
            bundle = bundle_res.mappings().one()
            mod_rows = bundle["modules"] or []
            page_rows = bundle["pages"] or []
            action_rows = bundle["actions"] or []
            conf_rows = bundle["configs"] or []
            form_rows = bundle["forms"] or []
            wf_rows = bundle["workflows"] or []
            rule_rows = bundle["rules"] or []
            appr_rows = bundle["approvals"] or []

            db_modules = {m["module_code"]: m["is_enabled"] for m in mod_rows}
            db_pages = {f"{p['module_code']}:{p['page_code']}": p["is_enabled"] for p in page_rows}
            db_actions = {f"{a['page_code']}:{a['action_code']}": a["is_enabled"] for a in action_rows}
        else:
            mod_res = await db.execute(select(ApplicationModule).where(ApplicationModule.application_id == app_def.id))
            db_modules = {m.module_code: m.is_enabled for m in mod_res.scalars().all()}

            page_res = await db.execute(select(ApplicationPage).where(ApplicationPage.application_id == app_def.id))
            db_pages = {f"{p.module_code}:{p.page_code}": p.is_enabled for p in page_res.scalars().all()}

            action_res = await db.execute(select(ApplicationAction).where(ApplicationAction.application_id == app_def.id))
            db_actions = {f"{a.page_code}:{a.action_code}": a.is_enabled for a in action_res.scalars().all()}

            conf_rows = [
                {"config_type": c.config_type.value, "config_data": c.config_data}
                for c in (await db.execute(select(ApplicationConfiguration).where(ApplicationConfiguration.application_id == app_def.id))).scalars().all()
            ]
            form_rows = [
                {"entity_type": f.entity_type, "form_name": f.form_name, "fields_config_json": f.fields_config_json, "sections_json": f.sections_json}
                for f in (await db.execute(select(ApplicationForm).where(ApplicationForm.application_id == app_def.id, ApplicationForm.is_active == True))).scalars().all()
            ]
            wf_rows = [
                {"entity_type": w.entity_type, "workflow_name": w.workflow_name, "definition_json": w.definition_json}
                for w in (await db.execute(select(ApplicationWorkflow).where(ApplicationWorkflow.application_id == app_def.id, ApplicationWorkflow.is_active == True))).scalars().all()
            ]
            rule_rows = [
                {"entity_type": r.entity_type, "rule_name": r.rule_name, "conditions_json": r.conditions_json, "actions_json": r.actions_json, "priority": r.priority}
                for r in (await db.execute(select(ApplicationRule).where(ApplicationRule.application_id == app_def.id, ApplicationRule.is_active == True))).scalars().all()
            ]
            appr_rows = [
                {"entity_type": a.entity_type, "approval_chain_json": a.approval_chain_json}
                for a in (await db.execute(select(ApplicationApproval).where(ApplicationApproval.application_id == app_def.id))).scalars().all()
            ]

        runtime_modules = _build_runtime_modules(db_modules, db_pages, db_actions)

        branding = RuntimeBranding(application_name=app_def.application_name)
        navigation = []
        terminology = {}
        numbering = {}
        extensions = {}
        notifications = {}
        documents = {}

        for c in conf_rows:
            ctype = c["config_type"]
            cdata = c["config_data"] or {}
            if ctype == ConfigType.THEME.value:
                branding.theme = cdata.get("theme", {})
                branding.logo_url = cdata.get("logo_url")
            elif ctype == ConfigType.NAVIGATION.value:
                navigation = cdata.get("items", [])
            elif ctype == ConfigType.TERMINOLOGY.value:
                terminology = cdata
            elif ctype == ConfigType.NUMBERING.value:
                numbering = cdata
            elif ctype == ConfigType.EXTENSIONS.value:
                extensions = cdata
            elif ctype == ConfigType.NOTIFICATIONS.value:
                notifications = cdata
            elif ctype == ConfigType.DOCUMENT_TEMPLATES.value:
                documents = cdata

        runtime_forms: Dict[str, List[RuntimeForm]] = {}
        for f in form_rows:
            runtime_forms.setdefault(f["entity_type"], []).append(RuntimeForm(
                form_name=f["form_name"],
                fields_config=f["fields_config_json"],
                sections=f["sections_json"],
            ))

        runtime_workflows: Dict[str, List[RuntimeWorkflow]] = {}
        for w in wf_rows:
            runtime_workflows.setdefault(w["entity_type"], []).append(RuntimeWorkflow(
                workflow_name=w["workflow_name"],
                definition=w["definition_json"],
            ))

        runtime_rules: Dict[str, List[RuntimeRule]] = {}
        for r in rule_rows:
            runtime_rules.setdefault(r["entity_type"], []).append(RuntimeRule(
                rule_name=r["rule_name"],
                conditions=r["conditions_json"],
                actions=r["actions_json"],
                priority=r["priority"],
            ))

        runtime_approvals: Dict[str, List[RuntimeApproval]] = {}
        for a in appr_rows:
            runtime_approvals.setdefault(a["entity_type"], []).append(RuntimeApproval(
                approval_chain=a["approval_chain_json"],
            ))

        config = RuntimeConfiguration(
            application=app_info,
            branding=branding,
            modules=runtime_modules,
            navigation=navigation,
            terminology=terminology,
            forms=runtime_forms,
            workflows=runtime_workflows,
            rules=runtime_rules,
            approvals=runtime_approvals,
            numbering=numbering,
            extensions=extensions,
            notifications=notifications,
            documents=documents,
        )

        if settings.ENVIRONMENT != "test":
            while _runtime_cache and next(iter(_runtime_cache.values()))[0] <= now:
                _runtime_cache.popitem(last=False)
            while len(_runtime_cache) >= _RUNTIME_CACHE_MAX:
                _runtime_cache.popitem(last=False)
            _runtime_cache[organisation_id] = (now + _RUNTIME_CACHE_TTL, config)

        return config
