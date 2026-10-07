from typing import Protocol

from storefronts.registry import StorefrontRegistry


class StorefrontRegistryRepository(Protocol):
    def load_registry(self) -> StorefrontRegistry: ...
