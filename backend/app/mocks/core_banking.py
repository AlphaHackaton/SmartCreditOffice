"""Synthetic core-banking disbursement adapter."""

from decimal import Decimal
from uuid import UUID


class MockCoreBanking:
    def open_loan_account(self, application_id: UUID, amount: Decimal) -> str:
        if amount <= 0:
            raise ValueError("LOAN_AMOUNT_MUST_BE_POSITIVE")
        return f"DEMO-{application_id.hex[:12].upper()}"
