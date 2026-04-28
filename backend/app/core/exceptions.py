from fastapi import HTTPException, status


class SeatNotFoundError(HTTPException):
    def __init__(self, seat_id: int):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Seat {seat_id} not found",
        )


class SeatNotAvailableError(HTTPException):
    def __init__(self, seat_id: int, current_status: str):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Seat {seat_id} is not available (current status: {current_status})",
        )


class LockNotOwnedError(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No active lock owned by you for this seat",
        )


class OrderNotFoundError(HTTPException):
    def __init__(self, order_id: int):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order {order_id} not found",
        )


class OrderStateError(HTTPException):
    def __init__(self, current_status: str):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Operation not allowed on order with status '{current_status}'",
        )


class PaymentDeclinedError(HTTPException):
    def __init__(self, reason: str = "Payment declined by gateway"):
        super().__init__(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=reason,
        )


class EmailAlreadyRegisteredError(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already registered",
        )


class InvalidCredentialsError(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )


class InvalidTokenError(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


class AdminRequiredError(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access required",
        )
