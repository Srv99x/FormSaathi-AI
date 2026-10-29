class APIError(Exception):
    def __init__(self, status: int, code: str, message: str,
                 field_id: str | None = None, retryable: bool = False):
        self.status = status
        self.code = code
        self.message = message
        self.field_id = field_id
        self.retryable = retryable
