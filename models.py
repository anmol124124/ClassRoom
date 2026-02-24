from sqlalchemy import Column, Integer, String, Enum
# Column → used to define table columns
# Integer, String → data types for columns
# Enum → used for fixed set of values

from database import Base
# Base → parent class for all database models (tables)

import enum
# enum → used to create role types like admin, tutor, student


# =====================================
# USER ROLES ENUM
# =====================================

# This defines the types of users in the system
# Admin → full control
# Tutor → can edit courses
# Student → can only view courses
class UserRole(str, enum.Enum):
    ADMIN = "admin"
    TUTOR = "tutor"
    STUDENT = "student"


# =====================================
# USER TABLE MODEL
# =====================================

# This class represents the "users" table in database
class User(Base):
    __tablename__ = "users"  # Table name in database

    # Unique ID for each user (auto increases)
    id = Column(Integer, primary_key=True, index=True)

    # Email of user (must be unique)
    email = Column(String, unique=True, index=True, nullable=False)

    # Password (stored as hashed, never plain text)
    password = Column(String, nullable=False)

    # Role of user (admin/tutor/student)
    role = Column(String, default=UserRole.STUDENT)


# =====================================
# COURSE TABLE MODEL
# =====================================

# This class represents the "courses" table in database
class Course(Base):
    __tablename__ = "courses"

    # Unique ID for each course
    id = Column(Integer, primary_key=True, index=True)

    # Course title
    title = Column(String, index=True, nullable=False)

    # Course description (optional)
    description = Column(String, nullable=True)