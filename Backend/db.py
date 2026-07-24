import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker


load_dotenv()

DEFAULT_DATABASE_URL = 'postgresql+psycopg2://postgres:postgres@localhost:5432/complaints_db'
SQLITE_DATABASE_PATH = Path(__file__).resolve().parent.parent / 'complaints.db'


def build_sqlite_url() -> str:
    return f'sqlite:///{SQLITE_DATABASE_PATH.as_posix()}'


def create_database_engine():
    database_url = os.getenv('DATABASE_URL', DEFAULT_DATABASE_URL)

    try:
        engine = create_engine(
            database_url,
            pool_pre_ping=True,
            connect_args={'connect_timeout': 1} if database_url.startswith('postgresql') else {},
        )
        with engine.connect():
            pass
        return engine
    except Exception:
        return create_engine(
            build_sqlite_url(),
            connect_args={'check_same_thread': False},
        )


engine = create_database_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
