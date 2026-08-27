from sqlalchemy import create_engine, text
from collections.abc import Generator
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from backend.app.core.config import settings


connect_args = (
    {"check_same_thread": False}
    if settings.database_url.startswith("sqlite")
    else {}
)

engine = create_engine(
    settings.database_url,
    connect_args=connect_args,
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)


class Base(DeclarativeBase):
    pass


def check_database() -> None:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))

def get_db() -> Generator[Session, None, None]:
    database = SessionLocal()

    try:
        yield database
    finally:
        database.close()