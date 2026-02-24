from fastapi import FastAPI, Depends
# FastAPI → main framework
# Depends → for dependency injection (not heavily used here)

from database import engine, Base, SessionLocal
# engine → database connection engine
# Base → base class for all models
# SessionLocal → used to create DB sessions

from models import User, UserRole
# User → user table model
# UserRole → roles enum (ADMIN, TUTOR, STUDENT)

from auth import get_password_hash
# get_password_hash → hashes plain password before storing in DB

from routers import auth, users, courses
# Import all route files (auth routes, user routes, course routes)

from sqlalchemy.orm import Session
# DB session type

from fastapi.middleware.cors import CORSMiddleware
# Middleware that allows frontend to call backend APIs


# =====================================
# CREATE DATABASE TABLES
# =====================================

# This creates all tables in database based on models
# Example: User table, Course table etc.
Base.metadata.create_all(bind=engine)


# =====================================
# CREATE FASTAPI APP
# =====================================

app = FastAPI(title="Course Management System")


# =====================================
# CORS CONFIGURATION
# =====================================

# This allows frontend (React app) to call this backend
# Without CORS, browser would block requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # React dev server
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],  # allow all HTTP methods (GET, POST etc.)
    allow_headers=["*"],  # allow all headers
)


# =====================================
# SEED DEMO USERS FUNCTION
# =====================================

# This function creates demo users automatically
# So we can test login without manually adding users
def seed_users():

    # Create DB session
    db = SessionLocal()

    try:
        # Demo users list
        users_to_seed = [
            {"email": "admin@gmail.com", "password": "adminpassword", "role": UserRole.ADMIN},
            {"email": "tutor@gmail.com", "password": "tutorpassword", "role": UserRole.TUTOR},
            {"email": "student@gmail.com", "password": "studentpassword", "role": UserRole.STUDENT},
        ]

        # Loop through demo users
        for user_data in users_to_seed:

            # Check if user already exists
            user = db.query(User).filter(User.email == user_data["email"]).first()

            if not user:
                # Create new user with hashed password
                new_user = User(
                    email=user_data["email"],
                    password=get_password_hash(user_data["password"]),
                    role=user_data["role"]
                )

                # Add user to DB
                db.add(new_user)

        # Save all users to database
        db.commit()

    except Exception as e:
        # If error happens → print error and rollback
        print(f"Error seeding users: {e}")
        db.rollback()

    finally:
        # Always close DB connection
        db.close()


# =====================================
# STARTUP EVENT
# =====================================

# This runs automatically when app starts
# It will create demo users
@app.on_event("startup")
async def startup_event():
    seed_users()


# =====================================
# INCLUDE ROUTERS
# =====================================

# Add all route files into main app
app.include_router(auth.router)     # login routes
app.include_router(users.router)    # user routes
app.include_router(courses.router)  # course routes


# =====================================
# ROOT ENDPOINT
# =====================================

# Simple test endpoint to check API running
@app.get("/")
async def root():
    return {"message": "Welcome to the Course Management System API"}