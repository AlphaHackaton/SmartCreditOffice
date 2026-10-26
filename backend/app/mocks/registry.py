"""Registry shared by all external-system mocks."""

from __future__ import annotations

from uuid import UUID

from app.seed.personas import RawPersona, load_raw


class SourceUnavailable(RuntimeError):
    """A configured mock source is unavailable."""

    code = "SOURCE_UNAVAILABLE"


class PersonaRegistry:
    """Resolve synthetic persona fixtures without network access."""

    def __init__(self) -> None:
        self._personas: dict[str, RawPersona] = {
            str(item["id"]): item for item in load_raw()["personas"]
        }
        self._by_inn = {
            str(item["company"]["inn"]): str(item["id"]) for item in self._personas.values()
        }
        self._company_ids: dict[UUID, str] = {}
        self._unavailable: set[str] = set()

    def persona(self, persona_id: str) -> RawPersona:
        try:
            return self._personas[persona_id]
        except KeyError as exc:
            raise KeyError(f"unknown persona: {persona_id}") from exc

    def by_inn(self, inn: str) -> tuple[str, RawPersona]:
        try:
            persona_id = self._by_inn[inn]
        except KeyError as exc:
            raise KeyError(f"unknown INN: {inn}") from exc
        self.ensure_available(persona_id)
        return persona_id, self._personas[persona_id]

    def bind_company(self, company_id: UUID, inn: str) -> None:
        persona_id = self._by_inn.get(inn)
        if persona_id is None:
            raise KeyError(f"unknown INN: {inn}")
        self._company_ids[company_id] = persona_id

    def persona_for_company(self, company_id: UUID) -> tuple[str, RawPersona]:
        try:
            persona_id = self._company_ids[company_id]
        except KeyError as exc:
            raise KeyError(f"unknown company: {company_id}") from exc
        self.ensure_available(persona_id)
        return persona_id, self._personas[persona_id]

    def set_unavailable(self, persona_id: str, unavailable: bool = True) -> None:
        self.persona(persona_id)
        if unavailable:
            self._unavailable.add(persona_id)
        else:
            self._unavailable.discard(persona_id)

    def ensure_available(self, persona_id: str) -> None:
        if persona_id in self._unavailable:
            raise SourceUnavailable(f"mock source unavailable for {persona_id}")
