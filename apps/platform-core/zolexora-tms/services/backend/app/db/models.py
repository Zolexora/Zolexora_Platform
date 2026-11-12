from app.db.base import Base
from app.modules.core.platform.models import (
    TenantDatabaseRegistry,
    OrganisationDatabaseAssignment,
    TenantMongodbRegistry,
    OrganisationMongodbAssignment,
    OrganisationStorageAssignment,
    PlatformAuditLog,
    ProviderType,
    RegistryStatus,
    TenantMigrationJob,
    MigrationStatus
)
from app.modules.identity.organisations.models import Organisation, OrganisationStatus, OrganisationType
from app.modules.identity.users.models import Profile
from app.modules.identity.roles.models import (
    PlatformRoleTemplate,
    PlatformRoleTemplatePermission,
    OrganisationRole,
    OrganisationRoleVersion,
    OrganisationRolePermission,
    RoleAssignment,
    UserPermissionOverride,
    RoleStatus,
    RoleSource,
    OverrideType,
)
from app.modules.identity.organisations.membership_models import OrganisationMember, MemberStatus, OrganisationInvitation

from app.modules.core.customization.models import (
    OrganisationApplication,
    ApplicationType,
    ApplicationStatus,
    ConfigType,
    ApplicationModule,
    ApplicationPage,
    ApplicationAction,
    ApplicationConfiguration,
    ApplicationWorkflow,
    ApplicationRule,
    ApplicationForm,
    ApplicationReport,
    ApplicationApproval
)

from app.modules.operations.operating_units.models import (
    OperatingUnit,
    OperatingUnitLocation,
    OperatingUnitStatus
)
from app.modules.fleet.vehicles.models import Vehicle
from app.modules.fleet.drivers.models import Driver

__all__ = [
    "Base",
    "Vehicle",
    "Driver",
    "TenantDatabaseRegistry",
    "OrganisationDatabaseAssignment",
    "TenantMongodbRegistry",
    "OrganisationMongodbAssignment",
    "OrganisationStorageAssignment",
    "PlatformAuditLog",
    "ProviderType",
    "RegistryStatus",
    "TenantMigrationJob",
    "MigrationStatus",
    "Organisation",
    "OrganisationStatus",
    "OrganisationType",
    "Profile",
    # Prompt 07: RBAC
    "PlatformRoleTemplate",
    "PlatformRoleTemplatePermission",
    "OrganisationRole",
    "OrganisationRoleVersion",
    "OrganisationRolePermission",
    "RoleAssignment",
    "UserPermissionOverride",
    "RoleStatus",
    "RoleSource",
    "OverrideType",
    # Membership
    "OrganisationMember",
    "MemberStatus",
    "OrganisationInvitation",
    # Customization
    "OrganisationApplication",
    "ApplicationType",
    "ApplicationStatus",
    "ConfigType",
    "ApplicationModule",
    "ApplicationPage",
    "ApplicationAction",
    "ApplicationConfiguration",
    "ApplicationWorkflow",
    "ApplicationRule",
    "ApplicationForm",
    "ApplicationReport",
    "ApplicationApproval",
    "OperatingUnit",
    "OperatingUnitLocation",
    "OperatingUnitStatus"
]

from app.modules.crm.clients.models import Client, ClientLocation, ClientLocationOUHistory, ClientStatus
from app.modules.crm.vendors.models import Vendor, VendorStatus, VendorType

__all__.extend([
    "Client",
    "ClientLocation",
    "ClientLocationOUHistory",
    "ClientStatus",
    "Vendor",
    "VendorStatus",
    "VendorType"
])

# Operations, finance and compliance models (schema defined by Alembic migrations)
from app.modules.core.audit.models import AuditLog
from app.modules.crm.customers.models import Customer
from app.modules.operations.bookings.models import Booking, BookingRequest
from app.modules.operations.duties.models import Duty, DutyAssignment
from app.modules.operations.trips.models import Trip, TripEvent
from app.modules.finance.billing.models import (
    BillingRecord, FinancialSnapshot, FinancialSnapshotLine, RateCard, RateCardVersion, RateCardRule,
)
from app.modules.finance.expenses.models import Expense
from app.modules.finance.invoices.models import (
    Invoice, InvoiceLine, InvoiceTaxLine,
    FinancialAdjustmentNote, FinancialAdjustmentNoteLine, FinancialAdjustmentNoteTaxLine,
)
from app.modules.finance.payables.models import Payable, PayableLine, Settlement, VendorSettlementStatement
from app.modules.finance.payments.models import Payment, PaymentAllocation, PaymentEvent
from app.modules.finance.pl.models import FinancialPeriod, FinancialAuditLog
from app.modules.core.compliance.models import ComplianceRequirement, ComplianceRecord, ComplianceVerification

__all__.extend([
    "AuditLog", "Customer", "Booking", "BookingRequest", "Duty", "DutyAssignment", "Trip", "TripEvent",
    "BillingRecord", "FinancialSnapshot", "FinancialSnapshotLine", "RateCard", "RateCardVersion", "RateCardRule",
    "Expense", "Invoice", "InvoiceLine", "InvoiceTaxLine",
    "FinancialAdjustmentNote", "FinancialAdjustmentNoteLine", "FinancialAdjustmentNoteTaxLine",
    "Payable", "PayableLine", "Settlement", "VendorSettlementStatement",
    "Payment", "PaymentAllocation", "PaymentEvent", "FinancialPeriod", "FinancialAuditLog",
    "ComplianceRequirement", "ComplianceRecord", "ComplianceVerification",
])
