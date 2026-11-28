import enum

class VehicleBodyType(str, enum.Enum):
    # Public / Passenger Transport (default)
    SEDAN = "SEDAN"
    HATCHBACK = "HATCHBACK"
    SUV = "SUV"
    TEMPO_TRAVELLER = "TEMPO_TRAVELLER"
    MINI_BUS = "MINI_BUS"
    BUS = "BUS"
    AUTO_RICKSHAW = "AUTO_RICKSHAW"
    EV_CAB = "EV_CAB"
    # Commercial / Cargo
    TRUCK = "TRUCK"
    TRAILER = "TRAILER"
    CONTAINER = "CONTAINER"
    TANKER = "TANKER"
    TIPPER = "TIPPER"
    TEMPO = "TEMPO"
    PICKUP = "PICKUP"
    OTHER = "OTHER"

class VehicleOwnershipType(str, enum.Enum):
    OWNED = "OWNED"
    LEASED = "LEASED"
    EMI = "EMI"
    ATTACHED = "ATTACHED"

class FuelType(str, enum.Enum):
    DIESEL = "DIESEL"
    CNG = "CNG"
    ELECTRIC = "ELECTRIC"
    PETROL = "PETROL"

class VehicleOperationalStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    ON_DUTY = "ON_DUTY"
    MAINTENANCE = "MAINTENANCE"
    DECOMMISSIONED = "DECOMMISSIONED"
