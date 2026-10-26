"""Product catalog endpoint."""

from fastapi import APIRouter, Request

from app.api.schemas import ProductOut, ProductsOut

router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=ProductsOut)
def products(request: Request) -> ProductsOut:
    service = request.app.state.service
    items = [
        ProductOut(
            code=row.code,
            name=row.name,
            min_amount=row.min_amount,
            max_amount=row.max_amount,
            min_term_months=row.min_term_months,
            max_term_months=row.max_term_months,
        )
        for row in service.products()
    ]
    return ProductsOut(items=items)
