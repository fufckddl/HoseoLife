from sqlalchemy import Column, String, DateTime, Boolean, func
from app.db.database import Base

class EmailVerification(Base):
    __tablename__ = "email_verifications"

    email = Column(String(255), primary_key=True, index=True)
    code = Column(String(10), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    verified = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now()) 